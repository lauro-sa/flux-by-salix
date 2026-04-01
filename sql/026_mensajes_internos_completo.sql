-- Migración: sistema completo de mensajes internos
-- Tabla de lecturas (read receipts), canal_id nullable ya aplicado en 025

-- Tabla de lecturas de mensajes (read receipts estilo WhatsApp)
CREATE TABLE IF NOT EXISTS mensaje_lecturas (
  mensaje_id UUID NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  leido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mensaje_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS mensaje_lecturas_mensaje_idx ON mensaje_lecturas(mensaje_id);
CREATE INDEX IF NOT EXISTS mensaje_lecturas_usuario_idx ON mensaje_lecturas(usuario_id);
