-- Migración: Agregar campos de auditoría faltantes en tablas existentes.
-- Tablas afectadas: contacto_vinculaciones, contacto_responsables, miembros_sectores,
--                   presupuesto_cuotas, fichajes_actividad.

-- ── contacto_vinculaciones ──
ALTER TABLE contacto_vinculaciones
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS creado_en timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();

-- ── contacto_responsables ──
ALTER TABLE contacto_responsables
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS creado_en timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();

-- ── miembros_sectores ──
ALTER TABLE miembros_sectores
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS creado_en timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();

-- ── presupuesto_cuotas — falta actualizado_en ──
ALTER TABLE presupuesto_cuotas
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();

-- ── fichajes_actividad — faltan timestamps de actualización ──
ALTER TABLE fichajes_actividad
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now();

-- ── Índices para reportes ──
CREATE INDEX IF NOT EXISTS idx_presupuesto_cuotas_estado_fecha
  ON presupuesto_cuotas (estado, fecha_cobro);

CREATE INDEX IF NOT EXISTS idx_fichajes_actividad_tipo
  ON fichajes_actividad (tipo);
