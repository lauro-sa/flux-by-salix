-- ──────────────────────────────────────────────────────────────────
-- Tipo "bono" en adelantos_nomina: pagos extra one-off (suma al neto).
-- ──────────────────────────────────────────────────────────────────
--
-- La tabla `adelantos_nomina` ya distingue 'adelanto' (préstamo en
-- cuotas, resta) y 'descuento' (multa puntual, resta una sola vez).
-- Faltaba el caso simétrico positivo: el patrón decide pagarle al
-- empleado un EXTRA en este período (premio puntual por
-- sobreesfuerzo, gratificación, propina formalizada, etc.) sin que
-- pase a ser un concepto recurrente del contrato.
--
-- Modelo:
--   • tipo='bono' → siempre 1 cuota (el "monto_total" se entrega en
--     ese mismo período), no se prorratea.
--   • Signo en motor: SUMA al neto (los otros dos restan).
--   • Conceptualmente vive con los adelantos/descuentos porque
--     comparten ciclo de vida (registro one-off, fecha, monto,
--     visible en la liquidación del período).
--
-- En la UI, los tres tipos se agrupan bajo "Ajustes del período".

ALTER TABLE adelantos_nomina
  DROP CONSTRAINT IF EXISTS adelantos_nomina_tipo_check;

ALTER TABLE adelantos_nomina
  ADD CONSTRAINT adelantos_nomina_tipo_check
  CHECK (tipo IN ('adelanto', 'descuento', 'bono'));

COMMENT ON COLUMN adelantos_nomina.tipo IS
  'adelanto: dinero entregado al empleado, se descuenta en una o más cuotas (resta). '
  'descuento: penalidad/multa/daño, nunca se entrega y se descuenta una sola vez (resta). '
  'bono: pago extra one-off del patrón al empleado en este período, no recurrente (suma).';
