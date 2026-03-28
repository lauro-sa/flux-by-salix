-- ============================================================
-- Migración 014: Permitir adjuntos sin mensaje (borradores)
-- Necesario para subir adjuntos antes de enviar el correo.
-- Se linkean al mensaje después del envío.
-- ============================================================

-- Permitir NULL en mensaje_id para adjuntos de borrador
ALTER TABLE mensaje_adjuntos
  ALTER COLUMN mensaje_id DROP NOT NULL;

-- Los adjuntos huérfanos (sin mensaje_id) más viejos de 24h se pueden limpiar con un cron
CREATE INDEX IF NOT EXISTS idx_adjuntos_huerfanos
  ON mensaje_adjuntos (creado_en)
  WHERE mensaje_id IS NULL;
