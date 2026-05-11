-- =============================================================
-- Migración 066: Tabla actividades_relaciones (sub-PR 20.2)
-- =============================================================
-- Vínculos N:M entre actividades y entidades relacionables. Reemplaza
-- el legacy `actividades.actividad_origen_id` (FK directa a una sola
-- entidad madre, sub-PR 20.3 lo elimina) y desplaza la query sobre
-- `actividades.vinculos` jsonb cuando workflows necesitan resolver
-- "actividades de esta visita / orden / presupuesto".
--
-- Usada por:
--   - Auto-enriquecimiento desde `crear_actividad` (sub-PR 20.2): cuando
--     un flujo crea una actividad, el ejecutor inserta acá la fila que
--     vincula la nueva actividad con la entidad disparadora del flujo
--     (ej: visita → actividad creada queda vinculada a la visita).
--   - Resolver de `completar_actividad.criterio.relacionada_a` (también
--     sub-PR 20.2): el ejecutor usa esta tabla para filtrar qué
--     actividades coinciden con `{ entidad_tipo, entidad_id }`.
--
-- Set cerrado de `entidad_tipo` definido en TS (`EntidadRelacionable` en
-- `src/tipos/actividades-relaciones.ts`). El SQL queda como `text` sin
-- CHECK constraint — convención del proyecto (cambios_estado,
-- notificaciones, workflows: narrowing en TS, no SQL).
--
-- Auditoría: NO entra a la convención de `auditoria_*`. Razones:
--   1. La tabla solo soporta INSERT y DELETE (cascade); no hay edición.
--   2. La auditoría real vive en dos planos:
--      - `auditoria_actividades` cubre la actividad padre.
--      - `chatter.metadata.detalles` cubre la trazabilidad inversa
--        "qué flujo creó esta relación" cuando viene del motor.
--   3. No existe en el proyecto el patrón "trigger AFTER INSERT/DELETE
--      → auditoria". Sumarlo sería el primer caso. Desvío de convención.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.actividades_relaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL
    REFERENCES public.empresas(id) ON DELETE CASCADE,
  actividad_id uuid NOT NULL
    REFERENCES public.actividades(id) ON DELETE CASCADE,
  entidad_tipo text NOT NULL,
  entidad_id uuid NOT NULL,
  -- uuid suelto SIN FK — convención del proyecto (actividades.creado_por,
  -- flujos.creado_por, auditoria_flujos.editado_por: todos uuid sin
  -- REFERENCES). El borrado de un usuario en auth.users NO toca este
  -- registro: el uuid queda huérfano legible, que es el comportamiento
  -- deseado para auditoría histórica.
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Idempotencia: re-insertar la misma vinculación no duplica fila.
-- INSERT ... ON CONFLICT DO NOTHING en backend confía en este UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS actividades_relaciones_unique_idx
  ON public.actividades_relaciones (empresa_id, actividad_id, entidad_tipo, entidad_id);

-- Lookup "actividades de esta entidad X" (criterio.relacionada_a).
CREATE INDEX IF NOT EXISTS actividades_relaciones_entidad_idx
  ON public.actividades_relaciones (empresa_id, entidad_tipo, entidad_id);

-- Lookup inverso "entidades vinculadas a esta actividad" (UI / chatter).
CREATE INDEX IF NOT EXISTS actividades_relaciones_actividad_idx
  ON public.actividades_relaciones (empresa_id, actividad_id);

-- RLS multi-tenant — usa empresa_actual() como el resto del módulo
-- Flujos (sql/054). Bypass de superadmin se hace vía service_role
-- desde el backend; no requiere policy especial (convención del proyecto).
ALTER TABLE public.actividades_relaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actividades_relaciones_select" ON public.actividades_relaciones
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "actividades_relaciones_insert" ON public.actividades_relaciones
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "actividades_relaciones_update" ON public.actividades_relaciones
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "actividades_relaciones_delete" ON public.actividades_relaciones
  FOR DELETE USING (empresa_id = empresa_actual());

COMMENT ON TABLE public.actividades_relaciones IS
  'Vínculos N:M actividad ↔ entidad relacionable (sub-PR 20.2). Reemplaza '
  'actividad_origen_id (FK directa, una sola entidad madre, eliminada en 20.3) '
  'y desplaza la query sobre actividades.vinculos jsonb cuando workflows '
  'resuelven completar_actividad.criterio.relacionada_a. Set cerrado de '
  'entidad_tipo en TS (EntidadRelacionable). Auditoría: NO entra a auditoria_* '
  '— solo INSERT/DELETE, sin edición; la auditoría real vive en '
  'auditoria_actividades (entidad padre) + chatter.metadata.detalles '
  '(trazabilidad de qué flujo agregó la relación).';

COMMENT ON COLUMN public.actividades_relaciones.entidad_tipo IS
  'Set cerrado en TS (EntidadRelacionable): contacto, presupuesto, orden, '
  'visita, conversacion, asistencia, cuota, actividad, adelanto_nomina, '
  'pago_nomina. Sin CHECK constraint en SQL — narrowing en TS, mismo patrón '
  'que cambios_estado.entidad_tipo y notificaciones.referencia_tipo.';

COMMENT ON COLUMN public.actividades_relaciones.creado_por IS
  'uuid del usuario que creó la relación. Sin FK — convención del proyecto '
  '(ver actividades.creado_por, flujos.creado_por, auditoria_flujos.editado_por). '
  'NULL para creaciones automáticas por flujo (sin usuario humano detrás). '
  'Si el usuario se elimina en auth.users, este uuid queda como huérfano '
  'legible — comportamiento deseado para auditoría histórica.';
