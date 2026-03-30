-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 018: PURGA DE MÓDULOS — 30 días de gracia
-- Cuando una empresa desinstala un módulo, los datos se mantienen
-- por 30 días. Después de ese período, se marcan para eliminación.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar campos de purga a modulos_empresa
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'purga_programada_en') THEN
    ALTER TABLE modulos_empresa ADD COLUMN purga_programada_en timestamptz; -- fecha en que se eliminarán los datos
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'purgado') THEN
    ALTER TABLE modulos_empresa ADD COLUMN purgado boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modulos_empresa' AND column_name = 'notificacion_purga_enviada') THEN
    ALTER TABLE modulos_empresa ADD COLUMN notificacion_purga_enviada boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Función: al desactivar un módulo, programar purga en 30 días
CREATE OR REPLACE FUNCTION programar_purga_modulo()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se desactivó (activo pasó de true a false)
  IF OLD.activo = true AND NEW.activo = false THEN
    NEW.purga_programada_en := now() + interval '30 days';
    NEW.purgado := false;
    NEW.notificacion_purga_enviada := false;
  END IF;

  -- Si se reactivó (activo pasó de false a true), cancelar purga
  IF OLD.activo = false AND NEW.activo = true THEN
    NEW.purga_programada_en := NULL;
    NEW.purgado := false;
    NEW.notificacion_purga_enviada := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_programar_purga ON modulos_empresa;
CREATE TRIGGER trigger_programar_purga
  BEFORE UPDATE ON modulos_empresa
  FOR EACH ROW
  EXECUTE FUNCTION programar_purga_modulo();

-- 3. Actualizar módulos ya desactivados que no tengan purga programada
UPDATE modulos_empresa
SET purga_programada_en = desactivado_en + interval '30 days'
WHERE activo = false
  AND desactivado_en IS NOT NULL
  AND purga_programada_en IS NULL
  AND purgado = false;
