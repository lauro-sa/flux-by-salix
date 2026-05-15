-- 089_periodicidad_conceptos.sql
--
-- Agrega periodicidad de aplicación a los conceptos de nómina.
--
-- Antes de este PR, los conceptos se aplicaban en CADA liquidación del
-- período (cobre quincenal, semanal, etc.). Para premios mensuales como
-- Presentismo o Antigüedad eso es incorrecto: si el empleado cobra dos
-- quincenas, el premio se duplica (10% × 2 = 20% del básico mensual).
--
-- Solución: cada concepto declara cuándo aplica.
--
-- Valores soportados:
--
--   - 'mensual': el concepto pertenece al mes completo. Aplica solo en
--     la ÚLTIMA liquidación que cubre ese mes (segunda quincena, última
--     semana, o el mes entero si ya es mensual). El monto se calcula
--     sobre el básico MENSUAL del empleado, no sobre el del período.
--     Default para premios estándar (Presentismo, Antigüedad, etc).
--
--   - 'por_periodo': el concepto se aplica en cada período de pago.
--     Útil para descuentos recurrentes (uniforme cuota X/N) o adicionales
--     atados al período (ej. plus por turno noche).
--
--   - 'unico': aplica una sola vez en la vida del contrato. Ej: bono
--     por firmar, premio fin de año. (Reservado: la lógica de "ya
--     aplicado" se implementa en un PR siguiente.)
--
-- Migración:
--   1. Agrega la columna con CHECK constraint.
--   2. Asigna 'mensual' por default a todos los conceptos existentes
--      tipo 'haber' y categoría reconocida como mensual (presentismo,
--      premio, antiguedad, bono).
--   3. Asigna 'por_periodo' a descuentos de uniforme (cuota por cuota).
--   4. El resto queda en 'mensual' por seguridad — el operador puede
--      cambiarlo desde la UI.

ALTER TABLE conceptos_nomina
  ADD COLUMN IF NOT EXISTS periodicidad text NOT NULL DEFAULT 'mensual'
    CHECK (periodicidad IN ('mensual', 'por_periodo', 'unico'));

-- Backfill: los descuentos por uniforme se aplican por_periodo (cuota a cuota).
UPDATE conceptos_nomina
SET periodicidad = 'por_periodo'
WHERE categoria = 'descuento_uniforme';

-- Documentar el dominio para que los esquemas generados (drizzle, etc) lo reflejen.
COMMENT ON COLUMN conceptos_nomina.periodicidad IS
  'Cuándo aplica el concepto: mensual (solo última liquidación del mes), por_periodo (cada liquidación), unico (una vez por contrato).';
