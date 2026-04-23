-- =============================================================================
-- Migración: normalizar tipo='whatsapp' → 'movil' en contacto_telefonos
-- Fecha: 2026-04-22
-- Descripción:
--   La migración 20260422040000 puso tipo='whatsapp' en 575 filas para preservar
--   la semántica histórica de los contactos del data-fill (caso C: contactos que
--   solo tenían whatsapp, sin telefono). En la convención nueva, "WhatsApp" no es
--   un tipo de línea — es una propiedad de un móvil. Por consistencia entre BD y
--   UI, todos esos pasan a tipo='movil' (es_whatsapp ya estaba en true).
-- =============================================================================

UPDATE contacto_telefonos
SET tipo = 'movil',
    actualizado_en = now()
WHERE tipo = 'whatsapp';

-- Actualizar comentarios de columnas para reflejar la convención nueva
COMMENT ON COLUMN contacto_telefonos.tipo IS
  'Tipo de línea: movil | fijo | trabajo | casa | otro. WhatsApp NO es un tipo: se asume implícito para movil (convención AR).';

COMMENT ON COLUMN contacto_telefonos.es_whatsapp IS
  'Derivado del tipo en la UI: true cuando tipo=movil. La columna se mantiene por flexibilidad futura (ej. móvil corporativo sin WA).';
