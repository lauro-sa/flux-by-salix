-- ──────────────────────────────────────────────────────────────────
-- info_bancaria: multi-tenant + multi-cuenta + soft-delete + auditoría
-- ──────────────────────────────────────────────────────────────────
--
-- La tabla `info_bancaria` existía como esqueleto sin uso real:
-- columnas mínimas (miembro_id, tipo_cuenta, banco, numero_cuenta,
-- alias), SIN `empresa_id` (problema de RLS multi-tenant), y de hecho
-- ninguna UI la consumía. Ahora la usamos en serio para registrar
-- pagos de nómina, y eso requiere un modelo más completo:
--
--   • Multi-tenant: cada cuenta pertenece a una empresa.
--   • Multi-cuenta por miembro: un empleado puede tener Banco Galicia
--     + Mercado Pago + Brubank. Cada una es una fila independiente,
--     con `activa=true` por default y `eliminada=false` para borrado
--     reversible.
--   • Distinción banco vs digital: el operador necesita saber si la
--     cuenta es de un banco tradicional (Galicia, Santander) o una
--     billetera virtual (Mercado Pago, Brubank, Uala). Cambia el
--     "default" del método de pago en la UI.
--   • Etiqueta libre: "Cuenta sueldo", "Mi caja de ahorro principal",
--     etc. — la cara que ve el operador al elegir destino.
--   • Titular: a veces la cuenta no está a nombre del empleado (esposa,
--     padre, cuenta familiar). Guardamos nombre + documento del titular.
--   • Auditoría: quién creó/editó cada cuenta y cuándo.

-- ─── 1. Agregar columnas ───
ALTER TABLE info_bancaria
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_pago text NOT NULL DEFAULT 'banco'
    CHECK (tipo_pago IN ('banco', 'digital')),
  ADD COLUMN IF NOT EXISTS etiqueta text,
  ADD COLUMN IF NOT EXISTS titular_nombre text,
  ADD COLUMN IF NOT EXISTS titular_documento text,
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

-- ─── 2. Backfill de empresa_id desde miembros ───
-- Cada fila existente toma su empresa de la del miembro al que apunta.
UPDATE info_bancaria ib
   SET empresa_id = m.empresa_id
  FROM miembros m
 WHERE ib.miembro_id = m.id
   AND ib.empresa_id IS NULL;

-- Después del backfill, marcamos empresa_id como NOT NULL.
ALTER TABLE info_bancaria
  ALTER COLUMN empresa_id SET NOT NULL;

-- ─── 3. Limpiar viejo UNIQUE (si existía) y agregar índices nuevos ───
-- El esquema original no tenía UNIQUE explícito por miembro, pero por
-- las dudas si alguno lo agregó en algún entorno lo dropeamos.
ALTER TABLE info_bancaria
  DROP CONSTRAINT IF EXISTS info_bancaria_miembro_id_key;

-- Índice principal: listar cuentas vigentes (no eliminadas) por miembro.
CREATE INDEX IF NOT EXISTS info_bancaria_miembro_activas_idx
  ON info_bancaria (empresa_id, miembro_id)
  WHERE eliminada = false;

-- ─── 4. RLS multi-tenant ───
ALTER TABLE info_bancaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS info_bancaria_select ON info_bancaria;
CREATE POLICY info_bancaria_select ON info_bancaria
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS info_bancaria_insert ON info_bancaria;
CREATE POLICY info_bancaria_insert ON info_bancaria
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS info_bancaria_update ON info_bancaria;
CREATE POLICY info_bancaria_update ON info_bancaria
  FOR UPDATE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
            WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS info_bancaria_delete ON info_bancaria;
CREATE POLICY info_bancaria_delete ON info_bancaria
  FOR DELETE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── 5. Trigger para mantener actualizado_en ───
CREATE OR REPLACE FUNCTION info_bancaria_sync_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS info_bancaria_actualizado_en_trg ON info_bancaria;
CREATE TRIGGER info_bancaria_actualizado_en_trg
  BEFORE UPDATE ON info_bancaria
  FOR EACH ROW EXECUTE FUNCTION info_bancaria_sync_actualizado_en();

-- ─── 6. Tabla de auditoría dedicada ───
CREATE TABLE IF NOT EXISTS auditoria_info_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  info_bancaria_id uuid NOT NULL REFERENCES info_bancaria(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  accion text NOT NULL CHECK (accion IN ('crear', 'editar', 'eliminar', 'restaurar', 'activar', 'desactivar')),
  campo_modificado text,
  valor_anterior text,
  valor_nuevo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auditoria_info_bancaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_info_bancaria_select ON auditoria_info_bancaria;
CREATE POLICY auditoria_info_bancaria_select ON auditoria_info_bancaria
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS auditoria_info_bancaria_insert ON auditoria_info_bancaria;
CREATE POLICY auditoria_info_bancaria_insert ON auditoria_info_bancaria
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE INDEX IF NOT EXISTS auditoria_info_bancaria_cuenta_idx
  ON auditoria_info_bancaria (empresa_id, info_bancaria_id, creado_en DESC);

-- ─── 7. Comentarios para la documentación de la BD ───
COMMENT ON TABLE info_bancaria IS
  'Cuentas bancarias y digitales (MP/Brubank/Uala) configuradas para cada miembro. Permite N cuentas por miembro con soft-delete.';
COMMENT ON COLUMN info_bancaria.tipo_pago IS
  'banco = banco tradicional (Galicia, Santander, etc.). digital = billetera virtual (Mercado Pago, Brubank, Uala, etc.).';
COMMENT ON COLUMN info_bancaria.tipo_cuenta IS
  'Para tipo_pago=banco: ahorro / corriente / sueldo. Para digital: el formato libre del proveedor.';
COMMENT ON COLUMN info_bancaria.banco IS
  'Nombre del banco o de la billetera digital (Galicia, Mercado Pago, etc.).';
COMMENT ON COLUMN info_bancaria.numero_cuenta IS
  'CBU (banco), CVU (digital) o número de cuenta interno. 22 dígitos para CBU/CVU argentinos.';
COMMENT ON COLUMN info_bancaria.alias IS
  'Alias CBU/CVU del titular. Más fácil de tipear y validar.';
COMMENT ON COLUMN info_bancaria.activa IS
  'Si la cuenta se preselecciona como destino al registrar un pago. Puede haber varias activas, la más reciente gana en la UI.';
COMMENT ON COLUMN info_bancaria.eliminada IS
  'Soft-delete: la cuenta no aparece en selectores pero queda en BD para que los pagos históricos puedan referenciarla.';
