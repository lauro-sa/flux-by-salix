-- =============================================================
-- Migración 049: Estados configurables de órdenes de trabajo
-- =============================================================
-- Conecta ordenes_trabajo al sistema genérico (044). Sigue el patrón
-- estándar de cuotas/conversaciones/visitas + un renombre histórico:
--
--   esperando → en_espera
--
-- La clave 'esperando' (gerundio) no respetaba la convención del
-- sistema (frase preposicional o participio). Se renombra a 'en_espera'.
-- Como NINGUNA orden tenía estado='esperando' al momento de la
-- migración, el rename solo afecta al código (8 hardcodeados) + el
-- catálogo. El trigger BEFORE traduce 'esperando' → 'en_espera' por
-- compatibilidad si llegara a colarse desde código viejo.
-- =============================================================

-- 1) Tabla estados_orden
CREATE TABLE IF NOT EXISTS public.estados_orden (
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

CREATE INDEX IF NOT EXISTS estados_orden_empresa_idx
  ON public.estados_orden (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_orden_unique_idx
  ON public.estados_orden (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_orden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_orden_select" ON public.estados_orden
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_orden_insert" ON public.estados_orden
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_orden_update" ON public.estados_orden
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_orden_delete" ON public.estados_orden
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);


-- 2) Sembrar estados del sistema (con en_espera, NO esperando)
INSERT INTO public.estados_orden (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'abierta',     'Abierta',     'inicial',     'CircleDot',    '#5b5bd6', 1, true),
  (NULL, 'en_progreso', 'En progreso', 'activo',      'Loader',       '#0891b2', 2, true),
  (NULL, 'en_espera',   'En espera',   'espera',      'CircleDashed', '#d97706', 3, true),
  (NULL, 'completada',  'Completada',  'completado',  'CircleCheck',  '#16a34a', 4, true),
  (NULL, 'cancelada',   'Cancelada',   'cancelado',   'CircleSlash',  '#dc2626', 5, true)
ON CONFLICT DO NOTHING;


-- 3) Sembrar transiciones manuales del sistema
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  (NULL, 'orden', 'abierta',     'en_progreso', 'Iniciar',          false, false, 1),
  (NULL, 'orden', 'abierta',     'cancelada',   'Cancelar',         false, true,  2),
  (NULL, 'orden', 'en_progreso', 'en_espera',   'Poner en espera',  false, true,  3),
  (NULL, 'orden', 'en_progreso', 'completada',  'Completar',        false, false, 4),
  (NULL, 'orden', 'en_progreso', 'cancelada',   'Cancelar',         false, true,  5),
  (NULL, 'orden', 'en_espera',   'en_progreso', 'Reanudar',         false, false, 6),
  (NULL, 'orden', 'en_espera',   'cancelada',   'Cancelar',         false, true,  7),
  (NULL, 'orden', 'completada',  'en_progreso', 'Reabrir',          false, true,  8),
  (NULL, 'orden', 'cancelada',   'abierta',     'Reactivar',        false, false, 9)
ON CONFLICT DO NOTHING;


-- 4) Nuevas columnas en ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_orden(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_orden(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS ordenes_trabajo_estado_clave_idx
  ON public.ordenes_trabajo (empresa_id, estado_clave);


-- 5) Renombre defensivo en datos (al momento de la migración no había
--    órdenes con 'esperando', pero el UPDATE es idempotente)
UPDATE public.ordenes_trabajo SET estado = 'en_espera' WHERE estado = 'esperando';


-- 6) Backfill estado_id + estado_clave
UPDATE public.ordenes_trabajo o
SET
  estado_clave = o.estado,
  estado_id = (
    SELECT eo.id FROM public.estados_orden eo
    WHERE eo.clave = o.estado AND eo.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = o.actualizado_en
WHERE o.estado_clave IS NULL OR o.estado_id IS NULL;


-- 7) Helper resolver_estado_orden_id
CREATE OR REPLACE FUNCTION public.resolver_estado_orden_id(
  p_empresa_id uuid,
  p_clave text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.estados_orden
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_orden_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_orden_id(uuid, text) TO authenticated, service_role;


-- 8) Trigger BEFORE INSERT/UPDATE — sincronización + traducción de alias
CREATE OR REPLACE FUNCTION public.tr_ordenes_sincronizar_estado()
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

  -- Compatibilidad: traducir alias 'esperando' → 'en_espera'
  IF v_clave = 'esperando' THEN
    v_clave := 'en_espera';
  END IF;

  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  v_id_resuelto := public.resolver_estado_orden_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_ordenes_sincronizar_estado: clave de estado inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordenes_sincronizar_estado ON public.ordenes_trabajo;
CREATE TRIGGER ordenes_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.tr_ordenes_sincronizar_estado();


-- 9) Trigger AFTER UPDATE — registrar cambio en cambios_estado
CREATE OR REPLACE FUNCTION public.tr_ordenes_registrar_cambio_estado()
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

  SELECT grupo INTO v_grupo_anterior FROM public.estados_orden WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_orden WHERE id = NEW.estado_id;

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

  -- Nota: ordenes_trabajo NO tiene columna asignado_a (los asignados
  -- viven en la tabla aparte asignados_orden_trabajo). Por eso solo
  -- incluimos los campos disponibles en la fila.
  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'orden',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'numero',       NEW.numero,
      'contacto_id',  NEW.contacto_id,
      'prioridad',    NEW.prioridad
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordenes_registrar_cambio_estado ON public.ordenes_trabajo;
CREATE TRIGGER ordenes_registrar_cambio_estado
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_ordenes_registrar_cambio_estado();


-- 10) Trigger actualizado_en de estados_orden
CREATE OR REPLACE FUNCTION public.tr_estados_orden_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_orden_actualizar_timestamp ON public.estados_orden;
CREATE TRIGGER estados_orden_actualizar_timestamp
  BEFORE UPDATE ON public.estados_orden
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_orden_actualizar_timestamp();


COMMENT ON TABLE public.estados_orden IS
  'Estados configurables de órdenes de trabajo. empresa_id NULL = sistema. Renombre histórico (PR 9): esperando → en_espera, sin afectar datos (ninguna orden tenía esperando).';
COMMENT ON COLUMN public.ordenes_trabajo.estado IS
  'Legacy text. Sincronizado con estado_clave vía trigger. Valores: abierta | en_progreso | en_espera | completada | cancelada.';
COMMENT ON COLUMN public.ordenes_trabajo.estado_clave IS
  'Source of truth a futuro.';
