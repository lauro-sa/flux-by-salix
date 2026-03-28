-- =============================================================
-- 007: Datos fiscales de la empresa
-- Agrega columna JSONB para almacenar todos los datos fiscales
-- de la empresa según los campos definidos en campos_fiscales_pais.
-- Ejemplo para Argentina: { "cuit": "20-12345678-9", "condicion_iva": "responsable_inscripto", "tipo_iibb": "local", "numero_iibb": "12345" }
-- =============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS datos_fiscales jsonb NOT NULL DEFAULT '{}';
