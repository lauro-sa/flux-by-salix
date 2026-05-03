-- =============================================================
-- Migración 048: Estados configurables de visitas
-- =============================================================
-- Conecta visitas a la infraestructura genérica (044). Sigue el mismo
-- patrón que cuotas (PR 2) y conversaciones (PR 3): tabla configurable
-- de estados + doble escritura estado ↔ estado_clave + triggers.
--
-- Estados (sin renombres): programada | en_camino | en_sitio |
-- completada | cancelada | reprogramada
--
-- Las visitas tienen triggers existentes (visitas_actualizar_timestamp,
-- contadores) que NO se tocan: solo se agregan nuestros triggers a la
-- secuencia BEFORE/AFTER UPDATE.
-- =============================================================

-- 1) Tabla estados_visita
CREATE TABLE IF NOT EXISTS public.estados_visita (
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

CREATE INDEX IF NOT EXISTS estados_visita_empresa_idx
  ON public.estados_visita (empresa_id, clave) WHERE activo = true;

CREATE UNIQUE INDEX IF NOT EXISTS estados_visita_unique_idx
  ON public.estados_visita (
    COALESCE(empresa_id::text, '__sistema__'),
    clave
  );

ALTER TABLE public.estados_visita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estados_visita_select" ON public.estados_visita
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_visita_insert" ON public.estados_visita
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_visita_update" ON public.estados_visita
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_visita_delete" ON public.estados_visita
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);


-- 2) Sembrar estados del sistema
INSERT INTO public.estados_visita (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'programada',   'Programada',   'inicial',     'CalendarClock', '#5b5bd6', 1, true),
  (NULL, 'en_camino',    'En camino',    'activo',      'Navigation',    '#0891b2', 2, true),
  (NULL, 'en_sitio',     'En sitio',     'activo',      'MapPin',        '#7c3aed', 3, true),
  (NULL, 'completada',   'Completada',   'completado',  'CircleCheck',   '#16a34a', 4, true),
  (NULL, 'cancelada',    'Cancelada',    'cancelado',   'CircleSlash',   '#dc2626', 5, true),
  (NULL, 'reprogramada', 'Reprogramada', 'activo',      'CalendarSync',  '#d97706', 6, true)
ON CONFLICT DO NOTHING;


-- 3) Sembrar transiciones manuales del sistema
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Desde programada
  (NULL, 'visita', 'programada',   'en_camino',    'Salir a la visita',     false, false, 1),
  (NULL, 'visita', 'programada',   'reprogramada', 'Reprogramar',           false, true,  2),
  (NULL, 'visita', 'programada',   'cancelada',    'Cancelar',              false, true,  3),
  -- Desde en_camino
  (NULL, 'visita', 'en_camino',    'en_sitio',     'Llegué',                false, false, 4),
  (NULL, 'visita', 'en_camino',    'cancelada',    'Cancelar',              false, true,  5),
  -- Desde en_sitio
  (NULL, 'visita', 'en_sitio',     'completada',   'Completar',             false, false, 6),
  (NULL, 'visita', 'en_sitio',     'cancelada',    'Cancelar',              false, true,  7),
  -- Desde reprogramada
  (NULL, 'visita', 'reprogramada', 'programada',   'Confirmar',             false, false, 8),
  (NULL, 'visita', 'reprogramada', 'cancelada',    'Cancelar',              false, true,  9),
  -- Desde completada (corregir si fue marcada por error)
  (NULL, 'visita', 'completada',   'programada',   'Reabrir',               false, true,  10),
  -- Desde cancelada (restaurar)
  (NULL, 'visita', 'cancelada',    'programada',   'Reactivar',             false, false, 11)
ON CONFLICT DO NOTHING;


-- 4) Nuevas columnas en visitas
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_visita(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_visita(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS visitas_estado_clave_idx
  ON public.visitas (empresa_id, estado_clave);


-- 5) Backfill
UPDATE public.visitas v
SET
  estado_clave = v.estado,
  estado_id = (
    SELECT ev.id FROM public.estados_visita ev
    WHERE ev.clave = v.estado AND ev.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = v.actualizado_en
WHERE v.estado_clave IS NULL OR v.estado_id IS NULL;


-- 6) Helper resolver_estado_visita_id
CREATE OR REPLACE FUNCTION public.resolver_estado_visita_id(
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
  FROM public.estados_visita
  WHERE clave = p_clave
    AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_visita_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_visita_id(uuid, text) TO authenticated, service_role;


-- 7) Trigger BEFORE INSERT/UPDATE — sincronizar
CREATE OR REPLACE FUNCTION public.tr_visitas_sincronizar_estado()
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

  v_id_resuelto := public.resolver_estado_visita_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_visitas_sincronizar_estado: clave de estado inválida para visita: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitas_sincronizar_estado ON public.visitas;
CREATE TRIGGER visitas_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.tr_visitas_sincronizar_estado();


-- 8) Trigger AFTER UPDATE — registrar cambio
CREATE OR REPLACE FUNCTION public.tr_visitas_registrar_cambio_estado()
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

  SELECT grupo INTO v_grupo_anterior FROM public.estados_visita WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_visita WHERE id = NEW.estado_id;

  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

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
    p_entidad_tipo    => 'visita',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'contacto_id',   NEW.contacto_id,
      'asignado_a',    NEW.asignado_a,
      'direccion_id',  NEW.direccion_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitas_registrar_cambio_estado ON public.visitas;
CREATE TRIGGER visitas_registrar_cambio_estado
  AFTER UPDATE ON public.visitas
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_visitas_registrar_cambio_estado();


-- 9) Trigger actualizado_en de estados_visita
CREATE OR REPLACE FUNCTION public.tr_estados_visita_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_visita_actualizar_timestamp ON public.estados_visita;
CREATE TRIGGER estados_visita_actualizar_timestamp
  BEFORE UPDATE ON public.estados_visita
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_visita_actualizar_timestamp();


-- 10) Documentación
COMMENT ON TABLE public.estados_visita IS
  'Estados configurables de visitas. empresa_id NULL = estado del sistema.';
COMMENT ON COLUMN public.visitas.estado IS
  'Estado de la visita (legacy text). Sincronizado con estado_clave vía trigger.';
COMMENT ON COLUMN public.visitas.estado_clave IS
  'Clave del estado actual. Source of truth a futuro.';
COMMENT ON COLUMN public.visitas.estado_id IS
  'FK a estados_visita. Resuelto automáticamente vía trigger.';
