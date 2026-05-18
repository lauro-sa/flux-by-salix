-- =============================================================
-- Migración 104: Tabla liquidaciones_periodo
-- =============================================================
-- Persiste el estado del PERÍODO completo (abierto/cerrado). Es la
-- FSM "macro": una sola fila por (empresa, período). Diferente de
-- liquidaciones_empleado_periodo que tiene una fila por empleado.
--
-- Se crea lazy: la primera vez que el operador entra al período (o
-- liquida al primer empleado), un upsert genera la fila en estado
-- 'abierto'. El cierre es manual desde la UI.
--
-- IMPORTANTE — UNIQUE con empresa_id explícito:
-- Aunque (periodo_inicio, periodo_fin) podrían ser únicos por empresa,
-- incluimos empresa_id en el UNIQUE como defensa en profundidad. Si
-- alguna vez se importa data cruzada o se desactiva RLS en una
-- migración, evita colisiones silenciosas entre tenants.
--
-- IMPORTANTE — Soft-delete de miembros:
-- Esta tabla NO referencia miembros. Las consultas que listan
-- empleados de un período deben respetar miembros.activo del
-- momento del período (no el actual), por eso el módulo de motor
-- también lee `liquidaciones_empleado_periodo.snapshot_calculo`
-- como verdad histórica cuando el empleado fue dado de baja después.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.liquidaciones_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,

  -- Estado configurable (sistema de estados sql/044)
  estado text NOT NULL DEFAULT 'abierto',
  estado_id uuid REFERENCES public.estados_liquidacion_periodo(id),
  estado_clave text NOT NULL DEFAULT 'abierto',
  estado_anterior_id uuid REFERENCES public.estados_liquidacion_periodo(id),
  estado_cambio_at timestamptz,

  -- Auditoría del ciclo de vida
  abierto_en timestamptz NOT NULL DEFAULT now(),
  abierto_por uuid,
  abierto_por_nombre text,
  cerrado_en timestamptz,
  cerrado_por uuid,
  cerrado_por_nombre text,
  motivo_cierre text,
  motivo_reapertura text,

  -- Audit estándar
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid,

  CONSTRAINT liquidaciones_periodo_rango_valido
    CHECK (periodo_fin >= periodo_inicio)
);

-- UNIQUE con empresa_id explícito (defensa en profundidad).
CREATE UNIQUE INDEX IF NOT EXISTS liquidaciones_periodo_unique_idx
  ON public.liquidaciones_periodo (empresa_id, periodo_inicio, periodo_fin);

-- Búsqueda por estado dentro de empresa (ej: "abiertos vencidos").
CREATE INDEX IF NOT EXISTS liquidaciones_periodo_estado_idx
  ON public.liquidaciones_periodo (empresa_id, estado_clave, periodo_inicio DESC);

-- RLS multi-tenant
ALTER TABLE public.liquidaciones_periodo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liquidaciones_periodo_select" ON public.liquidaciones_periodo
  FOR SELECT USING (empresa_id = empresa_actual());
CREATE POLICY "liquidaciones_periodo_insert" ON public.liquidaciones_periodo
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "liquidaciones_periodo_update" ON public.liquidaciones_periodo
  FOR UPDATE USING (empresa_id = empresa_actual());

-- ─── Trigger BEFORE: sincronizar estado/estado_clave/estado_id ───
CREATE OR REPLACE FUNCTION public.tr_liquidacion_periodo_sincronizar_estado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_clave text;
  v_id_resuelto uuid;
BEGIN
  -- Determinar la clave canónica.
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado, 'abierto');
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

  v_id_resuelto := public.resolver_estado_liquidacion_periodo_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_liquidacion_periodo_sincronizar_estado: clave de estado inválida: %', v_clave;
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

DROP TRIGGER IF EXISTS liquidacion_periodo_sincronizar_estado ON public.liquidaciones_periodo;
CREATE TRIGGER liquidacion_periodo_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.liquidaciones_periodo
  FOR EACH ROW EXECUTE FUNCTION public.tr_liquidacion_periodo_sincronizar_estado();

-- ─── Trigger AFTER: registrar cambio en cambios_estado ───────
CREATE OR REPLACE FUNCTION public.tr_liquidacion_periodo_registrar_cambio()
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

  SELECT grupo INTO v_grupo_anterior FROM public.estados_liquidacion_periodo WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_liquidacion_periodo WHERE id = NEW.estado_id;

  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'liquidacion_periodo',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => 'manual',
    p_usuario_id      => v_usuario_id,
    p_motivo          => COALESCE(NEW.motivo_cierre, NEW.motivo_reapertura),
    p_metadatos       => jsonb_build_object(
      'periodo_inicio', NEW.periodo_inicio,
      'periodo_fin',    NEW.periodo_fin
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS liquidacion_periodo_registrar_cambio ON public.liquidaciones_periodo;
CREATE TRIGGER liquidacion_periodo_registrar_cambio
  AFTER UPDATE ON public.liquidaciones_periodo
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_liquidacion_periodo_registrar_cambio();

COMMENT ON TABLE public.liquidaciones_periodo IS
  'FSM del período completo (abierto/cerrado). Una fila por (empresa, periodo). Se crea lazy al primer acceso. El cierre es manual y require que todos los empleados activos del período estén en estado pagado (validado en /api/nominas/cerrar-periodo).';
