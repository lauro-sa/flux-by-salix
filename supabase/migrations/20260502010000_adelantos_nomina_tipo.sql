-- Diferenciar adelantos (dinero entregado al empleado, descontable en cuotas)
-- de descuentos puntuales (multas, daños, faltantes — siempre 1 cuota, no se entrega).
-- Se mantiene en la misma tabla porque comparten ciclo de vida (cuota, fecha, monto, etc.).

ALTER TABLE adelantos_nomina
  ADD COLUMN tipo text NOT NULL DEFAULT 'adelanto'
  CHECK (tipo IN ('adelanto', 'descuento'));

COMMENT ON COLUMN adelantos_nomina.tipo IS
  'adelanto: dinero entregado al empleado, se descuenta en una o más cuotas. descuento: penalidad/multa/daño, nunca se entrega y se descuenta una sola vez.';
