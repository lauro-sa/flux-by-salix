-- Agregar columna para auto-colapsar sidebar en páginas con menú secundario (configuración, mi-cuenta, etc.)
-- Default: true (activado por defecto)
ALTER TABLE preferencias_usuario
ADD COLUMN IF NOT EXISTS sidebar_auto_colapsar_config boolean NOT NULL DEFAULT true;
