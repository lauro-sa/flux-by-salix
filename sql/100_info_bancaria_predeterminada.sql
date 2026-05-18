-- 100 — Cuenta predeterminada para pagos de nómina
--
-- Contexto:
-- Un empleado puede tener N cuentas (Galicia + Mercado Pago + Brubank).
-- Hasta ahora la UI preseleccionaba "la más reciente actualizada" en el
-- modal de "Registrar pago", lo cual no es determinístico ni claro para
-- el operador.
--
-- Solución: agregar una bandera `predeterminada` por cuenta. La
-- restricción UNIQUE parcial garantiza que haya como máximo UNA cuenta
-- predeterminada por (empresa, miembro) entre las no eliminadas — no
-- ponemos NOT NULL ni default true porque un miembro puede no tener
-- ninguna cuenta cargada o tenerlas todas inactivas.
--
-- Backfill: para cada miembro que ya tiene al menos una cuenta activa,
-- marcar la más reciente como predeterminada. Así el modal de pago
-- tiene preselección de entrada para todos los empleados existentes.

-- ─── 1. Columna ───
ALTER TABLE info_bancaria
  ADD COLUMN IF NOT EXISTS predeterminada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN info_bancaria.predeterminada IS
  'Cuenta sugerida al registrar un pago de nómina. Solo UNA por miembro entre las no eliminadas (garantizado por unique index parcial). Backfill inicial: la cuenta activa más reciente de cada miembro.';

-- ─── 2. UNIQUE parcial: máximo 1 predeterminada vigente por miembro ───
-- Solo aplica cuando predeterminada=true y eliminada=false, así no nos
-- estorba al soft-deletear la cuenta default (queda "huérfana" hasta que
-- el usuario marque otra, lo cual es el comportamiento deseado).
CREATE UNIQUE INDEX IF NOT EXISTS info_bancaria_predeterminada_idx
  ON info_bancaria (empresa_id, miembro_id)
  WHERE predeterminada = true AND eliminada = false;

-- ─── 3. Backfill ───
-- Para cada miembro con cuentas activas no eliminadas, marcar como
-- predeterminada la más reciente actualizada. DISTINCT ON garantiza
-- una sola por miembro (la primera del ORDER BY).
WITH candidata AS (
  SELECT DISTINCT ON (empresa_id, miembro_id) id
    FROM info_bancaria
   WHERE eliminada = false
     AND activa = true
   ORDER BY empresa_id, miembro_id, actualizado_en DESC, creado_en DESC
)
UPDATE info_bancaria
   SET predeterminada = true
 WHERE id IN (SELECT id FROM candidata);
