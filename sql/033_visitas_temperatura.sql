-- Agregar campo temperatura (factibilidad) a visitas
-- Valores: 'frio' (baja), 'tibio' (media), 'caliente' (alta)
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS temperatura text;

COMMENT ON COLUMN visitas.temperatura IS 'Factibilidad del prospecto: frio, tibio, caliente';
