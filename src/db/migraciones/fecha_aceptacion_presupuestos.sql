-- Migración: agregar fecha_aceptacion a presupuestos
-- Se llena automáticamente cuando el estado cambia a confirmado_cliente u orden_venta
-- Para registros existentes, queda NULL y el dashboard hace fallback a fecha_emision

ALTER TABLE presupuestos
ADD COLUMN IF NOT EXISTS fecha_aceptacion timestamptz;

-- Backfill: para presupuestos ya aceptados, tomar la fecha del historial de cambio de estado
UPDATE presupuestos p
SET fecha_aceptacion = (
  SELECT h.fecha
  FROM presupuesto_historial h
  WHERE h.presupuesto_id = p.id
    AND h.estado IN ('confirmado_cliente', 'orden_venta')
  ORDER BY h.fecha ASC
  LIMIT 1
)
WHERE p.estado IN ('confirmado_cliente', 'orden_venta')
  AND p.fecha_aceptacion IS NULL;
