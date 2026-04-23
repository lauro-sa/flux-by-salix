-- =============================================================================
-- Migración: contacto_telefonos — modelo N teléfonos por contacto
-- Fecha: 2026-04-22
-- Descripción:
--   Reemplaza el modelo rígido contactos.telefono + contactos.whatsapp por una
--   tabla normalizada contacto_telefonos que soporta múltiples teléfonos por
--   contacto, cada uno con su tipo y flag es_whatsapp independiente.
--
--   La migración:
--     1. Crea contacto_telefonos + auditoria_contacto_telefonos con RLS multi-tenant.
--     2. Pobla contacto_telefonos a partir de contactos.telefono / contactos.whatsapp
--        cubriendo los 4 casos: ambos iguales / solo telefono móvil AR / solo telefono
--        fijo o intl / solo whatsapp / ambos distintos.
--     3. Crea un trigger AFTER INSERT/UPDATE/DELETE en contacto_telefonos que mantiene
--        sincronizadas las columnas legacy contactos.telefono y contactos.whatsapp con
--        el principal y el primer es_whatsapp del contacto. Es TEMPORAL — cuando se
--        eliminen las columnas legacy en un PR posterior, eliminar también este trigger.
--
--   Las columnas contactos.telefono y contactos.whatsapp se mantienen durante la
--   transición para no romper consumidores legacy mientras se migran uno a uno.
-- =============================================================================


-- =============================================================================
-- 1. Tabla contacto_telefonos
-- =============================================================================

CREATE TABLE IF NOT EXISTS contacto_telefonos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contacto_id     uuid NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  -- 'movil' | 'fijo' | 'trabajo' | 'casa' | 'otro' (selector UI nueva)
  -- 'whatsapp' aparece SOLO en data-fill legacy (contactos que tenían whatsapp sin telefono).
  -- La UI nueva nunca lo genera; el sync defensivo lo excluye del relleno de contactos.telefono.
  tipo            text NOT NULL,
  -- Número normalizado (E.164 sin +, regla del 9 para AR aplicada). Ver normalizarTelefono().
  valor           text NOT NULL,
  -- Permite marcar "móvil + WhatsApp" en un solo registro sin duplicar.
  es_whatsapp     boolean NOT NULL DEFAULT false,
  es_principal    boolean NOT NULL DEFAULT false,
  -- Texto libre opcional para describir el teléfono ("oficina central", "personal", etc).
  etiqueta        text,
  orden           integer NOT NULL DEFAULT 0,
  -- Auditoría estándar (memoria feedback_auditoria_tablas)
  creado_por      uuid,
  editado_por     uuid,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- Búsqueda por contacto (carga de la ficha)
CREATE INDEX IF NOT EXISTS contacto_telefonos_contacto_idx
  ON contacto_telefonos(contacto_id);

-- Búsqueda y dedup por valor dentro de la empresa
CREATE INDEX IF NOT EXISTS contacto_telefonos_empresa_valor_idx
  ON contacto_telefonos(empresa_id, valor);

-- Lookup específico del webhook WhatsApp (filtra solo los WA-aptos)
CREATE INDEX IF NOT EXISTS contacto_telefonos_whatsapp_idx
  ON contacto_telefonos(empresa_id, valor) WHERE es_whatsapp = true;

-- Garantía de unicidad: máximo un principal por contacto.
CREATE UNIQUE INDEX IF NOT EXISTS contacto_telefonos_principal_uniq
  ON contacto_telefonos(contacto_id) WHERE es_principal = true;

-- RLS multi-tenant
ALTER TABLE contacto_telefonos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_contacto_telefonos_empresa" ON contacto_telefonos;
CREATE POLICY "rls_contacto_telefonos_empresa" ON contacto_telefonos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);


-- =============================================================================
-- 2. Tabla auditoria_contacto_telefonos
--    Mismo patrón que auditoria_contactos / auditoria_asistencias.
-- =============================================================================

CREATE TABLE IF NOT EXISTS auditoria_contacto_telefonos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  telefono_id       uuid NOT NULL,
  editado_por       uuid NOT NULL,
  campo_modificado  text NOT NULL,
  valor_anterior    text,
  valor_nuevo       text,
  motivo            text,
  creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_contacto_telefonos_telefono_idx
  ON auditoria_contacto_telefonos(telefono_id);

CREATE INDEX IF NOT EXISTS auditoria_contacto_telefonos_empresa_idx
  ON auditoria_contacto_telefonos(empresa_id);

ALTER TABLE auditoria_contacto_telefonos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_auditoria_contacto_telefonos_empresa" ON auditoria_contacto_telefonos;
CREATE POLICY "rls_auditoria_contacto_telefonos_empresa" ON auditoria_contacto_telefonos
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);


-- =============================================================================
-- 3. Data-fill desde contactos.telefono / contactos.whatsapp
--
--   Reglas (acordadas con producto):
--     A. telefono = whatsapp (no nulos)         → 1 fila: movil + es_whatsapp + principal
--     B1. solo telefono, prefijo '549'          → 1 fila: movil + principal
--     B2. solo telefono, otros (fijo / intl)    → 1 fila: fijo + principal
--     C. solo whatsapp                          → 1 fila: whatsapp + es_whatsapp + principal
--     D. ambos no nulos y distintos             → 2 filas: telefono fijo principal +
--                                                            whatsapp es_whatsapp orden=1
--
--   El trigger de sync se crea DESPUÉS del data-fill para evitar que se dispare
--   932 veces durante el INSERT bulk reescribiendo contactos.telefono/whatsapp con
--   los mismos valores que ya tienen.
-- =============================================================================

WITH datos AS (
  SELECT
    c.id           AS contacto_id,
    c.empresa_id,
    c.creado_por,
    NULLIF(trim(COALESCE(c.telefono, '')), '') AS tel,
    NULLIF(trim(COALESCE(c.whatsapp, '')), '') AS wa
  FROM contactos c
  WHERE NOT EXISTS (
    SELECT 1 FROM contacto_telefonos ct WHERE ct.contacto_id = c.id
  )
)
INSERT INTO contacto_telefonos (
  empresa_id, contacto_id, tipo, valor, es_whatsapp, es_principal, orden, creado_por
)
-- Caso A: ambos iguales → 1 fila movil + es_whatsapp + principal
SELECT empresa_id, contacto_id, 'movil', tel, true, true, 0, creado_por
FROM datos
WHERE tel IS NOT NULL AND wa IS NOT NULL AND tel = wa

UNION ALL

-- Caso B1: solo telefono, móvil AR (prefijo 549, longitud razonable)
SELECT empresa_id, contacto_id, 'movil', tel, false, true, 0, creado_por
FROM datos
WHERE tel IS NOT NULL AND wa IS NULL
  AND tel ~ '^549' AND length(tel) BETWEEN 12 AND 13

UNION ALL

-- Caso B2: solo telefono, resto (fijo / internacional sin coincidir con móvil AR)
SELECT empresa_id, contacto_id, 'fijo', tel, false, true, 0, creado_por
FROM datos
WHERE tel IS NOT NULL AND wa IS NULL
  AND NOT (tel ~ '^549' AND length(tel) BETWEEN 12 AND 13)

UNION ALL

-- Caso C: solo whatsapp → tipo='whatsapp' (legacy: la UI nueva nunca emite este tipo)
SELECT empresa_id, contacto_id, 'whatsapp', wa, true, true, 0, creado_por
FROM datos
WHERE tel IS NULL AND wa IS NOT NULL

UNION ALL

-- Caso D parte 1: ambos distintos, telefono → fijo principal
SELECT empresa_id, contacto_id, 'fijo', tel, false, true, 0, creado_por
FROM datos
WHERE tel IS NOT NULL AND wa IS NOT NULL AND tel <> wa

UNION ALL

-- Caso D parte 2: ambos distintos, whatsapp → tipo='whatsapp' es_whatsapp (NO principal)
SELECT empresa_id, contacto_id, 'whatsapp', wa, true, false, 1, creado_por
FROM datos
WHERE tel IS NOT NULL AND wa IS NOT NULL AND tel <> wa;


-- =============================================================================
-- 4. Trigger de sincronización contactos.telefono / contactos.whatsapp
--
--   TEMPORAL — eliminar este trigger junto con las columnas legacy en el PR
--   que las droppee.
--
--   Reglas (acordadas con producto):
--     contactos.telefono ← valor del registro con es_principal=true Y tipo <> 'whatsapp'
--                          (salvaguarda defensiva: tipo='whatsapp' es solo legacy
--                           de data-fill, no debe llenar la columna telefono porque
--                           600 contactos del caso C nunca tuvieron contactos.telefono
--                           y los consumidores legacy filtran por NULL para
--                           distinguir "tiene línea telefónica" de "solo WhatsApp")
--     contactos.whatsapp ← valor del primer registro con es_whatsapp=true,
--                          priorizando el principal si también es es_whatsapp,
--                          sino orden ASC, sino creado_en ASC
--                          (queda NULL si no hay ningún es_whatsapp)
--
--   El trigger usa SECURITY DEFINER para poder actualizar contactos sin necesidad
--   de que el caller tenga permisos directos sobre esa tabla — la RLS de
--   contacto_telefonos ya validó multi-tenancy antes de llegar acá.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_contacto_principal_telefonos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contacto_id uuid;
  v_telefono    text;
  v_whatsapp    text;
BEGIN
  -- El contacto afectado viene de NEW (insert/update) u OLD (delete)
  IF TG_OP = 'DELETE' THEN
    v_contacto_id := OLD.contacto_id;
  ELSE
    v_contacto_id := NEW.contacto_id;
  END IF;

  -- Principal NO whatsapp → llena contactos.telefono
  SELECT valor INTO v_telefono
  FROM contacto_telefonos
  WHERE contacto_id = v_contacto_id
    AND es_principal = true
    AND tipo <> 'whatsapp'
  LIMIT 1;

  -- Primer es_whatsapp (priorizando principal) → llena contactos.whatsapp
  SELECT valor INTO v_whatsapp
  FROM contacto_telefonos
  WHERE contacto_id = v_contacto_id
    AND es_whatsapp = true
  ORDER BY es_principal DESC, orden ASC, creado_en ASC
  LIMIT 1;

  UPDATE contactos
  SET telefono = v_telefono,
      whatsapp = v_whatsapp
  WHERE id = v_contacto_id
    AND (telefono IS DISTINCT FROM v_telefono OR whatsapp IS DISTINCT FROM v_whatsapp);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contacto_principal_telefonos ON contacto_telefonos;
CREATE TRIGGER trg_sync_contacto_principal_telefonos
AFTER INSERT OR UPDATE OR DELETE ON contacto_telefonos
FOR EACH ROW EXECUTE FUNCTION sync_contacto_principal_telefonos();


-- =============================================================================
-- 5. Sincronización inicial post data-fill
--
--   El data-fill insertó filas con el trigger todavía no creado, así que las
--   columnas contactos.telefono / contactos.whatsapp quedaron como estaban
--   (que es justo lo que queríamos: idénticas al estado pre-migración).
--   Sin embargo, debemos correr el sync defensivo una vez para neutralizar el
--   caso C: hoy contactos.telefono ya es NULL para esos 600 contactos
--   (porque siempre lo fue), entonces no cambia nada — pero corremos el sync
--   para garantizar que el invariante "telefono refleja al principal no-whatsapp"
--   se cumple para todos.
-- =============================================================================

UPDATE contactos c
SET telefono = sub.tel_principal,
    whatsapp = sub.wa_primero
FROM (
  SELECT
    ct.contacto_id,
    (SELECT valor FROM contacto_telefonos
     WHERE contacto_id = ct.contacto_id
       AND es_principal = true
       AND tipo <> 'whatsapp'
     LIMIT 1) AS tel_principal,
    (SELECT valor FROM contacto_telefonos
     WHERE contacto_id = ct.contacto_id
       AND es_whatsapp = true
     ORDER BY es_principal DESC, orden ASC, creado_en ASC
     LIMIT 1) AS wa_primero
  FROM contacto_telefonos ct
  GROUP BY ct.contacto_id
) sub
WHERE c.id = sub.contacto_id
  AND (c.telefono IS DISTINCT FROM sub.tel_principal
    OR c.whatsapp IS DISTINCT FROM sub.wa_primero);


-- =============================================================================
-- 6. Documentación inline
-- =============================================================================

COMMENT ON TABLE contacto_telefonos IS
  'Lista normalizada de teléfonos por contacto. Reemplaza contactos.telefono + contactos.whatsapp. Las columnas legacy en contactos se mantienen sincronizadas vía trigger durante la transición.';

COMMENT ON COLUMN contacto_telefonos.tipo IS
  'Tipo de línea: movil | fijo | trabajo | casa | otro. El valor whatsapp solo aparece en data-fill legacy y la UI nueva nunca lo emite.';

COMMENT ON COLUMN contacto_telefonos.es_whatsapp IS
  'true si este número recibe WhatsApp. Permite marcar movil + WhatsApp en un solo registro sin duplicar.';

COMMENT ON FUNCTION sync_contacto_principal_telefonos() IS
  'TEMPORAL: mantiene contactos.telefono/whatsapp sincronizadas con contacto_telefonos durante la transición. Eliminar junto con las columnas legacy.';
