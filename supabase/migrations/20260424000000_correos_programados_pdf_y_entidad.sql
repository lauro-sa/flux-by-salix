-- Agrega a correos_programados los campos que faltaban para que el envío
-- diferido desde módulos de documentos (presupuestos, etc.) no pierda el PDF,
-- el enlace del portal ni el vínculo a la entidad para el chatter.
ALTER TABLE correos_programados
  ADD COLUMN IF NOT EXISTS pdf_url             text,
  ADD COLUMN IF NOT EXISTS pdf_nombre          text,
  ADD COLUMN IF NOT EXISTS pdf_congelado_url   text,
  ADD COLUMN IF NOT EXISTS entidad_tipo        text,
  ADD COLUMN IF NOT EXISTS entidad_id          uuid,
  ADD COLUMN IF NOT EXISTS tipo                text NOT NULL DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS incluir_enlace_portal boolean NOT NULL DEFAULT false;
