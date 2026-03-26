-- =============================================================
-- Custom Access Token Hook para Flux by Salix
-- Inyecta empresa_id, rol y es_superadmin en el JWT de Supabase
-- Se ejecuta automaticamente cada vez que Supabase genera un token
-- =============================================================

-- Crear schema para hooks si no existe
CREATE SCHEMA IF NOT EXISTS flux_hooks;

-- Funcion que Supabase llama al generar el access token
CREATE OR REPLACE FUNCTION flux_hooks.custom_access_token(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _user_id uuid;
  _empresa_activa_id uuid;
  _rol text;
  _es_superadmin boolean;
  _claims jsonb;
BEGIN
  -- Extraer user_id del evento
  _user_id := (event -> 'user_id')::text::uuid;

  -- Leer empresa_activa_id de app_metadata
  _empresa_activa_id := (
    event -> 'claims' -> 'app_metadata' ->> 'empresa_activa_id'
  )::uuid;

  -- Si no tiene empresa activa, devolver claims sin modificar
  IF _empresa_activa_id IS NULL THEN
    RETURN event;
  END IF;

  -- Buscar rol del miembro en la empresa activa
  SELECT m.rol INTO _rol
  FROM public.miembros m
  WHERE m.usuario_id = _user_id
    AND m.empresa_id = _empresa_activa_id
    AND m.activo = true;

  -- Si no es miembro activo, no inyectar claims de empresa
  IF _rol IS NULL THEN
    RETURN event;
  END IF;

  -- Verificar si es superadmin (campo en perfiles o app_metadata)
  _es_superadmin := COALESCE(
    (event -> 'claims' -> 'app_metadata' ->> 'es_superadmin')::boolean,
    false
  );

  -- Construir claims adicionales
  _claims := event -> 'claims';
  _claims := jsonb_set(_claims, '{empresa_id}', to_jsonb(_empresa_activa_id::text));
  _claims := jsonb_set(_claims, '{rol}', to_jsonb(_rol));
  _claims := jsonb_set(_claims, '{es_superadmin}', to_jsonb(_es_superadmin));

  -- Devolver evento con claims modificados
  event := jsonb_set(event, '{claims}', _claims);
  RETURN event;
END;
$$;

-- Revocar acceso publico y dar permiso solo a supabase_auth_admin
REVOKE ALL ON FUNCTION flux_hooks.custom_access_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION flux_hooks.custom_access_token TO supabase_auth_admin;

-- Dar permisos de lectura en miembros a supabase_auth_admin (necesario para el SELECT)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.miembros TO supabase_auth_admin;

-- =============================================================
-- IMPORTANTE: Despues de ejecutar este SQL, hay que activar el hook
-- en el Dashboard de Supabase:
--   Authentication > Hooks > Custom Access Token
--   Schema: flux_hooks
--   Function: custom_access_token
-- =============================================================
