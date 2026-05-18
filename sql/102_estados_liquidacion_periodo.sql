-- =============================================================
-- Migración 102: Estados configurables de liquidación de período
-- =============================================================
-- FSM del período completo (no por empleado). Un período tiene una
-- sola fila en liquidaciones_periodo con uno de estos estados.
--
-- Estados sistema:
--   - abierto: período en curso o vencido pero aún editable.
--   - cerrado: bloqueado para edición. Se requiere reabrir explícito
--     (con motivo) para tocarlo. El cierre lo dispara el operador
--     manualmente desde el CTA del hero cuando todos los empleados
--     están en estado 'pagado'.
--
-- Sigue el mismo patrón que estados_pago_nomina (sql/052):
--   tabla configurable por empresa, RLS multi-tenant, semilla
--   de estados sistema con empresa_id=NULL.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.estados_liquidacion_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,
  etiqueta text NOT NULL,
  grupo text NOT NULL DEFAULT 'activo',
  icono text NOT NULL DEFAULT 'Circle',
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estados_liquidacion_periodo_empresa_idx
  ON public.estados_liquidacion_periodo (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_liquidacion_periodo_unique_idx
  ON public.estados_liquidacion_periodo (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_liquidacion_periodo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estados_liquidacion_periodo_select" ON public.estados_liquidacion_periodo
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_liquidacion_periodo_insert" ON public.estados_liquidacion_periodo
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_liquidacion_periodo_update" ON public.estados_liquidacion_periodo
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_liquidacion_periodo_delete" ON public.estados_liquidacion_periodo
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

-- ─── Estados sistema ─────────────────────────────────────────
INSERT INTO public.estados_liquidacion_periodo
  (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'abierto', 'Abierto', 'activo',     'CircleDot',  '#3b82f6', 1, true),
  (NULL, 'cerrado', 'Cerrado', 'completado', 'Lock',       '#16a34a', 2, true)
ON CONFLICT DO NOTHING;

-- ─── Transiciones legales ────────────────────────────────────
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Cerrar período: manual obligatorio (el operador clickea cuando todos
  -- los empleados están pagados). NO automático aunque la condición se
  -- cumpla — el cierre tiene side-effects contables.
  (NULL, 'liquidacion_periodo', 'abierto', 'cerrado', 'Cerrar período',  false, false, 1),
  -- Reabrir: requiere motivo siempre porque está rompiendo un cierre
  -- contable previo. Va al audit log con la justificación.
  (NULL, 'liquidacion_periodo', 'cerrado', 'abierto', 'Reabrir período', false, true,  2)
ON CONFLICT DO NOTHING;

-- ─── Helper resolver ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolver_estado_liquidacion_periodo_id(
  p_empresa_id uuid, p_clave text
) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.estados_liquidacion_periodo
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_estado_liquidacion_periodo_id(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolver_estado_liquidacion_periodo_id(uuid, text) TO authenticated, service_role;
