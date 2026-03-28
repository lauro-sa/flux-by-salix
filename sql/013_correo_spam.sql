-- ============================================================
-- Migración 013: Lista de permitidos/bloqueados para correo
-- Agrega columnas a config_inbox para gestión de spam
-- ============================================================

-- Lista de emails/dominios permitidos (siempre pasan como abierta)
ALTER TABLE config_inbox
  ADD COLUMN IF NOT EXISTS correo_lista_permitidos text[] DEFAULT '{}';

-- Lista de emails/dominios bloqueados (auto-marcan como spam)
ALTER TABLE config_inbox
  ADD COLUMN IF NOT EXISTS correo_lista_bloqueados text[] DEFAULT '{}';
