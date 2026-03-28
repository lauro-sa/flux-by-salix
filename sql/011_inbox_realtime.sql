-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 011: Habilitar Supabase Realtime para Inbox
-- Permite que mensajes y conversaciones se actualicen en vivo.
-- ═══���═══════════════════════════════════════════════════════════

-- Habilitar REPLICA IDENTITY FULL para que Realtime envíe el row completo
ALTER TABLE mensajes REPLICA IDENTITY FULL;
ALTER TABLE conversaciones REPLICA IDENTITY FULL;
ALTER TABLE mensaje_adjuntos REPLICA IDENTITY FULL;

-- Agregar tablas a la publicación de Supabase Realtime
-- (Supabase usa esta publicación para escuchar cambios)
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
ALTER PUBLICATION supabase_realtime ADD TABLE conversaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE mensaje_adjuntos;
