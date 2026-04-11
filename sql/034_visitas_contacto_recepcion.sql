-- Contacto de recepción en visitas
-- Quien recibe al visitador (puede ser diferente al contacto principal)
-- Si recibe_contacto_id es null y recibe_nombre es null → recibe el contacto principal

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS recibe_contacto_id uuid REFERENCES contactos(id) ON DELETE SET NULL;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS recibe_nombre text;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS recibe_telefono text;

COMMENT ON COLUMN visitas.recibe_contacto_id IS 'Contacto que recibe al visitador (opcional, si es diferente al principal)';
COMMENT ON COLUMN visitas.recibe_nombre IS 'Nombre de quien recibe (escrito a mano si no es un contacto registrado)';
COMMENT ON COLUMN visitas.recibe_telefono IS 'Teléfono de quien recibe (escrito a mano)';
