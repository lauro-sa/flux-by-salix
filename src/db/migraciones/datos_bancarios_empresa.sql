-- Migración: Agregar datos_bancarios a tabla empresas
-- Los datos bancarios de la empresa son la fuente de verdad.
-- En config_presupuestos se pueden sobreescribir para el contexto de presupuestos/portal.

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS datos_bancarios jsonb NOT NULL DEFAULT '{}';

-- Comentario descriptivo
COMMENT ON COLUMN empresas.datos_bancarios IS 'Datos bancarios de la empresa: {banco, titular, numero_cuenta, cbu, alias}';
