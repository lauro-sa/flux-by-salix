-- =============================================================================
-- Migración: agregar columna `genero` a contactos + sincronizarla desde perfil
-- Fecha: 2026-05-02
-- Descripción:
--   Misma motivación que `fecha_nacimiento` (migración 20260424010000):
--   los empleados sin cuenta Flux (miembros con usuario_id NULL) viven
--   íntegramente en `contactos` y necesitan persistir TODOS los datos
--   personales que muestra el editor de usuario, no solo nombre/correo/tel.
--
--   El trigger sync_perfil_a_contactos copia los datos del perfil al contacto
--   cuando el empleado tiene cuenta. Para que el contrato sea idéntico
--   también para empleados sin cuenta, contactos debe tener la columna y el
--   trigger debe sincronizarla.
-- =============================================================================


-- =============================================================================
-- 1. Agregar columna `genero` a contactos
-- =============================================================================

ALTER TABLE contactos ADD COLUMN IF NOT EXISTS genero text;

COMMENT ON COLUMN contactos.genero IS
  'Género del contacto. Para contactos vinculados a un miembro, se sincroniza desde perfiles.genero vía trigger sync_perfil_a_contactos. Valores convencionales: masculino | femenino | otro.';


-- =============================================================================
-- 2. Trigger function ampliada: sincroniza también `genero`
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
  v_doc_norm text;
BEGIN
  v_correo_norm := NULLIF(trim(lower(COALESCE(NEW.correo, ''))), '');
  v_doc_norm := NULLIF(trim(COALESCE(NEW.documento_numero, '')), '');

  FOR rec IN
    SELECT c.id AS contacto_id, c.empresa_id
    FROM contactos c
    JOIN miembros m ON m.id = c.miembro_id
    WHERE m.usuario_id = NEW.id AND c.en_papelera = false
  LOOP
    -- Datos directos del contacto
    UPDATE contactos
    SET nombre = NEW.nombre,
        apellido = NEW.apellido,
        correo = v_correo_norm,
        avatar_url = NEW.avatar_url,
        numero_identificacion = v_doc_norm,
        fecha_nacimiento = NEW.fecha_nacimiento,
        genero = NEW.genero,
        actualizado_en = now()
    WHERE id = rec.contacto_id
      AND (nombre IS DISTINCT FROM NEW.nombre
        OR apellido IS DISTINCT FROM NEW.apellido
        OR correo IS DISTINCT FROM v_correo_norm
        OR avatar_url IS DISTINCT FROM NEW.avatar_url
        OR numero_identificacion IS DISTINCT FROM v_doc_norm
        OR fecha_nacimiento IS DISTINCT FROM NEW.fecha_nacimiento
        OR genero IS DISTINCT FROM NEW.genero);

    -- Teléfonos (función auxiliar)
    PERFORM sync_telefono_perfil_a_contacto(
      rec.contacto_id, rec.empresa_id, NEW.telefono, 'movil', 'sync_perfil_personal'
    );
    PERFORM sync_telefono_perfil_a_contacto(
      rec.contacto_id, rec.empresa_id, NEW.telefono_empresa, 'trabajo', 'sync_perfil_empresa'
    );

    -- Dirección (función auxiliar)
    PERFORM sync_direccion_perfil_a_contacto(
      rec.contacto_id, NEW.direccion, NEW.domicilio
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- =============================================================================
-- 3. Re-disparar el data-fill para sincronizar el género de perfiles existentes
-- =============================================================================

UPDATE perfiles p
SET genero = p.genero,
    actualizado_en = now()
WHERE p.id IN (
  SELECT DISTINCT m.usuario_id
  FROM miembros m
  JOIN contactos c ON c.miembro_id = m.id
  WHERE m.usuario_id IS NOT NULL AND c.en_papelera = false
);
