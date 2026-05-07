-- Migración: Soporte de conversaciones con empleados (miembros)
-- Fecha: 2026-05-02
--
-- Permite que la tabla `conversaciones` modele tanto chats con clientes
-- (miembro_id IS NULL) como con empleados (miembro_id IS NOT NULL).
-- Es la base para unificar el flujo de WhatsApp del copilot Salix IA con
-- la bandeja principal y registrar envíos salientes (plantillas de nómina,
-- recordatorios, respuestas de IA) como `mensajes` con tracking de status.
--
-- Backfill de datos existentes en `conversaciones_salix_ia` (canal='whatsapp')
-- se ejecuta por script TypeScript aparte: scripts/backfill_conversaciones_empleados.ts

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS miembro_id UUID REFERENCES miembros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversaciones_miembro_idx
  ON conversaciones(empresa_id, tipo_canal, miembro_id);
