-- Migración: visitas_archivo
-- Agrega campos de archivo automático para visitas completadas (> 30 días)
-- y función cron para archivar automáticamente.

-- 1. Agregar campos
ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS archivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archivada_en timestamptz;

-- 2. Índice para filtrar archivadas eficientemente
CREATE INDEX IF NOT EXISTS visitas_archivada_idx ON visitas (empresa_id, archivada);

-- 3. Función para archivar visitas completadas hace más de 30 días
CREATE OR REPLACE FUNCTION archivar_visitas_completadas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  filas_afectadas integer;
BEGIN
  UPDATE visitas
  SET
    archivada = true,
    archivada_en = now()
  WHERE
    estado = 'completada'
    AND archivada = false
    AND fecha_completada IS NOT NULL
    AND fecha_completada < now() - interval '30 days';

  GET DIAGNOSTICS filas_afectadas = ROW_COUNT;
  RETURN filas_afectadas;
END;
$$;

-- 4. Programar con pg_cron (ejecutar diariamente a las 3 AM UTC)
-- NOTA: requiere extensión pg_cron habilitada en Supabase
-- SELECT cron.schedule('archivar-visitas', '0 3 * * *', 'SELECT archivar_visitas_completadas()');
