-- Agrega columna sidebar_auto_ocultar a preferencias_usuario
-- Modo auto-ocultar: sidebar siempre colapsado, se expande al pasar el mouse
ALTER TABLE public.preferencias_usuario
  ADD COLUMN IF NOT EXISTS sidebar_auto_ocultar boolean NOT NULL DEFAULT false;
