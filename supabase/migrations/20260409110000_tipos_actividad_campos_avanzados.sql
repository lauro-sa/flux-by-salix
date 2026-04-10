-- Campos avanzados para tipos de actividad: defaults y encadenamiento

-- Resumen/nota predeterminada al crear
ALTER TABLE tipos_actividad
  ADD COLUMN IF NOT EXISTS resumen_predeterminado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_predeterminada text DEFAULT NULL;

-- Usuario predeterminado (auto-asignar al crear)
ALTER TABLE tipos_actividad
  ADD COLUMN IF NOT EXISTS usuario_predeterminado uuid DEFAULT NULL;

-- Encadenamiento: siguiente actividad al completar
ALTER TABLE tipos_actividad
  ADD COLUMN IF NOT EXISTS siguiente_tipo_id uuid DEFAULT NULL REFERENCES tipos_actividad(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_encadenamiento text DEFAULT 'sugerir' CHECK (tipo_encadenamiento IN ('sugerir', 'activar'));
