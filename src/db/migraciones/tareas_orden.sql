-- Migración: Tareas de órdenes de trabajo
-- Separa las tareas de OT de la tabla actividades a su propia tabla tareas_orden
-- Las tareas son entidad independiente con FK directa a ordenes_trabajo

-- ═══════════════════════════════════════════════════════════════
-- TABLA: tareas_orden
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tareas_orden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,

  titulo TEXT NOT NULL,
  descripcion TEXT,

  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, completada, cancelada
  prioridad TEXT NOT NULL DEFAULT 'normal', -- baja, normal, alta

  fecha_vencimiento TIMESTAMPTZ,
  fecha_completada TIMESTAMPTZ,

  asignados JSONB NOT NULL DEFAULT '[]',
  asignados_ids TEXT[] NOT NULL DEFAULT '{}',

  orden INTEGER NOT NULL DEFAULT 0,

  creado_por UUID NOT NULL,
  creado_por_nombre TEXT,
  editado_por UUID,
  editado_por_nombre TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  notas_cancelacion TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS tareas_orden_empresa_idx ON tareas_orden (empresa_id);
CREATE INDEX IF NOT EXISTS tareas_orden_ot_idx ON tareas_orden (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS tareas_orden_estado_idx ON tareas_orden (orden_trabajo_id, estado);
CREATE INDEX IF NOT EXISTS tareas_orden_asignados_idx ON tareas_orden USING GIN (asignados_ids);

-- RLS
ALTER TABLE tareas_orden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_orden_empresa" ON tareas_orden
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══════════════════════════════════════════════════════════════
-- MIGRAR datos existentes de actividades con es_tarea_ot = true
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tareas_orden (
  id, empresa_id, orden_trabajo_id,
  titulo, descripcion,
  estado, prioridad,
  fecha_vencimiento, fecha_completada,
  asignados, asignados_ids,
  orden,
  creado_por, creado_por_nombre,
  editado_por, editado_por_nombre,
  creado_en, actualizado_en
)
SELECT
  a.id,
  a.empresa_id,
  -- Extraer el ID de la orden de trabajo desde el array de vinculos
  (a.vinculos->0->>'id')::uuid AS orden_trabajo_id,
  a.titulo,
  a.descripcion,
  CASE
    WHEN a.estado_clave = 'completada' THEN 'completada'
    WHEN a.estado_clave = 'cancelada' THEN 'cancelada'
    ELSE 'pendiente'
  END AS estado,
  a.prioridad,
  a.fecha_vencimiento,
  a.fecha_completada,
  a.asignados,
  a.asignados_ids,
  0 AS orden,
  a.creado_por,
  a.creado_por_nombre,
  a.editado_por,
  a.editado_por_nombre,
  a.creado_en,
  a.actualizado_en
FROM actividades a
WHERE a.es_tarea_ot = true
  AND EXISTS (
    SELECT 1 FROM ordenes_trabajo ot
    WHERE ot.id = (a.vinculos->0->>'id')::uuid
  );

-- Eliminar las tareas OT migradas de la tabla actividades
DELETE FROM actividades WHERE es_tarea_ot = true;

-- Limpiar el campo es_tarea_ot de la tabla actividades
ALTER TABLE actividades DROP COLUMN IF EXISTS es_tarea_ot;
