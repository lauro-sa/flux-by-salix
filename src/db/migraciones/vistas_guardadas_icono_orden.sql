-- Migración: enriquecer vistas_guardadas con icono, orden y flag de sistema.
-- - icono: emoji para identificar la vista visualmente (📧, ⭐, etc.)
-- - orden: posición para drag-and-drop del usuario
-- - es_sistema: vistas predefinidas que vienen del módulo (no creadas por el usuario)
--   → permiten separador visual entre "Sistema" y "Personales"

ALTER TABLE vistas_guardadas
  ADD COLUMN IF NOT EXISTS icono text,
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;

-- Índice para ordenar eficientemente
CREATE INDEX IF NOT EXISTS vistas_guardadas_orden_idx
  ON vistas_guardadas(usuario_id, empresa_id, modulo, orden);
