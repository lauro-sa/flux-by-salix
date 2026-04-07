-- ═══════════════════════════════════════════════════════════════
-- Migración 028: Re-emisión de presupuestos
-- Agrega campo para guardar la fecha de emisión original cuando
-- se re-emite un presupuesto con nuevas fechas.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS fecha_emision_original timestamptz;
