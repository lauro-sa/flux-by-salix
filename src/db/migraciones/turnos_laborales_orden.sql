-- Migración: campo de orden para drag-and-drop en turnos laborales
ALTER TABLE turnos_laborales
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS turnos_laborales_orden_idx
  ON turnos_laborales(empresa_id, orden);
