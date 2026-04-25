-- =============================================================================
-- Migración: sincronización unidireccional perfil → contacto vinculado
-- Fecha: 2026-04-24
-- Descripción:
--   Cuando un miembro tiene un contacto vinculado (contactos.miembro_id != null),
--   los datos personales del miembro (nombre, apellido, correo, teléfono personal,
--   teléfono de empresa) se sincronizan automáticamente al contacto.
--
--   Sync UNIDIRECCIONAL: del perfil al contacto. Para editar esos campos hay que
--   tener permiso de "Usuarios" (los endpoints de contacto los rechazan).
--
--   Convención de teléfonos en el contacto:
--     - perfil.telefono         → contacto_telefonos.tipo='movil',   origen='sync_perfil_personal'
--     - perfil.telefono_empresa → contacto_telefonos.tipo='trabajo', origen='sync_perfil_empresa'
--
--   El correo de empresa del miembro NO se sincroniza al contacto (decisión de producto).
-- =============================================================================


-- =============================================================================
-- 1. Columna `origen` en contacto_telefonos
-- =============================================================================

ALTER TABLE contacto_telefonos ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN contacto_telefonos.origen IS
  'Procedencia del registro: manual | sync_perfil_personal | sync_perfil_empresa. Las filas con origen sync_* son administradas por el trigger sync_perfil_a_contactos y NO deben editarse desde el contacto.';


-- =============================================================================
-- 2. Función de normalización AR (defensiva, no reemplaza libphonenumber)
-- =============================================================================

CREATE OR REPLACE FUNCTION normalizar_telefono_ar(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digitos text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  digitos := regexp_replace(input, '[^0-9]', '', 'g');
  IF length(digitos) < 6 THEN RETURN NULL; END IF;
  -- Móvil AR canónico (549 + 10-11)
  IF digitos LIKE '549%' AND length(digitos) BETWEEN 12 AND 13 THEN
    RETURN digitos;
  END IF;
  -- 54 sin 9 → agregar el 9 (asumir móvil)
  IF digitos LIKE '54%' AND digitos NOT LIKE '549%' AND length(digitos) BETWEEN 11 AND 12 THEN
    RETURN '549' || substring(digitos from 3);
  END IF;
  -- Sin código país, longitud razonable de móvil AR → agregar 549
  IF length(digitos) BETWEEN 10 AND 11 AND digitos NOT LIKE '54%' THEN
    RETURN '549' || digitos;
  END IF;
  RETURN digitos;
END;
$$;


-- =============================================================================
-- 3. Helper: sincroniza un teléfono específico (insertar/actualizar/borrar)
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_telefono_perfil_a_contacto(
  p_contacto_id uuid,
  p_empresa_id uuid,
  p_valor_perfil text,
  p_tipo text,
  p_origen text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_norm text;
  v_existe_id uuid;
  v_manual_existe boolean;
BEGIN
  v_valor_norm := normalizar_telefono_ar(p_valor_perfil);

  SELECT id INTO v_existe_id
  FROM contacto_telefonos
  WHERE contacto_id = p_contacto_id AND origen = p_origen
  LIMIT 1;

  -- Perfil sin teléfono → borrar el sincronizado si existía
  IF v_valor_norm IS NULL THEN
    IF v_existe_id IS NOT NULL THEN
      DELETE FROM contacto_telefonos WHERE id = v_existe_id;
    END IF;
    RETURN;
  END IF;

  -- Si ya existe una fila MANUAL con ese mismo valor en el contacto, no creamos
  -- una sync (evita duplicado visual). Si había una sync vieja con OTRO valor,
  -- la borramos porque ahora coincide con la manual.
  SELECT EXISTS (
    SELECT 1 FROM contacto_telefonos
    WHERE contacto_id = p_contacto_id
      AND valor = v_valor_norm
      AND origen = 'manual'
  ) INTO v_manual_existe;

  IF v_manual_existe THEN
    IF v_existe_id IS NOT NULL THEN
      DELETE FROM contacto_telefonos WHERE id = v_existe_id;
    END IF;
    RETURN;
  END IF;

  IF v_existe_id IS NOT NULL THEN
    UPDATE contacto_telefonos
    SET valor = v_valor_norm,
        tipo = p_tipo,
        es_whatsapp = (p_tipo = 'movil'),
        actualizado_en = now()
    WHERE id = v_existe_id
      AND (valor IS DISTINCT FROM v_valor_norm
        OR tipo IS DISTINCT FROM p_tipo
        OR es_whatsapp IS DISTINCT FROM (p_tipo = 'movil'));
  ELSE
    INSERT INTO contacto_telefonos (
      empresa_id, contacto_id, tipo, valor,
      es_whatsapp, es_principal, etiqueta, orden, origen, creado_por
    ) VALUES (
      p_empresa_id, p_contacto_id, p_tipo, v_valor_norm,
      (p_tipo = 'movil'), false, NULL, 0, p_origen,
      '00000000-0000-0000-0000-000000000000'
    );
  END IF;
END;
$$;


-- =============================================================================
-- 4. Trigger function: sincroniza el perfil a todos sus contactos vinculados
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_perfil_a_contactos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_correo_norm text;
BEGIN
  v_correo_norm := NULLIF(trim(lower(COALESCE(NEW.correo, ''))), '');

  -- Iterar sobre cada contacto vinculado a algún miembro de este perfil
  -- (un perfil puede ser miembro de varias empresas, y en cada una tener su contacto)
  FOR rec IN
    SELECT c.id AS contacto_id, c.empresa_id
    FROM contactos c
    JOIN miembros m ON m.id = c.miembro_id
    WHERE m.usuario_id = NEW.id AND c.en_papelera = false
  LOOP
    -- Sincronizar nombre / apellido / correo (solo si cambió, evita ruido en auditoría)
    UPDATE contactos
    SET nombre = NEW.nombre,
        apellido = NEW.apellido,
        correo = v_correo_norm,
        actualizado_en = now()
    WHERE id = rec.contacto_id
      AND (nombre IS DISTINCT FROM NEW.nombre
        OR apellido IS DISTINCT FROM NEW.apellido
        OR correo IS DISTINCT FROM v_correo_norm);

    -- Sincronizar teléfonos
    PERFORM sync_telefono_perfil_a_contacto(
      rec.contacto_id, rec.empresa_id, NEW.telefono, 'movil', 'sync_perfil_personal'
    );
    PERFORM sync_telefono_perfil_a_contacto(
      rec.contacto_id, rec.empresa_id, NEW.telefono_empresa, 'trabajo', 'sync_perfil_empresa'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_perfil_a_contactos ON perfiles;
CREATE TRIGGER trg_sync_perfil_a_contactos
AFTER INSERT OR UPDATE ON perfiles
FOR EACH ROW EXECUTE FUNCTION sync_perfil_a_contactos();


-- =============================================================================
-- 5. Data-fill: sincronizar perfiles existentes a sus contactos vinculados
-- =============================================================================

-- UPDATE no-op forzado: re-asigna los mismos valores para disparar el trigger
-- en cada perfil que tenga al menos un contacto vinculado.
UPDATE perfiles p
SET nombre = p.nombre,
    apellido = p.apellido,
    correo = p.correo,
    telefono = p.telefono,
    telefono_empresa = p.telefono_empresa,
    actualizado_en = now()
WHERE p.id IN (
  SELECT DISTINCT m.usuario_id
  FROM miembros m
  JOIN contactos c ON c.miembro_id = m.id
  WHERE m.usuario_id IS NOT NULL
    AND c.en_papelera = false
);

COMMENT ON FUNCTION sync_perfil_a_contactos() IS
  'Sincroniza nombre/apellido/correo/teléfonos del perfil a todos sus contactos vinculados (uno por empresa). Unidireccional: solo perfil → contacto. La edición desde el contacto está bloqueada en el endpoint PATCH para campos sincronizados.';
