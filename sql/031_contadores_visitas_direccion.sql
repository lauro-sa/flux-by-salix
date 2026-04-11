-- ═══════════════════════════════════════════════════════════════
-- Migración 031: Contadores de visitas en contacto_direcciones
-- Para saber cuántas veces se visitó cada dirección y cuándo fue la última.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar campos
ALTER TABLE contacto_direcciones ADD COLUMN IF NOT EXISTS total_visitas integer NOT NULL DEFAULT 0;
ALTER TABLE contacto_direcciones ADD COLUMN IF NOT EXISTS ultima_visita timestamptz;

-- 2. Trigger: al completar una visita, incrementar contador de la dirección
CREATE OR REPLACE FUNCTION actualizar_contadores_visita_direccion()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar cuando cambia el estado a 'completada'
  IF NEW.estado = 'completada' AND (OLD.estado IS DISTINCT FROM 'completada') AND NEW.direccion_id IS NOT NULL THEN
    UPDATE contacto_direcciones
    SET total_visitas = total_visitas + 1, ultima_visita = now()
    WHERE id = NEW.direccion_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visitas_actualizar_contadores_direccion ON visitas;
CREATE TRIGGER visitas_actualizar_contadores_direccion
  AFTER UPDATE ON visitas
  FOR EACH ROW EXECUTE FUNCTION actualizar_contadores_visita_direccion();
