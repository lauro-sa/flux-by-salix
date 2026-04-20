-- Deduplicación atómica de notificaciones vía índice único parcial.
-- Previene race conditions cuando dos requests casi simultáneos intentan
-- crear la misma notificación (mismo usuario + misma referencia, no leída).
-- Los inserts concurrentes fallarán en uno de los dos con unique_violation,
-- garantizando una única fila en DB sin depender de SELECT+INSERT.

CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_dedup_no_leida_idx
ON notificaciones (empresa_id, usuario_id, referencia_tipo, referencia_id)
WHERE leida = false
  AND referencia_tipo IS NOT NULL
  AND referencia_id IS NOT NULL;
