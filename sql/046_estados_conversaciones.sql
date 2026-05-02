-- =============================================================
-- Migración 046: Estados configurables de conversaciones (inbox)
-- =============================================================
-- Conecta `conversaciones` a la infraestructura genérica (044).
-- Es la primera entidad con TRANSICIONES MANUALES desde la UI:
-- el usuario marca como resuelta, en espera, spam, etc.
--
-- Estrategia ADITIVA con doble escritura `estado` ↔ `estado_clave`,
-- igual al PR 2 (cuotas).
--
-- Estados reales en uso (verificado contra BD y código):
--   abierta    — conversación activa esperando respuesta interna
--   en_espera  — esperando respuesta del contacto externo
--   resuelta   — atendida y cerrada
--   spam       — descartada por contenido no deseado
--
-- (El comentario viejo del schema mencionaba 'cerrada/archivada',
--  pero esos valores no existen en BD ni en código — comentario
--  obsoleto que se corrige acá.)
-- =============================================================


-- =============================================================
-- 1) Tabla estados_conversacion
-- =============================================================
CREATE TABLE IF NOT EXISTS public.estados_conversacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,
  etiqueta text NOT NULL,
  grupo text NOT NULL DEFAULT 'activo',
  icono text NOT NULL DEFAULT 'Circle',
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estados_conversacion_empresa_idx
  ON public.estados_conversacion (empresa_id, clave) WHERE activo = true;

CREATE UNIQUE INDEX IF NOT EXISTS estados_conversacion_unique_idx
  ON public.estados_conversacion (
    COALESCE(empresa_id::text, '__sistema__'),
    clave
  );

ALTER TABLE public.estados_conversacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estados_conversacion_select" ON public.estados_conversacion
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_conversacion_insert" ON public.estados_conversacion
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_conversacion_update" ON public.estados_conversacion
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_conversacion_delete" ON public.estados_conversacion
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);


-- =============================================================
-- 2) Sembrar estados de sistema
-- =============================================================
INSERT INTO public.estados_conversacion (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'abierta',   'Abierta',   'activo',     'CircleDot',    '#5b5bd6', 1, true),
  (NULL, 'en_espera', 'En espera', 'espera',     'CircleDashed', '#d97706', 2, true),
  (NULL, 'resuelta',  'Resuelta',  'completado', 'CircleCheck',  '#16a34a', 3, true),
  (NULL, 'spam',      'Spam',      'cancelado',  'CircleSlash',  '#dc2626', 4, true)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 3) Sembrar transiciones manuales del sistema
-- =============================================================
-- Todas son transiciones de usuario (es_automatica=false) — aparecen
-- en la UI como acciones disponibles. La sincronización IMAP que
-- marca correos como 'resuelta' usa origen='sistema' en cambios_estado
-- pero igual la transición sigue siendo legal según este catálogo.
-- =============================================================
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, orden)
VALUES
  -- Desde abierta
  (NULL, 'conversacion', 'abierta',   'en_espera', 'Marcar en espera', false, 1),
  (NULL, 'conversacion', 'abierta',   'resuelta',  'Resolver',         false, 2),
  (NULL, 'conversacion', 'abierta',   'spam',      'Marcar como spam', false, 3),
  -- Desde en_espera
  (NULL, 'conversacion', 'en_espera', 'abierta',   'Reabrir',          false, 4),
  (NULL, 'conversacion', 'en_espera', 'resuelta',  'Resolver',         false, 5),
  (NULL, 'conversacion', 'en_espera', 'spam',      'Marcar como spam', false, 6),
  -- Desde resuelta (reabrir)
  (NULL, 'conversacion', 'resuelta',  'abierta',   'Reabrir',          false, 7),
  -- Desde spam (restaurar)
  (NULL, 'conversacion', 'spam',      'abierta',   'No es spam',       false, 8)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 4) Nuevas columnas en `conversaciones`
-- =============================================================
ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_conversacion(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_conversacion(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

-- Nuevo índice sobre estado_clave (el viejo `conversaciones_estado_idx`
-- sobre la columna `estado` legacy se mantiene hasta el cleanup final).
CREATE INDEX IF NOT EXISTS conversaciones_estado_clave_idx
  ON public.conversaciones (empresa_id, estado_clave);


-- =============================================================
-- 5) Backfill
-- =============================================================
UPDATE public.conversaciones c
SET
  estado_clave = c.estado,
  estado_id = (
    SELECT ec.id FROM public.estados_conversacion ec
    WHERE ec.clave = c.estado AND ec.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = COALESCE(c.cerrado_en, c.actualizado_en, c.creado_en)
WHERE c.estado_clave IS NULL OR c.estado_id IS NULL;


-- =============================================================
-- 6) Función helper resolver_estado_conversacion_id
-- =============================================================
CREATE OR REPLACE FUNCTION public.resolver_estado_conversacion_id(
  p_empresa_id uuid,
  p_clave text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.estados_conversacion
  WHERE clave = p_clave
    AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_conversacion_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_conversacion_id(uuid, text) TO authenticated, service_role;


-- =============================================================
-- 7) Trigger BEFORE INSERT/UPDATE — sincronizar estado/estado_clave
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_conversaciones_sincronizar_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_clave text;
  v_id_resuelto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_clave := COALESCE(NEW.estado_clave, NEW.estado);
  ELSE
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN
      v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_clave := NEW.estado;
    ELSE
      v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;

  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  v_id_resuelto := public.resolver_estado_conversacion_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_conversaciones_sincronizar_estado: clave de estado inválida para conversacion: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversaciones_sincronizar_estado ON public.conversaciones;
CREATE TRIGGER conversaciones_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.tr_conversaciones_sincronizar_estado();


-- =============================================================
-- 8) Trigger AFTER UPDATE — registrar cambio
-- =============================================================
-- A diferencia de cuotas (origen=sistema porque el cambio es derivado),
-- conversaciones tiene origen='manual' por default (el usuario aprieta
-- "Resolver"). El sync IMAP que marca correos como 'resuelta' viene
-- también por este path; el origen real se determina por cómo se
-- haya disparado la operación (auth.uid() presente = manual).
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_conversaciones_registrar_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_grupo_anterior text;
  v_grupo_nuevo text;
  v_usuario_id uuid;
  v_usuario_nombre text;
  v_origen text;
BEGIN
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_anterior FROM public.estados_conversacion WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_conversacion WHERE id = NEW.estado_id;

  -- Capturar el usuario actual si hay sesión.
  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  -- Origen heurístico: si hay usuario es manual, sino sistema.
  -- El sync IMAP corre con service_role (sin auth.uid()) → 'sistema'.
  IF v_usuario_id IS NOT NULL THEN
    v_origen := 'manual';
    SELECT trim(coalesce(nombre,'') || ' ' || coalesce(apellido,''))
    INTO v_usuario_nombre
    FROM public.perfiles WHERE id = v_usuario_id;
  ELSE
    v_origen := 'sistema';
  END IF;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'conversacion',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'tipo_canal',     NEW.tipo_canal,
      'contacto_id',    NEW.contacto_id,
      'asignado_a',     NEW.asignado_a
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversaciones_registrar_cambio_estado ON public.conversaciones;
CREATE TRIGGER conversaciones_registrar_cambio_estado
  AFTER UPDATE ON public.conversaciones
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_conversaciones_registrar_cambio_estado();


-- =============================================================
-- 9) Trigger actualizado_en de estados_conversacion
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_estados_conversacion_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_conversacion_actualizar_timestamp ON public.estados_conversacion;
CREATE TRIGGER estados_conversacion_actualizar_timestamp
  BEFORE UPDATE ON public.estados_conversacion
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_conversacion_actualizar_timestamp();


-- =============================================================
-- 10) Documentación
-- =============================================================
COMMENT ON TABLE public.estados_conversacion IS
  'Estados configurables de conversaciones (inbox). empresa_id NULL = estado del sistema.';

COMMENT ON COLUMN public.conversaciones.estado IS
  'Estado de la conversación (legacy text). Se sincroniza con estado_clave vía trigger durante la transición. Valores: abierta | en_espera | resuelta | spam.';

COMMENT ON COLUMN public.conversaciones.estado_clave IS
  'Clave del estado actual. Source of truth a futuro.';

COMMENT ON COLUMN public.conversaciones.estado_id IS
  'FK a estados_conversacion. Resuelto automáticamente vía trigger.';
