-- =============================================================
-- Migración 051: Estados configurables de asistencias
-- =============================================================
-- El PR más pesado del refactor. Conecta asistencias al sistema
-- genérico (044) + dos renombres importantes:
--
--   almuerzo   → en_almuerzo   (frase preposicional, no sustantivo)
--   particular → en_particular (frase preposicional, no adjetivo)
--
-- Estos renombres alinean asistencias con la convención del sistema
-- (verbo en participio o frase descriptiva, nunca sustantivo o
-- adjetivo suelto).
--
-- 7 estados reales en uso (verificado contra BD):
--   activo        → activo     (jornada en curso)
--   en_almuerzo   → espera     (pausado por almuerzo)
--   en_particular → espera     (pausado por trámite particular)
--   cerrado       → completado (jornada terminada normalmente)
--   feriado       → completado (día feriado, no aplicaba)
--   auto_cerrado  → error      (cerrado automáticamente por inactividad)
--   ausente       → cancelado  (no se presentó)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.estados_asistencia (
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

CREATE INDEX IF NOT EXISTS estados_asistencia_empresa_idx
  ON public.estados_asistencia (empresa_id, clave) WHERE activo = true;
CREATE UNIQUE INDEX IF NOT EXISTS estados_asistencia_unique_idx
  ON public.estados_asistencia (COALESCE(empresa_id::text, '__sistema__'), clave);

ALTER TABLE public.estados_asistencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estados_asistencia_select" ON public.estados_asistencia
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());
CREATE POLICY "estados_asistencia_insert" ON public.estados_asistencia
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_asistencia_update" ON public.estados_asistencia
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_asistencia_delete" ON public.estados_asistencia
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);

INSERT INTO public.estados_asistencia (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'activo',        'Activo',          'activo',     'Play',        '#16a34a', 1, true),
  (NULL, 'en_almuerzo',   'En almuerzo',     'espera',     'Coffee',      '#d97706', 2, true),
  (NULL, 'en_particular', 'Salida particular','espera',    'LogOut',      '#0891b2', 3, true),
  (NULL, 'cerrado',       'Cerrado',         'completado', 'CircleCheck', '#5b5bd6', 4, true),
  (NULL, 'feriado',       'Feriado',         'completado', 'Calendar',    '#7c3aed', 5, true),
  (NULL, 'auto_cerrado',  'Cerrado automático','error',    'AlertCircle', '#f97316', 6, true),
  (NULL, 'ausente',       'Ausente',         'cancelado',  'CircleSlash', '#dc2626', 7, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Desde activo
  (NULL, 'asistencia', 'activo',        'en_almuerzo',   'Salir a almorzar',   false, false, 1),
  (NULL, 'asistencia', 'activo',        'en_particular', 'Salida particular',  false, true,  2),
  (NULL, 'asistencia', 'activo',        'cerrado',       'Cerrar jornada',     false, false, 3),
  -- Desde en_almuerzo
  (NULL, 'asistencia', 'en_almuerzo',   'activo',        'Volver del almuerzo',false, false, 4),
  -- Desde en_particular
  (NULL, 'asistencia', 'en_particular', 'activo',        'Volver del trámite', false, false, 5),
  -- Cierres automáticos (los dispara el cron de asistencias)
  (NULL, 'asistencia', 'activo',        'auto_cerrado',  'Cerrar automático',  true,  false, 6),
  (NULL, 'asistencia', 'en_almuerzo',   'auto_cerrado',  'Cerrar automático',  true,  false, 7),
  (NULL, 'asistencia', 'en_particular', 'auto_cerrado',  'Cerrar automático',  true,  false, 8),
  -- Reabrir desde cerrado o auto_cerrado (correcciones)
  (NULL, 'asistencia', 'cerrado',       'activo',        'Reabrir',            false, true,  9),
  (NULL, 'asistencia', 'auto_cerrado',  'cerrado',       'Cerrar manualmente', false, true,  10),
  -- ausente y feriado son terminales pero pueden cambiarse manualmente si se corrigen
  (NULL, 'asistencia', 'ausente',       'activo',        'Marcar como presente',false, true, 11),
  (NULL, 'asistencia', 'feriado',       'activo',        'Quitar feriado',     false, true,  12)
ON CONFLICT DO NOTHING;

ALTER TABLE public.asistencias
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_asistencia(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_asistencia(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS asistencias_estado_clave_idx
  ON public.asistencias (empresa_id, estado_clave);

-- Renombre defensivo de claves viejas (sin afectar datos hoy: BD tiene
-- cerrado/ausente/feriado/auto_cerrado/activo, ninguna 'almuerzo' ni
-- 'particular' como estado persistido, pero si hay code path que los
-- escribió, los traducimos)
UPDATE public.asistencias SET estado = 'en_almuerzo'   WHERE estado = 'almuerzo';
UPDATE public.asistencias SET estado = 'en_particular' WHERE estado = 'particular';

UPDATE public.asistencias a
SET
  estado_clave = a.estado,
  estado_id = (
    SELECT ea.id FROM public.estados_asistencia ea
    WHERE ea.clave = a.estado AND ea.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = a.actualizado_en
WHERE a.estado_clave IS NULL OR a.estado_id IS NULL;

CREATE OR REPLACE FUNCTION public.resolver_estado_asistencia_id(
  p_empresa_id uuid,
  p_clave text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.estados_asistencia
  WHERE clave = p_clave AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_asistencia_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_asistencia_id(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tr_asistencias_sincronizar_estado()
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

  -- Compatibilidad: traducir alias viejos
  IF v_clave = 'almuerzo'   THEN v_clave := 'en_almuerzo';   END IF;
  IF v_clave = 'particular' THEN v_clave := 'en_particular'; END IF;

  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  v_id_resuelto := public.resolver_estado_asistencia_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_asistencias_sincronizar_estado: clave de estado inválida: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asistencias_sincronizar_estado ON public.asistencias;
CREATE TRIGGER asistencias_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.asistencias
  FOR EACH ROW EXECUTE FUNCTION public.tr_asistencias_sincronizar_estado();

CREATE OR REPLACE FUNCTION public.tr_asistencias_registrar_cambio_estado()
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

  SELECT grupo INTO v_grupo_anterior FROM public.estados_asistencia WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_asistencia WHERE id = NEW.estado_id;

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
    p_entidad_tipo    => 'asistencia',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'fecha',      NEW.fecha,
      'miembro_id', NEW.miembro_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asistencias_registrar_cambio_estado ON public.asistencias;
CREATE TRIGGER asistencias_registrar_cambio_estado
  AFTER UPDATE ON public.asistencias
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_asistencias_registrar_cambio_estado();

CREATE OR REPLACE FUNCTION public.tr_estados_asistencia_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_asistencia_actualizar_timestamp ON public.estados_asistencia;
CREATE TRIGGER estados_asistencia_actualizar_timestamp
  BEFORE UPDATE ON public.estados_asistencia
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_asistencia_actualizar_timestamp();

COMMENT ON TABLE public.estados_asistencia IS
  'Estados configurables de asistencias. Renombres (PR 11): almuerzo→en_almuerzo, particular→en_particular.';
COMMENT ON COLUMN public.asistencias.estado IS
  'Legacy text. Sincronizado con estado_clave. Valores: activo | en_almuerzo | en_particular | cerrado | feriado | auto_cerrado | ausente.';
