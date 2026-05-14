-- 076_pagos_nomina_contrato_snapshot.sql
-- PR 2 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Extiende `pagos_nomina` con dos columnas:
--
--   - `contrato_id` — FK al contrato laboral vigente cuando se generó
--     el recibo. Permite reconstruir bajo qué contrato se pagó.
--
--   - `contrato_snapshot` jsonb — Snapshot completo del contrato en
--     el momento del recibo (modalidad, monto base, sector, turno,
--     régimen, etc.). Aunque el contrato cambie o se borre, el recibo
--     histórico queda congelado.
--
-- Doble columna intencional: la FK sirve para auditoría/joins,
-- el snapshot garantiza inmutabilidad de los datos visibles en el
-- comprobante.

ALTER TABLE pagos_nomina
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES contratos_laborales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contrato_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_pagos_nomina_contrato
  ON pagos_nomina (contrato_id);
