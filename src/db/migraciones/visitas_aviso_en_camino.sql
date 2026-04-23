-- Migración: visitas_aviso_en_camino
-- Agrega columnas para registrar cuándo se envió el aviso "voy en camino" por WhatsApp
-- y el ETA que se comunicó al contacto. Usado por /api/recorrido/aviso-en-camino.

ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS aviso_en_camino_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS aviso_en_camino_eta_min integer;
