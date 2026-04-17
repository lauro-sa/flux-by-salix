-- Plantillas de correo de sistema: editables pero restaurables al original.
-- Agrega columnas para distinguir plantillas del sistema vs las del usuario.

ALTER TABLE plantillas_correo
  ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clave_sistema text UNIQUE,
  ADD COLUMN IF NOT EXISTS contenido_original_html text,
  ADD COLUMN IF NOT EXISTS asunto_original text;

CREATE INDEX IF NOT EXISTS plantillas_correo_clave_sistema_idx
  ON plantillas_correo (clave_sistema) WHERE clave_sistema IS NOT NULL;

COMMENT ON COLUMN plantillas_correo.es_sistema IS 'Indica si es una plantilla precargada del sistema';
COMMENT ON COLUMN plantillas_correo.clave_sistema IS 'Identificador único: {empresa_id}_{clave} (ej: uuid_envio_presupuesto)';
COMMENT ON COLUMN plantillas_correo.contenido_original_html IS 'HTML original para poder restaurar la plantilla de sistema';
COMMENT ON COLUMN plantillas_correo.asunto_original IS 'Asunto original para poder restaurar la plantilla de sistema';
