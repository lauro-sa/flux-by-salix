-- =============================================================================
-- Baseline: Presupuestos, líneas, historial, cuotas, pagos y configuración
-- =============================================================================
-- Estas tablas fueron creadas originalmente vía `drizzle-kit push` directo a la
-- BD de desarrollo, por lo que nunca se materializaron como migración. Esta
-- migración baseline las recrea desde cero en entornos vírgenes.
--
-- Es totalmente IDEMPOTENTE: usa CREATE TABLE/INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION y DROP/CREATE TRIGGER. Por eso es seguro correrla
-- en entornos donde estas tablas ya existen (no las modifica), y también en
-- entornos vírgenes donde las migraciones del 26-04 dependen de ellas.
--
-- IMPORTANTE — qué NO incluye este archivo (lo aplican migraciones del 26-04):
--   * `presupuestos.estado_cambiado_en`              → 20260426010000_*
--   * trigger `trg_presupuestos_estado_cambiado_en`  → 20260426010000_*
--   * índice `idx_presupuestos_empresa_estado_cambiado` → 20260426010000_*
--   * `presupuesto_pagos.monto_percepciones`         → 20260426020000_*
--   * `presupuesto_pagos.es_adicional`               → 20260426020000_*
--   * `presupuesto_pagos.concepto_adicional`         → 20260426020000_*
--   * tabla `presupuesto_pago_comprobantes`          → 20260426020000_*
--   * CHECK `presupuesto_pagos_adicional_sin_cuota_chk` → 20260426030000_*
--   * filtro `AND es_adicional = false` en `recalcular_estado_cuota` →
--     20260426030000_*  (acá usamos la versión PREVIA, sin filtro).
-- =============================================================================


-- =============================================================================
-- TABLA: presupuestos
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',

  -- Snapshot del contacto al momento del presupuesto
  contacto_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  contacto_nombre text,
  contacto_apellido text,
  contacto_tipo text,
  contacto_identificacion text,
  contacto_condicion_iva text,
  contacto_direccion text,
  contacto_correo text,
  contacto_telefono text,

  -- Persona "a/c" dentro del contacto (atención de)
  atencion_contacto_id uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  atencion_nombre text,
  atencion_correo text,
  atencion_cargo text,

  referencia text,

  -- Moneda y cotización
  moneda text NOT NULL DEFAULT 'ARS',
  cotizacion_cambio numeric DEFAULT 1,

  -- Condición de pago snapshot
  condicion_pago_id text,
  condicion_pago_label text,
  condicion_pago_tipo text,

  -- Fechas
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  dias_vencimiento integer NOT NULL DEFAULT 30,
  fecha_vencimiento timestamptz,
  fecha_emision_original timestamptz,
  fecha_aceptacion timestamptz,

  -- Totales
  subtotal_neto numeric NOT NULL DEFAULT 0,
  total_impuestos numeric NOT NULL DEFAULT 0,
  descuento_global numeric NOT NULL DEFAULT 0,
  descuento_global_monto numeric NOT NULL DEFAULT 0,
  total_final numeric NOT NULL DEFAULT 0,

  -- Render del documento
  columnas_lineas jsonb DEFAULT '["producto", "descripcion", "cantidad", "unidad", "precio_unitario", "descuento", "impuesto", "subtotal"]'::jsonb,
  notas_html text,
  condiciones_html text,
  nota_plan_pago text,

  -- PDF generado y firmado
  pdf_url text,
  pdf_miniatura_url text,
  pdf_storage_path text,
  pdf_generado_en timestamptz,
  pdf_nombre_archivo text,
  pdf_firmado_url text,
  pdf_firmado_storage_path text,

  -- Trazabilidad de origen (presupuesto basado en otro doc/visita)
  origen_documento_id uuid,
  origen_documento_numero text,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Soft-delete / activo
  activo boolean NOT NULL DEFAULT true,
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,

  -- Búsqueda full-text (sin acentos)
  busqueda tsvector,

  CONSTRAINT presupuestos_empresa_id_numero_key UNIQUE (empresa_id, numero)
);

-- Índices secundarios
CREATE INDEX IF NOT EXISTS presupuestos_empresa_idx
  ON public.presupuestos USING btree (empresa_id);

CREATE INDEX IF NOT EXISTS presupuestos_contacto_idx
  ON public.presupuestos USING btree (contacto_id);

CREATE INDEX IF NOT EXISTS presupuestos_estado_idx
  ON public.presupuestos USING btree (empresa_id, estado);

CREATE INDEX IF NOT EXISTS presupuestos_fecha_idx
  ON public.presupuestos USING btree (empresa_id, fecha_emision);

CREATE INDEX IF NOT EXISTS presupuestos_papelera_idx
  ON public.presupuestos USING btree (empresa_id) WHERE (en_papelera = false);

CREATE INDEX IF NOT EXISTS presupuestos_estado_completo_idx
  ON public.presupuestos USING btree (empresa_id, estado)
  WHERE (estado = ANY (ARRAY['confirmado_cliente'::text, 'orden_venta'::text]));

CREATE INDEX IF NOT EXISTS presupuestos_busqueda_idx
  ON public.presupuestos USING gin (busqueda);

-- RLS
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_presupuestos_empresa ON public.presupuestos;
CREATE POLICY rls_presupuestos_empresa ON public.presupuestos
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- TABLA: lineas_presupuesto
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lineas_presupuesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  tipo_linea text NOT NULL DEFAULT 'producto',
  orden integer NOT NULL DEFAULT 0,

  codigo_producto text,
  descripcion text,
  descripcion_detalle text,

  cantidad numeric DEFAULT 1,
  unidad text,
  precio_unitario numeric DEFAULT 0,
  descuento numeric DEFAULT 0,

  impuesto_label text,
  impuesto_porcentaje numeric DEFAULT 0,
  impuesto_monto numeric DEFAULT 0,

  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  monto numeric,

  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lineas_presupuesto_presupuesto_idx
  ON public.lineas_presupuesto USING btree (presupuesto_id);

CREATE INDEX IF NOT EXISTS lineas_presupuesto_empresa_idx
  ON public.lineas_presupuesto USING btree (empresa_id);

CREATE INDEX IF NOT EXISTS lineas_presupuesto_orden_idx
  ON public.lineas_presupuesto USING btree (presupuesto_id, orden);

ALTER TABLE public.lineas_presupuesto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_lineas_presupuesto_empresa ON public.lineas_presupuesto;
CREATE POLICY rls_lineas_presupuesto_empresa ON public.lineas_presupuesto
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- TABLA: presupuesto_historial
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.presupuesto_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  estado text NOT NULL,

  usuario_id uuid NOT NULL,
  usuario_nombre text,

  fecha timestamptz NOT NULL DEFAULT now(),
  notas text
);

CREATE INDEX IF NOT EXISTS presupuesto_historial_presupuesto_idx
  ON public.presupuesto_historial USING btree (presupuesto_id);

ALTER TABLE public.presupuesto_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_presupuesto_historial_empresa ON public.presupuesto_historial;
CREATE POLICY rls_presupuesto_historial_empresa ON public.presupuesto_historial
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- TABLA: presupuesto_cuotas
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.presupuesto_cuotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  numero integer NOT NULL,
  descripcion text,
  porcentaje numeric NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  dias_desde_emision integer DEFAULT 0,

  estado text NOT NULL DEFAULT 'pendiente',
  fecha_cobro timestamptz,
  cobrado_por_nombre text
);

CREATE INDEX IF NOT EXISTS presupuesto_cuotas_presupuesto_idx
  ON public.presupuesto_cuotas USING btree (presupuesto_id);

ALTER TABLE public.presupuesto_cuotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_presupuesto_cuotas_empresa ON public.presupuesto_cuotas;
CREATE POLICY rls_presupuesto_cuotas_empresa ON public.presupuesto_cuotas
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- TABLA: presupuesto_pagos
-- =============================================================================
-- NOTA: Las columnas `monto_percepciones`, `es_adicional` y `concepto_adicional`
-- se agregan en la migración 20260426020000_pagos_percepciones_y_comprobantes
-- y NO van acá.
CREATE TABLE IF NOT EXISTS public.presupuesto_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  presupuesto_id uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  cuota_id uuid REFERENCES public.presupuesto_cuotas(id) ON DELETE SET NULL,

  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ARS',
  cotizacion_cambio numeric NOT NULL DEFAULT 1,
  monto_en_moneda_presupuesto numeric NOT NULL,

  fecha_pago timestamptz NOT NULL DEFAULT now(),
  metodo text NOT NULL DEFAULT 'transferencia',
  referencia text,
  descripcion text,

  -- Comprobante (single archivo legacy; nuevos comprobantes múltiples viven en
  -- la tabla `presupuesto_pago_comprobantes` que crea 20260426020000).
  comprobante_url text,
  comprobante_storage_path text,
  comprobante_nombre text,
  comprobante_tipo text,
  comprobante_tamano_bytes bigint,

  -- Origen (cuando el pago se cargó desde un mensaje de chatter)
  mensaje_origen_id uuid,
  chatter_origen_id uuid REFERENCES public.chatter(id) ON DELETE SET NULL,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT presupuesto_pagos_monto_check CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS presupuesto_pagos_presupuesto_idx
  ON public.presupuesto_pagos USING btree (presupuesto_id);

CREATE INDEX IF NOT EXISTS presupuesto_pagos_cuota_idx
  ON public.presupuesto_pagos USING btree (cuota_id);

CREATE INDEX IF NOT EXISTS presupuesto_pagos_empresa_fecha_idx
  ON public.presupuesto_pagos USING btree (empresa_id, fecha_pago);

CREATE INDEX IF NOT EXISTS presupuesto_pagos_chatter_origen_idx
  ON public.presupuesto_pagos USING btree (chatter_origen_id);

ALTER TABLE public.presupuesto_pagos ENABLE ROW LEVEL SECURITY;

-- Política RLS principal (alineada con el resto del schema, usa auth.jwt())
DROP POLICY IF EXISTS rls_presupuesto_pagos_empresa ON public.presupuesto_pagos;
CREATE POLICY rls_presupuesto_pagos_empresa ON public.presupuesto_pagos
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- TABLA: config_presupuestos (configuración por empresa)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.config_presupuestos (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  impuestos jsonb NOT NULL DEFAULT '[{"id": "iva21", "label": "IVA 21%", "activo": true, "porcentaje": 21}, {"id": "iva105", "label": "IVA 10.5%", "activo": true, "porcentaje": 10.5}, {"id": "exento", "label": "Exento", "activo": true, "porcentaje": 0}, {"id": "no_gravado", "label": "No Gravado", "activo": true, "porcentaje": 0}]'::jsonb,

  monedas jsonb NOT NULL DEFAULT '[{"id": "ARS", "label": "Peso Argentino", "activo": true, "simbolo": "$"}, {"id": "USD", "label": "Dólar", "activo": true, "simbolo": "US$"}, {"id": "EUR", "label": "Euro", "activo": true, "simbolo": "€"}]'::jsonb,
  moneda_predeterminada text NOT NULL DEFAULT 'ARS',

  condiciones_pago jsonb NOT NULL DEFAULT '[{"id": "contado", "tipo": "plazo_fijo", "hitos": [], "label": "Contado", "notaPlanPago": "Pago al contado", "predeterminado": false, "diasVencimiento": 0}, {"id": "15dias", "tipo": "plazo_fijo", "hitos": [], "label": "15 días", "notaPlanPago": "Pago dentro de 15 días", "predeterminado": false, "diasVencimiento": 15}, {"id": "30dias", "tipo": "plazo_fijo", "hitos": [], "label": "30 días", "notaPlanPago": "Pago dentro de 30 días", "predeterminado": true, "diasVencimiento": 30}, {"id": "50_50", "tipo": "hitos", "hitos": [{"id": "h1", "porcentaje": 50, "descripcion": "Adelanto", "diasDesdeEmision": 0}, {"id": "h2", "porcentaje": 50, "descripcion": "Al finalizar", "diasDesdeEmision": 0}], "label": "50% adelanto + 50% al finalizar", "predeterminado": false, "diasVencimiento": 0}]'::jsonb,
  dias_vencimiento_predeterminado integer NOT NULL DEFAULT 30,

  condiciones_predeterminadas text,
  notas_predeterminadas text,

  unidades jsonb NOT NULL DEFAULT '[{"id": "un", "label": "Unidad", "abreviatura": "un"}, {"id": "hs", "label": "Hora", "abreviatura": "hs"}, {"id": "kg", "label": "Kilogramo", "abreviatura": "kg"}, {"id": "m", "label": "Metro", "abreviatura": "m"}, {"id": "m2", "label": "Metro cuadrado", "abreviatura": "m²"}, {"id": "lt", "label": "Litro", "abreviatura": "lt"}, {"id": "gl", "label": "Global", "abreviatura": "gl"}]'::jsonb,

  columnas_lineas_default jsonb DEFAULT '["producto", "descripcion", "cantidad", "unidad", "precio_unitario", "descuento", "impuesto", "subtotal"]'::jsonb,

  plantillas jsonb NOT NULL DEFAULT '[]'::jsonb,
  plantillas_predeterminadas jsonb NOT NULL DEFAULT '{}'::jsonb,

  membrete jsonb DEFAULT '{"ancho_logo": 30, "mostrar_logo": true, "tamano_texto": 14, "posicion_logo": "izquierda", "contenido_html": "", "alineacion_texto": "izquierda", "linea_separadora": true}'::jsonb,
  pie_pagina jsonb DEFAULT '{"columnas": {"centro": {"tipo": "vacio"}, "derecha": {"tipo": "numeracion"}, "izquierda": {"tipo": "texto", "texto": ""}}, "tamano_texto": 10, "linea_superior": true}'::jsonb,
  plantilla_html text,

  patron_nombre_pdf text DEFAULT '{numero} - {contacto_nombre}'::text,

  datos_empresa_pdf jsonb DEFAULT '{"mostrar_correo": true, "datos_bancarios": {"cbu": "", "alias": "", "banco": "", "titular": ""}, "mostrar_telefono": true, "mostrar_direccion": true, "mostrar_pagina_web": false, "mostrar_razon_social": true, "mostrar_identificacion": true, "mostrar_datos_bancarios": false, "mostrar_condicion_fiscal": true}'::jsonb,

  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_config_presupuestos_empresa ON public.config_presupuestos;
CREATE POLICY rls_config_presupuestos_empresa ON public.config_presupuestos
  FOR ALL
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid)
  WITH CHECK (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- =============================================================================
-- FUNCIÓN: recalcular_estado_cuota(uuid)
-- =============================================================================
-- Recalcula el estado de una cuota a partir de los pagos imputados.
-- VERSIÓN BASELINE — NO incluye filtro `AND es_adicional = false` (eso lo
-- agrega 20260426030000_check_adicional_y_funcion_estado_cuota).
CREATE OR REPLACE FUNCTION public.recalcular_estado_cuota(p_cuota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Suma todos los pagos imputados a esta cuota.
  SELECT
    COALESCE(SUM(monto_en_moneda_presupuesto), 0),
    MAX(fecha_pago),
    (SELECT creado_por_nombre FROM public.presupuesto_pagos
       WHERE cuota_id = p_cuota_id
       ORDER BY fecha_pago DESC LIMIT 1)
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
$function$;


-- =============================================================================
-- FUNCIÓN: trigger_recalcular_cuotas_pago()
-- =============================================================================
-- Wrapper de trigger sobre presupuesto_pagos. Ejecuta recalcular_estado_cuota()
-- para la cuota afectada en cada INSERT/UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.trigger_recalcular_cuotas_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_estado_cuota(NEW.cuota_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
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
$function$;


-- =============================================================================
-- FUNCIÓN: actualizar_conteo_producto_estado()
-- =============================================================================
-- Trigger sobre presupuestos.estado: cuando un presupuesto entra o sale del
-- grupo "vendido" (confirmado_cliente / orden_venta), incrementa o decrementa
-- los contadores `veces_vendido` y `vendido_anual` en cada producto referenciado
-- por sus líneas.
CREATE OR REPLACE FUNCTION public.actualizar_conteo_producto_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_anio text;
  v_delta int;
  rec RECORD;
BEGIN
  -- Solo nos interesa cambio de estado
  IF OLD.estado = NEW.estado THEN RETURN NEW; END IF;

  v_anio := EXTRACT(YEAR FROM NEW.fecha_emision)::text;

  -- Determinar si entró o salió de estado "vendido"
  DECLARE
    era_vendido boolean := OLD.estado IN ('confirmado_cliente', 'orden_venta');
    es_vendido boolean := NEW.estado IN ('confirmado_cliente', 'orden_venta');
  BEGIN
    IF era_vendido = es_vendido THEN RETURN NEW; END IF;

    v_delta := CASE WHEN es_vendido THEN 1 ELSE -1 END;

    -- Actualizar todos los productos referenciados en las líneas
    FOR rec IN
      SELECT DISTINCT codigo_producto
      FROM lineas_presupuesto
      WHERE presupuesto_id = NEW.id
        AND tipo_linea = 'producto'
        AND codigo_producto IS NOT NULL
        AND codigo_producto != ''
    LOOP
      UPDATE productos SET
        veces_vendido = GREATEST(veces_vendido + v_delta, 0),
        vendido_anual = jsonb_set(
          vendido_anual,
          ARRAY[v_anio],
          to_jsonb(GREATEST(COALESCE((vendido_anual->>v_anio)::int, 0) + v_delta, 0))
        )
      WHERE empresa_id = NEW.empresa_id AND codigo = rec.codigo_producto;
    END LOOP;
  END;

  RETURN NEW;
END;
$function$;


-- =============================================================================
-- TRIGGERS (idempotentes vía DROP + CREATE)
-- =============================================================================

-- presupuesto_pagos: recalcular estado de cuotas en INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS presupuesto_pagos_recalcular_cuotas ON public.presupuesto_pagos;
CREATE TRIGGER presupuesto_pagos_recalcular_cuotas
AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_pagos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalcular_cuotas_pago();

-- presupuestos: contadores de productos al cambiar de estado
DROP TRIGGER IF EXISTS trg_conteo_producto_estado ON public.presupuestos;
CREATE TRIGGER trg_conteo_producto_estado
AFTER UPDATE ON public.presupuestos
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_conteo_producto_estado();
