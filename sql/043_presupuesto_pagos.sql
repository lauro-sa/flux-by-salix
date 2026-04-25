-- =============================================================
-- Migración 043: Pagos de presupuestos
-- =============================================================
-- Tabla `presupuesto_pagos`: registra pagos reales recibidos contra
-- un presupuesto. Permite múltiples pagos por cuota (parciales) y
-- pagos "a cuenta" sin cuota asignada. Cuando exista el módulo de
-- facturas, esta tabla se generaliza agregando referencia opcional.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.presupuesto_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,

  -- Cuota a la que se imputa. NULL = pago "a cuenta" sin imputar.
  cuota_id uuid REFERENCES public.presupuesto_cuotas(id) ON DELETE SET NULL,

  -- Monto y moneda. Por defecto en moneda del presupuesto, pero editable
  -- por si el cliente pagó el equivalente en otra moneda (ej. USD).
  monto numeric NOT NULL CHECK (monto > 0),
  moneda text NOT NULL DEFAULT 'ARS',
  -- Cotización aplicada al pago vs. moneda del presupuesto. 1 si misma moneda.
  cotizacion_cambio numeric NOT NULL DEFAULT 1,
  -- Monto convertido a la moneda del presupuesto (= monto * cotizacion_cambio).
  -- Persistido para que las sumas en BD sean directas.
  monto_en_moneda_presupuesto numeric NOT NULL,

  -- Fecha real del pago (default hoy, editable: el comprobante puede ser
  -- anterior a la fecha de carga).
  fecha_pago timestamptz NOT NULL DEFAULT now(),

  -- Método de pago. Enum por ahora; en futuro configurable por empresa.
  -- Valores: efectivo, transferencia, cheque, tarjeta, deposito, otro
  metodo text NOT NULL DEFAULT 'transferencia',

  -- Referencia textual (n° de operación, banco, cheque, etc.)
  referencia text,

  -- Descripción libre (concepto, contexto, notas)
  descripcion text,

  -- Comprobante (archivo subido a Storage)
  comprobante_url text,
  comprobante_storage_path text,
  comprobante_nombre text,
  comprobante_tipo text,
  comprobante_tamano_bytes bigint,

  -- Vinculación opcional con un mensaje del chatter/inbox de origen
  -- (cuando el comprobante llegó por el mismo hilo de correo/whatsapp).
  mensaje_origen_id uuid,
  chatter_origen_id uuid REFERENCES public.chatter(id) ON DELETE SET NULL,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS presupuesto_pagos_presupuesto_idx ON public.presupuesto_pagos(presupuesto_id);
CREATE INDEX IF NOT EXISTS presupuesto_pagos_cuota_idx ON public.presupuesto_pagos(cuota_id);
CREATE INDEX IF NOT EXISTS presupuesto_pagos_empresa_fecha_idx ON public.presupuesto_pagos(empresa_id, fecha_pago);
CREATE INDEX IF NOT EXISTS presupuesto_pagos_chatter_origen_idx ON public.presupuesto_pagos(chatter_origen_id);

-- RLS multi-tenant
ALTER TABLE public.presupuesto_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_pagos_select" ON public.presupuesto_pagos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_pagos_insert" ON public.presupuesto_pagos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_pagos_update" ON public.presupuesto_pagos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "presupuesto_pagos_delete" ON public.presupuesto_pagos
  FOR DELETE USING (empresa_id = empresa_actual());

-- =============================================================
-- Función: recalcular estado derivado de una cuota.
-- Suma los pagos imputados a la cuota (en moneda del presupuesto)
-- y compara con el monto esperado. Estados:
--   pendiente — sum(pagos) = 0
--   parcial   — 0 < sum(pagos) < monto
--   cobrada   — sum(pagos) >= monto
-- =============================================================
CREATE OR REPLACE FUNCTION public.recalcular_estado_cuota(p_cuota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monto_cuota numeric;
  v_total_pagado numeric;
  v_nuevo_estado text;
  v_fecha_ultimo_pago timestamptz;
  v_nombre_ultimo_pago text;
BEGIN
  IF p_cuota_id IS NULL THEN RETURN; END IF;

  SELECT monto INTO v_monto_cuota
  FROM public.presupuesto_cuotas
  WHERE id = p_cuota_id;

  IF v_monto_cuota IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(monto_en_moneda_presupuesto), 0),
    MAX(fecha_pago),
    (SELECT creado_por_nombre FROM public.presupuesto_pagos
       WHERE cuota_id = p_cuota_id ORDER BY fecha_pago DESC LIMIT 1)
  INTO v_total_pagado, v_fecha_ultimo_pago, v_nombre_ultimo_pago
  FROM public.presupuesto_pagos
  WHERE cuota_id = p_cuota_id;

  IF v_total_pagado <= 0 THEN
    v_nuevo_estado := 'pendiente';
  ELSIF v_total_pagado >= v_monto_cuota THEN
    v_nuevo_estado := 'cobrada';
  ELSE
    v_nuevo_estado := 'parcial';
  END IF;

  UPDATE public.presupuesto_cuotas
  SET
    estado = v_nuevo_estado,
    fecha_cobro = CASE WHEN v_nuevo_estado = 'cobrada' THEN v_fecha_ultimo_pago ELSE NULL END,
    cobrado_por_nombre = CASE WHEN v_nuevo_estado = 'cobrada' THEN v_nombre_ultimo_pago ELSE NULL END
  WHERE id = p_cuota_id;
END;
$$;

-- =============================================================
-- Trigger: cuando se crea/edita/elimina un pago, recalcular estado
-- de la cuota antigua y la nueva (si cambió la imputación).
-- =============================================================
CREATE OR REPLACE FUNCTION public.trigger_recalcular_cuotas_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_estado_cuota(NEW.cuota_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió la cuota, recalcular ambas
    IF NEW.cuota_id IS DISTINCT FROM OLD.cuota_id THEN
      PERFORM public.recalcular_estado_cuota(OLD.cuota_id);
    END IF;
    PERFORM public.recalcular_estado_cuota(NEW.cuota_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_estado_cuota(OLD.cuota_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS presupuesto_pagos_recalcular_cuotas ON public.presupuesto_pagos;
CREATE TRIGGER presupuesto_pagos_recalcular_cuotas
  AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_pagos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalcular_cuotas_pago();

-- =============================================================
-- Permitir el nuevo estado 'parcial' en presupuesto_cuotas.
-- No hay CHECK constraint sobre la columna `estado`, así que solo
-- documentamos que los valores válidos pasan a ser:
--   pendiente | parcial | cobrada
-- =============================================================
COMMENT ON COLUMN public.presupuesto_cuotas.estado IS
  'pendiente | parcial | cobrada — derivado automáticamente desde presupuesto_pagos';
