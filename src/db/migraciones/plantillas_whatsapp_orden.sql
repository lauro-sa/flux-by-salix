-- Migración: campo de orden para reordenamiento drag-and-drop en plantillas de WhatsApp
ALTER TABLE plantillas_whatsapp
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS plantillas_whatsapp_orden_idx
  ON plantillas_whatsapp(empresa_id, canal_id, orden);
