-- =============================================================================
-- Migración: ampliar sync perfil → contacto a TODOS los datos personales
-- Fecha: 2026-04-24
-- Descripción:
--   Extiende el trigger sync_perfil_a_contactos (creado en 20260424000000) para
--   sincronizar también:
--     - avatar_url        → contactos.avatar_url
--     - documento_numero  → contactos.numero_identificacion
--     - fecha_nacimiento  → contactos.fecha_nacimiento  (columna nueva)
--     - direccion (jsonb) → contacto_direcciones (con origen='sync_perfil')
--
--   El usuario debe tener "el contacto completo" idéntico a su perfil cuando
--   está vinculado a un miembro. Los campos extra van con candado en la UI y se
--   editan exclusivamente desde "Usuarios".
-- =============================================================================


-- =============================================================================
-- 1. Agregar columnas faltantes
-- =============================================================================

ALTER TABLE contactos ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE contacto_direcciones ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN contacto_direcciones.origen IS
  'Procedencia: manual (cargada desde la ficha) | sync_perfil (sincronizada del perfil del miembro vinculado). Las filas sync_perfil son administradas por el trigger sync_perfil_a_contactos y NO deben editarse desde el contacto.';


-- =============================================================================
-- 2. Helper: sincronizar la dirección del perfil al contacto
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_direccion_perfil_a_contacto(
  p_contacto_id uuid,
  p_direccion_jsonb jsonb,
  p_domicilio_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe_id uuid;
  v_calle text;
  v_barrio text;
  v_ciudad text;
  v_provincia text;
  v_codigo_postal text;
  v_pais text;
  v_piso text;
  v_departamento text;
  v_lat double precision;
  v_lng double precision;
  v_texto text;
  v_es_principal boolean;
BEGIN
  -- Buscar si ya existe la dirección sincronizada
  SELECT id INTO v_existe_id
  FROM contacto_direcciones
  WHERE contacto_id = p_contacto_id AND origen = 'sync_perfil'
  LIMIT 1;

  -- Si el perfil no tiene dirección → borrar la sincronizada
  IF p_direccion_jsonb IS NULL OR jsonb_typeof(p_direccion_jsonb) <> 'object' THEN
    IF v_existe_id IS NOT NULL THEN
      DELETE FROM contacto_direcciones WHERE id = v_existe_id;
    END IF;
    RETURN;
  END IF;

  -- Extraer campos del JSONB del perfil. Soporta dos shapes que conviven en datos viejos:
  -- (a) {calle, barrio, ciudad, provincia, codigoPostal, pais, piso, departamento, coordenadas:{lat,lng}, textoCompleto}
  -- (b) {calle, barrio, ciudad, cp}  ← más viejo
  v_calle         := COALESCE(p_direccion_jsonb->>'calle', '');
  v_barrio        := COALESCE(p_direccion_jsonb->>'barrio', '');
  v_ciudad        := COALESCE(p_direccion_jsonb->>'ciudad', '');
  v_provincia     := COALESCE(p_direccion_jsonb->>'provincia', '');
  v_codigo_postal := COALESCE(p_direccion_jsonb->>'codigoPostal', p_direccion_jsonb->>'cp', '');
  v_pais          := COALESCE(p_direccion_jsonb->>'pais', '');
  v_piso          := COALESCE(p_direccion_jsonb->>'piso', '');
  v_departamento  := COALESCE(p_direccion_jsonb->>'departamento', '');
  v_texto         := COALESCE(p_direccion_jsonb->>'textoCompleto', NULLIF(trim(p_domicilio_text), ''), '');
  v_lat           := NULLIF(p_direccion_jsonb#>>'{coordenadas,lat}', '')::double precision;
  v_lng           := NULLIF(p_direccion_jsonb#>>'{coordenadas,lng}', '')::double precision;

  -- Es principal si el contacto no tiene OTRA dirección manual marcada como principal
  SELECT NOT EXISTS (
    SELECT 1 FROM contacto_direcciones
    WHERE contacto_id = p_contacto_id
      AND es_principal = true
      AND origen <> 'sync_perfil'
  ) INTO v_es_principal;

  IF v_existe_id IS NOT NULL THEN
    UPDATE contacto_direcciones
    SET calle = NULLIF(v_calle, ''),
        barrio = NULLIF(v_barrio, ''),
        ciudad = NULLIF(v_ciudad, ''),
        provincia = NULLIF(v_provincia, ''),
        codigo_postal = NULLIF(v_codigo_postal, ''),
        pais = NULLIF(v_pais, ''),
        piso = NULLIF(v_piso, ''),
        departamento = NULLIF(v_departamento, ''),
        lat = v_lat,
        lng = v_lng,
        texto = NULLIF(v_texto, ''),
        es_principal = v_es_principal
    WHERE id = v_existe_id;
  ELSE
    INSERT INTO contacto_direcciones (
      contacto_id, tipo, calle, barrio, ciudad, provincia, codigo_postal, pais,
      piso, departamento, lat, lng, texto, es_principal, origen
    ) VALUES (
      p_contacto_id, 'principal',
      NULLIF(v_calle, ''), NULLIF(v_barrio, ''), NULLIF(v_ciudad, ''),
      NULLIF(v_provincia, ''), NULLIF(v_codigo_postal, ''), NULLIF(v_pais, ''),
      NULLIF(v_piso, ''), NULLIF(v_departamento, ''),
      v_lat, v_lng, NULLIF(v_texto, ''),
      v_es_principal, 'sync_perfil'
    );
  END IF;
END;
$$;


-- =============================================================================
-- 3. Trigger function ampliada: sincroniza TODOS los datos personales
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
        actualizado_en = now()
    WHERE id = rec.contacto_id
      AND (nombre IS DISTINCT FROM NEW.nombre
        OR apellido IS DISTINCT FROM NEW.apellido
        OR correo IS DISTINCT FROM v_correo_norm
        OR avatar_url IS DISTINCT FROM NEW.avatar_url
        OR numero_identificacion IS DISTINCT FROM v_doc_norm
        OR fecha_nacimiento IS DISTINCT FROM NEW.fecha_nacimiento);

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
-- 4. Re-disparar el data-fill para sincronizar datos existentes
-- =============================================================================

UPDATE perfiles p
SET nombre = p.nombre, apellido = p.apellido, correo = p.correo,
    telefono = p.telefono, telefono_empresa = p.telefono_empresa,
    avatar_url = p.avatar_url, documento_numero = p.documento_numero,
    fecha_nacimiento = p.fecha_nacimiento, direccion = p.direccion,
    domicilio = p.domicilio,
    actualizado_en = now()
WHERE p.id IN (
  SELECT DISTINCT m.usuario_id
  FROM miembros m
  JOIN contactos c ON c.miembro_id = m.id
  WHERE m.usuario_id IS NOT NULL AND c.en_papelera = false
);
