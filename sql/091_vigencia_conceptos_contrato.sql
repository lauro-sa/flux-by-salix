-- ──────────────────────────────────────────────────────────────────
-- Vigencia temporal de conceptos asignados a un contrato
-- + tabla de auditoría dedicada para altas, bajas y overrides.
-- ──────────────────────────────────────────────────────────────────
--
-- Hasta acá `conceptos_contrato.activo` era un boolean: el concepto
-- estaba o no estaba asignado, sin saber DESDE CUÁNDO ni HASTA CUÁNDO.
-- Para los casos reales (Antigüedad cumplida, premio que se otorga a
-- partir de tal mes, descuento por uniforme en cuotas, suspensión
-- temporal de un concepto, etc.) necesitamos un rango de vigencia y
-- permitir altas-bajas-altas sin perder historia.
--
-- Modelo nuevo:
--   • `fecha_alta`  = desde cuándo el concepto se aplica (NOT NULL).
--   • `fecha_baja`  = desde cuándo deja de aplicarse (NULL = vigente).
--   • Una asignación está VIGENTE EN UN PERÍODO si:
--        fecha_alta <= periodo_fin
--        AND (fecha_baja IS NULL OR fecha_baja >= periodo_inicio)
--   • Para el mismo (contrato, concepto), puede haber varias filas
--     siempre que solo UNA tenga `fecha_baja IS NULL`. Eso permite
--     reactivar un concepto y dejar visible que estuvo dado de baja.
--
-- El campo legado `activo` se mantiene por compatibilidad (algunos
-- consumidores aún lo leen) y se sincroniza desde un trigger:
--   activo := (fecha_baja IS NULL).

-- ─── 1. Columnas nuevas ───
ALTER TABLE conceptos_contrato
  ADD COLUMN IF NOT EXISTS fecha_alta date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS fecha_baja date NULL;

-- ─── 2. Backfill de filas existentes ───
-- Para las filas que ya están en BD: tomamos `creado_en` como
-- fecha_alta (mejor aproximación del momento real de alta). Si la
-- fila estaba inactiva, también ponemos `fecha_baja` con esa fecha
-- — no sabemos cuándo se desactivó pero al menos queda cerrado.
UPDATE conceptos_contrato
   SET fecha_alta = (creado_en AT TIME ZONE 'UTC')::date
 WHERE creado_en IS NOT NULL
   AND fecha_alta = current_date;

UPDATE conceptos_contrato
   SET fecha_baja = (creado_en AT TIME ZONE 'UTC')::date
 WHERE activo = false
   AND fecha_baja IS NULL
   AND creado_en IS NOT NULL;

-- Backfill complementario: si una asignación quedó vigente
-- (fecha_baja IS NULL) pero su contrato ya está terminado, cerramos
-- la asignación con la `fecha_fin` del contrato. Es coherente con la
-- semántica nueva: un concepto no puede estar vigente si su contrato
-- terminó. Casos típicos: contratos cerrados antes de esta migración
-- a los que el endpoint de cierre no les actualizaba los conceptos.
UPDATE conceptos_contrato cc
   SET fecha_baja = cl.fecha_fin
  FROM contratos_laborales cl
 WHERE cc.contrato_id = cl.id
   AND cl.vigente = false
   AND cl.fecha_fin IS NOT NULL
   AND cc.fecha_baja IS NULL;

-- ─── 3. Reemplazar UNIQUE por uno PARCIAL ───
-- El UNIQUE viejo (contrato_id, concepto_id) impide tener historia.
-- Reemplazamos por un UNIQUE PARCIAL: solo puede haber UNA fila
-- vigente por (contrato, concepto). Las cerradas pueden ser N.
ALTER TABLE conceptos_contrato
  DROP CONSTRAINT IF EXISTS conceptos_contrato_contrato_id_concepto_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conceptos_contrato_unico_vigente
  ON conceptos_contrato (contrato_id, concepto_id)
  WHERE fecha_baja IS NULL;

-- ─── 4. Índice para queries del motor ───
-- El motor de cálculo filtra por vigencia en cada período:
--   WHERE contrato_id = X
--     AND fecha_alta <= periodo_fin
--     AND (fecha_baja IS NULL OR fecha_baja >= periodo_inicio)
CREATE INDEX IF NOT EXISTS conceptos_contrato_vigencia_idx
  ON conceptos_contrato (contrato_id, fecha_alta, fecha_baja);

-- ─── 5. Sincronizar `activo` desde `fecha_baja` ───
-- Trigger que mantiene el legado: activo = (fecha_baja IS NULL).
-- Esto permite que consumidores viejos sigan funcionando mientras
-- migramos código y nos da una sola fuente de verdad.
CREATE OR REPLACE FUNCTION sync_activo_desde_fecha_baja()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.activo := (NEW.fecha_baja IS NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conceptos_contrato_sync_activo ON conceptos_contrato;
CREATE TRIGGER conceptos_contrato_sync_activo
  BEFORE INSERT OR UPDATE ON conceptos_contrato
  FOR EACH ROW EXECUTE FUNCTION sync_activo_desde_fecha_baja();

-- ─── 6. Tabla de auditoría dedicada ───
-- Captura altas/bajas/overrides con quién y cuándo. La tabla
-- genérica `auditoria_contratos_laborales` cubre cambios al contrato
-- en sí; esta es para sus conceptos asignados.
CREATE TABLE IF NOT EXISTS auditoria_conceptos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES contratos_laborales(id) ON DELETE CASCADE,
  concepto_id uuid NOT NULL REFERENCES conceptos_nomina(id) ON DELETE CASCADE,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  accion text NOT NULL CHECK (accion IN ('alta', 'baja', 'override')),
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auditoria_conceptos_contrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_conceptos_contrato_select ON auditoria_conceptos_contrato;
CREATE POLICY auditoria_conceptos_contrato_select ON auditoria_conceptos_contrato
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS auditoria_conceptos_contrato_insert ON auditoria_conceptos_contrato;
CREATE POLICY auditoria_conceptos_contrato_insert ON auditoria_conceptos_contrato
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE INDEX IF NOT EXISTS auditoria_conceptos_contrato_contrato_idx
  ON auditoria_conceptos_contrato (empresa_id, contrato_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS auditoria_conceptos_contrato_concepto_idx
  ON auditoria_conceptos_contrato (empresa_id, concepto_id, creado_en DESC);

COMMENT ON TABLE auditoria_conceptos_contrato IS
  'Trazabilidad de altas, bajas y cambios de override en conceptos asignados a contratos.';
