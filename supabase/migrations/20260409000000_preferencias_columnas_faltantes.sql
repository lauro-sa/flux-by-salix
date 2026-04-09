-- Agregar columnas faltantes a preferencias_usuario
-- chatter_sin_lateral: secciones donde el chatter NO se ancla al costado
-- recibir_todas_notificaciones: admin recibe todas las notificaciones

ALTER TABLE preferencias_usuario
  ADD COLUMN IF NOT EXISTS chatter_sin_lateral jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recibir_todas_notificaciones boolean NOT NULL DEFAULT false;
