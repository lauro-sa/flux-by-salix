-- Formato del nombre del remitente para correos, WhatsApp, etc.
-- Cada usuario elige cómo aparece su nombre en comunicaciones salientes.
-- Default: 'nombre_inicial_sector' (ej: "Sebastian L · Recursos Humanos")
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS formato_nombre_remitente text DEFAULT 'nombre_inicial_sector';
