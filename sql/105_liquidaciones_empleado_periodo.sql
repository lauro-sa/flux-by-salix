-- =============================================================
-- Migración 105: Tabla liquidaciones_empleado_periodo
-- =============================================================
-- FSM por empleado dentro de un período (borrador → liquidado →
-- [enviado] → pagado). Una fila por (miembro, período) cuando se
-- promueve de borrador a liquidado. Si no existe fila, el estado
-- virtual es 'borrador' (cálculo en vivo, sin nada congelado).
--
-- Side-effect crítico al pasar a 'pagado':
--   - En la MISMA transacción se inserta la fila en pagos_nomina
--     (que mantiene su semántica de "evento financiero del pago").
--   - Esta tabla guarda el snapshot del cálculo + audit del proceso.
--   - pagos_nomina sigue siendo el ledger del dinero efectivamente
--     transferido / pagado.
--
-- IMPORTANTE — UNIQUE con empresa_id (defensa en profundidad):
-- Aunque miembro_id ya es único por empresa via miembros, incluir
-- empresa_id evita problemas si en el futuro hay transferencias
-- de miembros entre empresas o duplicación. Costo: 0.
--
-- IMPORTANTE — Soft-delete de miembros mid-período:
-- Si un miembro se da de baja DESPUÉS de tener una liquidación en
-- estado liquidado/enviado/pagado, esa fila se PRESERVA. La verdad
-- histórica está acá. El motor de cálculo del PRÓXIMO período
-- excluye al miembro dado de baja, pero las filas históricas
-- siguen visibles en la UI con badge "ex-empleado".
--
-- Esta regla es facilísima de romper: si alguien agrega un
-- WHERE miembros.activo = true a queries que listen liquidaciones
-- históricas, los reportes se rompen. NO filtrar miembros activos
-- al leer liquidaciones_empleado_periodo.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.liquidaciones_empleado_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  liquidacion_periodo_id uuid NOT NULL REFERENCES public.liquidaciones_periodo(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES public.miembros(id) ON DELETE RESTRICT,

  -- Denormalizado para queries directas sin JOIN a liquidacion_periodo.
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,

  -- Estado configurable
  estado text NOT NULL DEFAULT 'liquidado',
  estado_id uuid REFERENCES public.estados_liquidacion_empleado(id),
  estado_clave text NOT NULL DEFAULT 'liquidado',
  estado_anterior_id uuid REFERENCES public.estados_liquidacion_empleado(id),
  estado_cambio_at timestamptz,

  -- Snapshot del cálculo congelado al liquidar.
  -- Estructura esperada (versionada en version_motor):
  --   {
  --     "version_motor": "v3.0",
  --     "calculado_en": "2026-05-14T10:30:00Z",
  --     "monto_bruto": 405000,
  --     "monto_neto": 375000,
  --     "horas_netas": 8156,
  --     "dias_trabajados": 9,
  --     "dias_laborales": 10,
  --     "tardanzas": 5,
  --     "ausentes": 1,
  --     "conceptos_aplicados": [...],
  --     "adelantos_aplicados": [...],
  --     "saldo_anterior": 0,
  --     "compensacion_base": { "tipo": "por_dia", "monto": 45000 }
  --   }
  -- NULL solo en filas históricas backfilleadas (sql/106) — no se
  -- puede reconstruir el snapshot de pagos viejos con certeza.
  snapshot_calculo jsonb,

  -- Linkea al pago_nomina creado cuando se transiciona a 'pagado'.
  -- NULL hasta entonces. Es la única forma de cruzar liquidación con
  -- el ledger financiero. Si el pago se anula por contra-entrada,
  -- esta FK NO se borra (la anulación es otra fila en pagos_nomina).
  pago_nomina_id uuid REFERENCES public.pagos_nomina(id),

  -- Timestamps de cada fase
  liquidado_en timestamptz,
  liquidado_por uuid,
  liquidado_por_nombre text,
  enviado_en timestamptz,
  enviado_por uuid,
  enviado_por_nombre text,
  pagado_en timestamptz,
  pagado_por uuid,
  pagado_por_nombre text,

  -- Motivos para reversos (requeridos por las transiciones marcadas
  -- como requiere_motivo=true en sql/103).
  motivo_desliquidar text,
  motivo_volver_a_liquidado text,

  -- Audit estándar
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid,

  CONSTRAINT liquidaciones_empleado_rango_valido
    CHECK (periodo_fin >= periodo_inicio)
);

-- UNIQUE con empresa_id explícito (refinamiento A del brief).
CREATE UNIQUE INDEX IF NOT EXISTS liquidaciones_empleado_unique_idx
  ON public.liquidaciones_empleado_periodo
  (empresa_id, miembro_id, periodo_inicio, periodo_fin);

-- Búsqueda por período + estado (hot path del listado principal).
CREATE INDEX IF NOT EXISTS liquidaciones_empleado_periodo_idx
  ON public.liquidaciones_empleado_periodo
  (empresa_id, periodo_inicio, periodo_fin, estado_clave);

-- Búsqueda por miembro (historial del empleado).
CREATE INDEX IF NOT EXISTS liquidaciones_empleado_miembro_idx
  ON public.liquidaciones_empleado_periodo
  (empresa_id, miembro_id, periodo_inicio DESC);

-- Cuando se filtra por estado en toda la empresa.
CREATE INDEX IF NOT EXISTS liquidaciones_empleado_estado_idx
  ON public.liquidaciones_empleado_periodo
  (empresa_id, estado_clave, periodo_inicio DESC);

-- RLS multi-tenant
ALTER TABLE public.liquidaciones_empleado_periodo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liquidaciones_empleado_select" ON public.liquidaciones_empleado_periodo
  FOR SELECT USING (empresa_id = empresa_actual());
CREATE POLICY "liquidaciones_empleado_insert" ON public.liquidaciones_empleado_periodo
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "liquidaciones_empleado_update" ON public.liquidaciones_empleado_periodo
  FOR UPDATE USING (empresa_id = empresa_actual());

-- ─── Trigger BEFORE: sincronizar estado/clave/id ─────────────
CREATE OR REPLACE FUNCTION public.tr_liquidacion_empleado_sincronizar_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_clave text;
  v_id_resuelto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado, 'liquidado');
  ELSE
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN
      v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_clave := NEW.estado;
    ELSE
      v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;

  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  v_id_resuelto := public.resolver_estado_liquidacion_empleado_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_liquidacion_empleado_sincronizar_estado: clave inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  NEW.actualizado_en := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS liquidacion_empleado_sincronizar_estado ON public.liquidaciones_empleado_periodo;
CREATE TRIGGER liquidacion_empleado_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.liquidaciones_empleado_periodo
  FOR EACH ROW EXECUTE FUNCTION public.tr_liquidacion_empleado_sincronizar_estado();

-- ─── Trigger AFTER: registrar cambio en cambios_estado ───────
CREATE OR REPLACE FUNCTION public.tr_liquidacion_empleado_registrar_cambio()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_grupo_anterior text;
  v_grupo_nuevo text;
  v_usuario_id uuid;
BEGIN
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_anterior FROM public.estados_liquidacion_empleado WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_liquidacion_empleado WHERE id = NEW.estado_id;

  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'liquidacion_empleado',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => 'manual',
    p_usuario_id      => v_usuario_id,
    p_motivo          => COALESCE(NEW.motivo_desliquidar, NEW.motivo_volver_a_liquidado),
    p_metadatos       => jsonb_build_object(
      'miembro_id',      NEW.miembro_id,
      'periodo_inicio',  NEW.periodo_inicio,
      'periodo_fin',     NEW.periodo_fin,
      'pago_nomina_id',  NEW.pago_nomina_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS liquidacion_empleado_registrar_cambio ON public.liquidaciones_empleado_periodo;
CREATE TRIGGER liquidacion_empleado_registrar_cambio
  AFTER UPDATE ON public.liquidaciones_empleado_periodo
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_liquidacion_empleado_registrar_cambio();

COMMENT ON TABLE public.liquidaciones_empleado_periodo IS
  'FSM por empleado: borrador (virtual, sin fila) → liquidado (con snapshot) → [enviado] → pagado (con FK a pagos_nomina). pagado es terminal por UI: reversos son contra-entrada, no edición. Filas históricas se PRESERVAN aunque el miembro se dé de baja después — NO filtrar por miembros.activo al leer esta tabla.';
