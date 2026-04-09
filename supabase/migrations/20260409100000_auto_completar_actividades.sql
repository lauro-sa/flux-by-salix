-- Auto-completar actividades: cuando se ejecuta la acción del tipo desde la actividad
-- y se guarda exitosamente el documento, la actividad se marca como completada.

-- Campo en tipos_actividad para habilitar/deshabilitar auto-completar
ALTER TABLE tipos_actividad
  ADD COLUMN IF NOT EXISTS auto_completar boolean NOT NULL DEFAULT false;

-- Activar por defecto en tipos que generan documentos rastreables
UPDATE tipos_actividad
  SET auto_completar = true
  WHERE clave IN ('presupuestar', 'visita')
    AND es_predefinido = true;
