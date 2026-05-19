-- ──────────────────────────────────────────────────────────────────
-- Catálogo de entidades financieras (bancos + billeteras virtuales)
-- ──────────────────────────────────────────────────────────────────
--
-- Antes: la tabla `bancos` guardaba solo el nombre del banco, sin
-- distinguir banco tradicional de billetera virtual y sin metadata
-- útil (código BCRA para autodetección por CBU, soft-delete, audit).
-- Cada empresa cargaba sus bancos a mano y nada evitaba que tres
-- operadores escribieran "Galicia", "Banco Galicia" y "GALICIA" como
-- entradas separadas, además de no tener billeteras (MP, Brubank, etc.)
-- en un catálogo unificado.
--
-- Esta migración:
--   1. Renombra `bancos` → `entidades_financieras`.
--   2. Agrega columnas: `tipo` (banco|digital), `codigo_banco` (3
--      dígitos AR para autodetección por CBU), `activa`, `eliminada`,
--      audit columns (creado_por, actualizado_*).
--   3. Crea `auditoria_entidades_financieras` para trazar cambios.
--   4. Agrega `entidad_id` (FK) a `info_bancaria` para enlazar las
--      cuentas con el catálogo (manteniendo `banco` text como fallback
--      legacy hasta que la UI termine la migración).
--   5. Crea función `seed_entidades_financieras(empresa_id)` que carga
--      bancos AR (con código BCRA) + billeteras comunes.
--   6. Trigger AFTER INSERT ON empresas para auto-seed.
--   7. Backfill: corre el seed para todas las empresas existentes y
--      enlaza `info_bancaria.entidad_id` por nombre cuando hay match.

-- ─── 1. Renombrar tabla y agregar columnas ───
ALTER TABLE IF EXISTS bancos RENAME TO entidades_financieras;
ALTER INDEX IF EXISTS bancos_empresa_idx RENAME TO entidades_financieras_empresa_idx;

ALTER TABLE entidades_financieras
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'banco'
    CHECK (tipo IN ('banco', 'digital')),
  ADD COLUMN IF NOT EXISTS codigo_banco text,  -- 3 dígitos BCRA para autodetectar por CBU
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eliminada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

-- ─── 2. Único parcial por (empresa, tipo, lower(nombre)) ───
-- El UNIQUE viejo `bancos_empresa_nombre_unique` (sin `tipo`) impediría
-- tener "Mercado Pago" como banco y como billetera. Lo dropeamos y lo
-- reemplazamos por uno que sí discrimina por tipo.
DROP INDEX IF EXISTS bancos_empresa_nombre_unique;
DROP INDEX IF EXISTS entidades_financieras_nombre_unique_idx;
CREATE UNIQUE INDEX entidades_financieras_nombre_unique_idx
  ON entidades_financieras (empresa_id, tipo, lower(nombre))
  WHERE eliminada = false;

-- Búsqueda por código BCRA para autodetección al pegar un CBU.
CREATE INDEX IF NOT EXISTS entidades_financieras_codigo_idx
  ON entidades_financieras (empresa_id, codigo_banco)
  WHERE codigo_banco IS NOT NULL AND eliminada = false;

-- ─── 3. RLS multi-tenant ───
ALTER TABLE entidades_financieras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entidades_financieras_select ON entidades_financieras;
CREATE POLICY entidades_financieras_select ON entidades_financieras
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS entidades_financieras_insert ON entidades_financieras;
CREATE POLICY entidades_financieras_insert ON entidades_financieras
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS entidades_financieras_update ON entidades_financieras;
CREATE POLICY entidades_financieras_update ON entidades_financieras
  FOR UPDATE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
            WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS entidades_financieras_delete ON entidades_financieras;
CREATE POLICY entidades_financieras_delete ON entidades_financieras
  FOR DELETE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── 4. Trigger para actualizar `actualizado_en` ───
CREATE OR REPLACE FUNCTION entidades_financieras_sync_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entidades_financieras_actualizado_en_trg ON entidades_financieras;
CREATE TRIGGER entidades_financieras_actualizado_en_trg
  BEFORE UPDATE ON entidades_financieras
  FOR EACH ROW EXECUTE FUNCTION entidades_financieras_sync_actualizado_en();

-- ─── 5. Auditoría dedicada ───
CREATE TABLE IF NOT EXISTS auditoria_entidades_financieras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  entidad_id uuid NOT NULL REFERENCES entidades_financieras(id) ON DELETE CASCADE,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  accion text NOT NULL CHECK (accion IN ('crear', 'editar', 'eliminar', 'restaurar', 'activar', 'desactivar')),
  campo_modificado text,
  valor_anterior text,
  valor_nuevo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auditoria_entidades_financieras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_entidades_financieras_select ON auditoria_entidades_financieras;
CREATE POLICY auditoria_entidades_financieras_select ON auditoria_entidades_financieras
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

DROP POLICY IF EXISTS auditoria_entidades_financieras_insert ON auditoria_entidades_financieras;
CREATE POLICY auditoria_entidades_financieras_insert ON auditoria_entidades_financieras
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE INDEX IF NOT EXISTS auditoria_entidades_financieras_idx
  ON auditoria_entidades_financieras (empresa_id, entidad_id, creado_en DESC);

-- ─── 6. FK `entidad_id` en info_bancaria ───
-- Nullable: las cuentas viejas conservan el texto en `banco` hasta que
-- el backfill las enlace. El frontend prioriza `entidad_id` y cae al
-- texto si es null (no hay big-bang ni breaking change).
ALTER TABLE info_bancaria
  ADD COLUMN IF NOT EXISTS entidad_id uuid REFERENCES entidades_financieras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS info_bancaria_entidad_idx
  ON info_bancaria (empresa_id, entidad_id)
  WHERE eliminada = false;

-- ─── 7. Función seed de entidades base por empresa ───
-- Carga los bancos argentinos más comunes con código BCRA y las
-- billeteras virtuales más usadas. Se llama al crear una empresa
-- nueva (via trigger) y desde el backfill para empresas existentes.
CREATE OR REPLACE FUNCTION seed_entidades_financieras(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Bancos tradicionales argentinos (códigos BCRA — primeros 3 dígitos del CBU).
  -- ON CONFLICT por el índice único parcial: si la empresa ya tiene el
  -- banco cargado (porque el operador lo escribió antes), no se duplica.
  INSERT INTO entidades_financieras (empresa_id, tipo, nombre, codigo_banco)
  VALUES
    (p_empresa_id, 'banco', 'Banco Galicia', '007'),
    (p_empresa_id, 'banco', 'Banco Nación', '011'),
    (p_empresa_id, 'banco', 'BICE', '014'),
    (p_empresa_id, 'banco', 'ICBC', '015'),
    (p_empresa_id, 'banco', 'BBVA', '017'),
    (p_empresa_id, 'banco', 'Banco Provincia', '020'),
    (p_empresa_id, 'banco', 'Banco Supervielle', '027'),
    (p_empresa_id, 'banco', 'Banco Ciudad', '029'),
    (p_empresa_id, 'banco', 'Banco Credicoop', '191'),
    (p_empresa_id, 'banco', 'Banco Patagonia', '034'),
    (p_empresa_id, 'banco', 'Banco Hipotecario', '044'),
    (p_empresa_id, 'banco', 'Banco de San Juan', '045'),
    (p_empresa_id, 'banco', 'Banco Itaú', '065'),
    (p_empresa_id, 'banco', 'Banco Roela', '072'),
    (p_empresa_id, 'banco', 'Banco del Chubut', '083'),
    (p_empresa_id, 'banco', 'Banco de Santa Cruz', '086'),
    (p_empresa_id, 'banco', 'Banco de La Pampa', '093'),
    (p_empresa_id, 'banco', 'Banco Tierra del Fuego', '268'),
    (p_empresa_id, 'banco', 'Banco Industrial (BIND)', '147'),
    (p_empresa_id, 'banco', 'Banco Comafi', '299'),
    (p_empresa_id, 'banco', 'Banco Macro', '285'),
    (p_empresa_id, 'banco', 'Banco Santander', '072'),
    (p_empresa_id, 'banco', 'Banco Santander Río', '072'),
    (p_empresa_id, 'banco', 'HSBC', '150'),
    (p_empresa_id, 'banco', 'Banco del Sol', '198'),
    (p_empresa_id, 'banco', 'Banco Bica', '426'),
    (p_empresa_id, 'banco', 'Banco Coinag', '432'),
    (p_empresa_id, 'banco', 'Banco de Córdoba (Bancor)', '020'),
    (p_empresa_id, 'banco', 'Banco del Chaco', '311'),
    (p_empresa_id, 'banco', 'Banco de Formosa', '315'),
    (p_empresa_id, 'banco', 'Banco CMF', '319'),
    (p_empresa_id, 'banco', 'Wilobank (Brubank)', '143'),
    (p_empresa_id, 'banco', 'Banco Voii', '441')
  ON CONFLICT (empresa_id, tipo, lower(nombre)) WHERE eliminada = false DO NOTHING;

  -- Billeteras virtuales: el código BCRA va null porque usan distintos
  -- bancos socios y los primeros 3 dígitos del CVU pueden coincidir con
  -- bancos tradicionales (ej. Cuenta DNI viaja por Banco Provincia).
  INSERT INTO entidades_financieras (empresa_id, tipo, nombre, codigo_banco)
  VALUES
    (p_empresa_id, 'digital', 'Mercado Pago', NULL),
    (p_empresa_id, 'digital', 'Ualá', NULL),
    (p_empresa_id, 'digital', 'Naranja X', NULL),
    (p_empresa_id, 'digital', 'Personal Pay', NULL),
    (p_empresa_id, 'digital', 'Cuenta DNI', NULL),
    (p_empresa_id, 'digital', 'Modo', NULL),
    (p_empresa_id, 'digital', 'Belo', NULL),
    (p_empresa_id, 'digital', 'Lemon Cash', NULL),
    (p_empresa_id, 'digital', 'Prex', NULL),
    (p_empresa_id, 'digital', 'Reba', NULL),
    (p_empresa_id, 'digital', 'Cocos Capital', NULL)
  ON CONFLICT (empresa_id, tipo, lower(nombre)) WHERE eliminada = false DO NOTHING;
END;
$$;

-- ─── 8. Trigger AFTER INSERT ON empresas para seed automático ───
CREATE OR REPLACE FUNCTION trg_seed_entidades_empresa_nueva()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM seed_entidades_financieras(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_seed_entidades_trg ON empresas;
CREATE TRIGGER empresas_seed_entidades_trg
  AFTER INSERT ON empresas
  FOR EACH ROW EXECUTE FUNCTION trg_seed_entidades_empresa_nueva();

-- ─── 9. Backfill: seed para empresas existentes + enlace info_bancaria ───
-- Para cada empresa ya creada, corremos el seed (ON CONFLICT garantiza
-- que no se duplique con lo que el operador ya cargó). Después
-- enlazamos info_bancaria.entidad_id por nombre case-insensitive
-- (sin tipo: el match se hace solo por nombre, asumiendo que un
-- mismo nombre no se usa para banco y billetera en la misma empresa).
DO $$
DECLARE
  emp record;
BEGIN
  FOR emp IN SELECT id FROM empresas LOOP
    PERFORM seed_entidades_financieras(emp.id);
  END LOOP;
END
$$;

-- Enlazar info_bancaria existente con entidades por nombre.
-- Se respeta empresa_id en el match y el tipo_pago del registro.
UPDATE info_bancaria ib
   SET entidad_id = ef.id
  FROM entidades_financieras ef
 WHERE ib.entidad_id IS NULL
   AND ib.banco IS NOT NULL
   AND ib.empresa_id = ef.empresa_id
   AND ib.tipo_pago = ef.tipo
   AND lower(trim(ib.banco)) = lower(ef.nombre)
   AND ef.eliminada = false;

-- Para los nombres que existen en info_bancaria pero no en el catálogo
-- (escritos a mano por el operador antes del catálogo), los creamos
-- automáticamente como entidades personalizadas y los enlazamos.
INSERT INTO entidades_financieras (empresa_id, tipo, nombre)
SELECT DISTINCT ib.empresa_id, ib.tipo_pago, initcap(trim(ib.banco))
  FROM info_bancaria ib
 WHERE ib.entidad_id IS NULL
   AND ib.banco IS NOT NULL
   AND trim(ib.banco) <> ''
   AND ib.eliminada = false
ON CONFLICT (empresa_id, tipo, lower(nombre)) WHERE eliminada = false DO NOTHING;

-- Segundo pase del enlace, ahora que las personalizadas ya existen.
UPDATE info_bancaria ib
   SET entidad_id = ef.id
  FROM entidades_financieras ef
 WHERE ib.entidad_id IS NULL
   AND ib.banco IS NOT NULL
   AND ib.empresa_id = ef.empresa_id
   AND ib.tipo_pago = ef.tipo
   AND lower(trim(ib.banco)) = lower(ef.nombre)
   AND ef.eliminada = false;

-- ─── 10. Comentarios ───
COMMENT ON TABLE entidades_financieras IS
  'Catálogo por empresa de bancos tradicionales y billeteras virtuales para asociar a las cuentas de pago de los empleados. Auto-seedeado al crear empresas.';
COMMENT ON COLUMN entidades_financieras.tipo IS
  'banco = institución tradicional (Galicia, Santander). digital = billetera virtual (Mercado Pago, Brubank).';
COMMENT ON COLUMN entidades_financieras.codigo_banco IS
  'Código BCRA (primeros 3 dígitos del CBU). Permite autodetectar el banco al pegar un CBU. Null en billeteras (usan bancos socios).';
COMMENT ON COLUMN info_bancaria.entidad_id IS
  'FK al catálogo de entidades_financieras. Reemplaza progresivamente el text banco. Si es null se cae al texto legacy hasta que el usuario lo migre.';
