-- Migración: hacer canal_id nullable en conversaciones
-- para soportar conversaciones de canales internos (que no tienen canal_inbox)
ALTER TABLE conversaciones ALTER COLUMN canal_id DROP NOT NULL;
