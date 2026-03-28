-- ============================================================
-- Migración 012: Soporte de sincronización de correo
-- Agrega columna sync_cursor a canales_inbox para tracking
-- de sincronización incremental (historyId para Gmail, UID para IMAP)
-- ============================================================

-- Cursor de sincronización por canal
-- Estructura: { historyId?: string, ultimoUID?: number, ultimaSincronizacion?: string }
ALTER TABLE canales_inbox
  ADD COLUMN IF NOT EXISTS sync_cursor jsonb DEFAULT '{}';

-- Índice para buscar canales activos de correo (usado por el cron)
CREATE INDEX IF NOT EXISTS idx_canales_inbox_correo_activo
  ON canales_inbox (empresa_id, tipo, activo)
  WHERE tipo = 'correo' AND activo = true;
