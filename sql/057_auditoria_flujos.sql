-- =============================================================
-- Migración 057: Tabla auditoria_flujos (PR 18.1)
-- =============================================================
-- Cumple la regla de feedback_auditoria_tablas.md: toda tabla nueva
-- (o que pasa a tener edición visible al usuario) debe tener su tabla
-- de auditoría con campos { editado_por, campo_modificado, valor_*,
-- motivo, creado_en } más RLS multi-tenant + índices.
--
-- Diferencia con auditoria_plantillas_correo (de la que tomamos el
-- patrón): la FK `flujo_id` se borra con `ON DELETE SET NULL`, no
-- CASCADE. Razón explícita (decisión del usuario al revisar el plan
-- de PR 18):
--
--   Un flujo puede haber enviado WhatsApp / correo / cambios de
--   estado a clientes reales antes de ser eliminado. Si CASCADE,
--   el log de "se eliminó este flujo" desaparecería en la misma
--   transacción que crea ese log → cero trazabilidad post-delete.
--   La inconsistencia con plantillas_correo es aceptable: ahí no
--   hay efecto sobre clientes, acá sí.
--
-- Las filas históricas con flujo_id = NULL siguen siendo legibles
-- (la entidad ya no existe pero el evento sí). El listado por flujo
-- sigue funcionando: WHERE flujo_id = X devuelve solo las que tienen
-- ese FK, y los reportes globales por empresa se filtran por
-- empresa_id sin importar el flujo_id.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.auditoria_flujos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- SET NULL deliberado: ver header. Nunca CASCADE para esta tabla.
  flujo_id uuid REFERENCES public.flujos(id) ON DELETE SET NULL,

  editado_por uuid NOT NULL,

  -- Qué cambió. Patrón mixto: campos físicos de la fila (`nombre`,
  -- `descripcion`, `disparador`, `condiciones`, `acciones`,
  -- `nodos_json`) + acciones operacionales que merecen log
  -- propio (`publicar`, `descartar_borrador`, `activar`, `pausar`,
  -- `eliminacion`). Validado en TS al insertar, no por CHECK SQL
  -- (consistente con cambios_estado y ejecuciones_flujo).
  campo_modificado text NOT NULL,

  -- Serializado a texto. Para jsonb se guarda el JSON.stringify del
  -- valor — la UI re-parsea cuando muestra diff bonito.
  valor_anterior text,
  valor_nuevo text,

  -- Motivo opcional pasado por el usuario (ej: "pausado por
  -- mantenimiento de plantilla Meta").
  motivo text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- Listado por flujo puntual (lo que muestra IndicadorEditado en la
-- TablaDinamica y el panel del flujo). Filtro parcial mantiene el
-- índice chico cuando hay rows con flujo_id NULL post-delete.
CREATE INDEX IF NOT EXISTS auditoria_flujos_por_flujo_idx
  ON public.auditoria_flujos (flujo_id, creado_en DESC)
  WHERE flujo_id IS NOT NULL;

-- Reportes globales por empresa (auditoría general).
CREATE INDEX IF NOT EXISTS auditoria_flujos_por_empresa_idx
  ON public.auditoria_flujos (empresa_id, creado_en DESC);

-- RLS multi-tenant --
ALTER TABLE public.auditoria_flujos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_flujos_select" ON public.auditoria_flujos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "auditoria_flujos_insert" ON public.auditoria_flujos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

-- Sin policies de UPDATE ni DELETE: la auditoría es inmutable. Si
-- una empresa quiere purgar histórico se hace con service_role
-- offline, igual que ejecuciones_flujo.

COMMENT ON TABLE public.auditoria_flujos IS
  'Auditoría de cambios sobre la tabla flujos (PR 18). Inmutable. flujo_id usa ON DELETE SET NULL para preservar el log post-eliminación: un flujo puede haber enviado WhatsApp / correo a clientes reales antes de borrarse, ese registro tiene que sobrevivir a la eliminación.';

COMMENT ON COLUMN public.auditoria_flujos.campo_modificado IS
  'Mix de campos físicos (nombre, descripcion, disparador, condiciones, acciones, nodos_json) y acciones operacionales (publicar, descartar_borrador, activar, pausar, eliminacion). Validado en TS al insertar.';

COMMENT ON COLUMN public.auditoria_flujos.flujo_id IS
  'FK a flujos.id con ON DELETE SET NULL. NULL = el flujo fue eliminado pero el log se conserva. Para listado por flujo se filtra WHERE flujo_id IS NOT NULL.';
