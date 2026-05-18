-- ──────────────────────────────────────────────────────────────────
-- Pagos de nómina: método de pago, fecha efectiva, referencia y
-- vínculo a la cuenta bancaria destino.
-- ──────────────────────────────────────────────────────────────────
--
-- Hasta acá `pagos_nomina` solo registraba `monto_abonado`, `notas` y
-- un `comprobante_url` suelto. El operador no podía decir cómo pagó
-- (efectivo / transferencia / cuenta digital), cuándo lo pagó (la
-- fecha real, no la de carga), ni a qué cuenta del empleado fue.
--
-- Este cambio agrega:
--   • `metodo_pago`     — efectivo, transferencia, cuenta_digital, cheque, otro.
--   • `fecha_pago`      — fecha efectiva del pago (default: hoy).
--   • `referencia`      — número de operación / comprobante (opcional).
--   • `info_bancaria_id`→ FK opcional a la cuenta bancaria del empleado
--                        que se usó como destino. Solo aplica cuando
--                        el método NO es efectivo.

ALTER TABLE pagos_nomina
  ADD COLUMN IF NOT EXISTS metodo_pago text NOT NULL DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo', 'transferencia', 'cuenta_digital', 'cheque', 'otro')),
  ADD COLUMN IF NOT EXISTS fecha_pago date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS info_bancaria_id uuid REFERENCES info_bancaria(id) ON DELETE SET NULL;

-- Índice para listar pagos del mes / período actual rápido (la UI de
-- Adelantos y el dashboard filtran por `fecha_pago`, no por
-- `creado_en`).
CREATE INDEX IF NOT EXISTS pagos_nomina_fecha_pago_idx
  ON pagos_nomina (empresa_id, fecha_pago DESC)
  WHERE eliminado = false;

-- Backfill: para pagos ya cargados, usar la fecha de creación como
-- aproximación de la fecha de pago. No tenemos mejor info histórica.
UPDATE pagos_nomina
   SET fecha_pago = (creado_en AT TIME ZONE 'UTC')::date
 WHERE creado_en IS NOT NULL
   AND fecha_pago = current_date;

COMMENT ON COLUMN pagos_nomina.metodo_pago IS
  'Cómo se realizó el pago: efectivo, transferencia bancaria, cuenta digital (MP/Brubank/etc.), cheque u otro.';
COMMENT ON COLUMN pagos_nomina.fecha_pago IS
  'Fecha real del pago. Puede ser distinta de creado_en (si se carga el pago en otro momento).';
COMMENT ON COLUMN pagos_nomina.referencia IS
  'Número de operación de transferencia, número de cheque o cualquier identificador externo del pago.';
COMMENT ON COLUMN pagos_nomina.info_bancaria_id IS
  'Cuenta bancaria/digital del empleado a la que se transfirió. NULL para efectivo o cheque al portador.';
