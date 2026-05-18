-- =============================================================
-- Migración 103: Estados configurables de liquidación por empleado
-- =============================================================
-- FSM por empleado dentro de cada período. Cada (período × empleado)
-- tiene una sola fila en liquidaciones_empleado_periodo. Si la fila
-- no existe, el estado virtual es 'borrador' (cálculo en vivo).
--
-- Estados sistema:
--   - borrador:  cálculo en vivo, nada congelado.
--   - liquidado: snapshot del cálculo congelado, esperando envío/pago.
--   - enviado:   recibo enviado al empleado por WhatsApp/correo. Es
--                opcional — si la empresa no requiere envío obligatorio
--                (toggle empresas.nominas_envio_obligatorio), se puede
--                ir directo de liquidado a pagado.
--   - pagado:    transferencia/efectivo ejecutado. Side-effect: en la
--                misma tx se crea la fila en pagos_nomina.
--
-- pagado es estado terminal: no hay transición saliente desde la UI.
-- Si hay que reversar, se hace con contra-entrada (otro pago negativo
-- o anulación lógica), no editando el pago original.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.estados_liquidacion_empleado (
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

CREATE INDEX IF NOT EXISTS estados_liquidacion_empleado_empresa_idx
  ON public.estados_liquidacion_empleado (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_liquidacion_empleado_unique_idx
  ON public.estados_liquidacion_empleado (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_liquidacion_empleado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estados_liquidacion_empleado_select" ON public.estados_liquidacion_empleado
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_liquidacion_empleado_insert" ON public.estados_liquidacion_empleado
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_liquidacion_empleado_update" ON public.estados_liquidacion_empleado
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_liquidacion_empleado_delete" ON public.estados_liquidacion_empleado
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

-- ─── Estados sistema ─────────────────────────────────────────
-- 'borrador' está seeded aunque normalmente no hay filas con ese
-- estado (es virtual). Existe en la tabla para que el sistema de
-- workflows pueda referenciarlo en triggers ("cuando un empleado
-- pasa de borrador a liquidado, enviar email a HR").
INSERT INTO public.estados_liquidacion_empleado
  (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'borrador',  'Borrador',  'inicial',    'FilePen',     '#64748b', 1, true),
  (NULL, 'liquidado', 'Liquidado', 'activo',     'FileCheck',   '#3b82f6', 2, true),
  (NULL, 'enviado',   'Enviado',   'activo',     'Send',        '#0ea5e9', 3, true),
  (NULL, 'pagado',    'Pagado',    'completado', 'CircleCheck', '#16a34a', 4, true)
ON CONFLICT DO NOTHING;

-- ─── Transiciones legales ────────────────────────────────────
-- Flujo principal:  borrador → liquidado → [enviado] → pagado
-- Reversos permitidos hasta enviado. Pagado es terminal por UI.
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Avance
  (NULL, 'liquidacion_empleado', 'borrador',  'liquidado', 'Liquidar',           false, false, 1),
  (NULL, 'liquidacion_empleado', 'liquidado', 'enviado',   'Marcar enviado',     false, false, 2),
  (NULL, 'liquidacion_empleado', 'liquidado', 'pagado',    'Registrar pago',     false, false, 3),
  (NULL, 'liquidacion_empleado', 'enviado',   'pagado',    'Registrar pago',     false, false, 4),
  -- Reversos (requieren motivo — la UI los muestra como "Desliquidar" /
  -- "Volver a liquidado" con warning).
  (NULL, 'liquidacion_empleado', 'liquidado', 'borrador',  'Desliquidar',        false, true,  5),
  (NULL, 'liquidacion_empleado', 'enviado',   'liquidado', 'Volver a liquidado', false, true,  6)
  -- pagado → * NO se siembra. Para revertir un pago, se crea una
  -- contra-entrada en pagos_nomina o se anula lógicamente. La UI
  -- no expone reverso porque es operación contable, no de flujo.
ON CONFLICT DO NOTHING;

-- ─── Helper resolver ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolver_estado_liquidacion_empleado_id(
  p_empresa_id uuid, p_clave text
) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.estados_liquidacion_empleado
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_estado_liquidacion_empleado_id(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolver_estado_liquidacion_empleado_id(uuid, text) TO authenticated, service_role;
