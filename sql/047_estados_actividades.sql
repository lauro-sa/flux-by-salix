-- =============================================================
-- Migración 047: Conectar actividades al sistema genérico de estados
-- =============================================================
-- A diferencia de cuotas (PR 2) y conversaciones (PR 3), actividades
-- YA tiene su tabla configurable propia: `estados_actividad`. Por eso
-- esta migración NO crea una tabla nueva — reusa la existente y sólo:
--
--   1) Agrega `estado_anterior_id` y `estado_cambio_at` a `actividades`
--   2) Trigger BEFORE UPDATE para capturar el estado anterior
--   3) Trigger AFTER UPDATE para escribir a `cambios_estado`
--   4) Siembra transiciones del sistema en `transiciones_estado` con
--      las claves predeterminadas (pendiente/completada/cancelada/vencida)
--
-- Nota sobre `estados_actividad`: hoy la tabla tiene `empresa_id NOT NULL`
-- (cada empresa siembra sus 4 estados predeterminados al crearse).
-- Se mantiene esa convención por ahora — los estados son "del sistema"
-- en el sentido de comportamiento (es_predefinido=true), no en el sentido
-- de empresa_id NULL. Esto difiere del patrón de cuotas/conversaciones
-- pero no rompe nada porque:
--   - El catálogo de transiciones del sistema (empresa_id IS NULL) usa
--     claves directas (pendiente, completada, etc.), no FKs a estados.
--   - El historial visible en chatter funciona porque cambios_estado
--     guarda snapshots de etiquetas/grupos, no FKs.
-- =============================================================

-- 1) Nuevas columnas en `actividades`
ALTER TABLE public.actividades
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_actividad(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS actividades_estado_clave_idx
  ON public.actividades (empresa_id, estado_clave);


-- 2) Trigger BEFORE UPDATE: capturar anterior + timestamp
CREATE OR REPLACE FUNCTION public.tr_actividades_capturar_anterior_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si cambia el estado_id (o estado_clave), guardar el anterior
  IF TG_OP = 'UPDATE' AND
     (NEW.estado_id IS DISTINCT FROM OLD.estado_id
      OR NEW.estado_clave IS DISTINCT FROM OLD.estado_clave) THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at   := now();

    -- Mantener sincronía: si solo cambió estado_id, sincronizar estado_clave;
    -- si solo cambió estado_clave, sincronizar estado_id.
    IF NEW.estado_id IS DISTINCT FROM OLD.estado_id AND NEW.estado_clave = OLD.estado_clave THEN
      SELECT clave INTO NEW.estado_clave
      FROM public.estados_actividad WHERE id = NEW.estado_id;
    ELSIF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave AND NEW.estado_id = OLD.estado_id THEN
      SELECT id INTO NEW.estado_id
      FROM public.estados_actividad
      WHERE clave = NEW.estado_clave AND empresa_id = NEW.empresa_id
      LIMIT 1;
      IF NEW.estado_id IS NULL THEN
        RAISE EXCEPTION 'tr_actividades_capturar_anterior_estado: clave de estado inválida: %', NEW.estado_clave;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actividades_capturar_anterior_estado ON public.actividades;
CREATE TRIGGER actividades_capturar_anterior_estado
  BEFORE UPDATE ON public.actividades
  FOR EACH ROW EXECUTE FUNCTION public.tr_actividades_capturar_anterior_estado();


-- 3) Trigger AFTER UPDATE: escribir a `cambios_estado`
CREATE OR REPLACE FUNCTION public.tr_actividades_registrar_cambio_estado()
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
  v_contacto_id uuid;
BEGIN
  -- Solo registrar cuando hay cambio real de clave
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_anterior FROM public.estados_actividad WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_actividad WHERE id = NEW.estado_id;

  -- Capturar usuario actual si hay sesión
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

  -- Extraer primer contacto vinculado (si lo hay) para metadatos
  SELECT (vinc->>'id')::uuid INTO v_contacto_id
  FROM jsonb_array_elements(NEW.vinculos) AS vinc
  WHERE vinc->>'tipo' = 'contacto'
  LIMIT 1;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'actividad',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'tipo_clave',  NEW.tipo_clave,
      'titulo',      NEW.titulo,
      'contacto_id', v_contacto_id,
      'asignados',   NEW.asignados_ids
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actividades_registrar_cambio_estado ON public.actividades;
CREATE TRIGGER actividades_registrar_cambio_estado
  AFTER UPDATE ON public.actividades
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_actividades_registrar_cambio_estado();


-- 4) Sembrar transiciones del sistema para 'actividad'
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, requiere_motivo, orden)
VALUES
  -- Desde pendiente
  (NULL, 'actividad', 'pendiente',  'completada', 'Marcar como completada', false, false, 1),
  (NULL, 'actividad', 'pendiente',  'cancelada',  'Cancelar',               false, true,  2),
  (NULL, 'actividad', 'pendiente',  'vencida',    'Marcar como vencida',    true,  false, 3),
  -- Desde vencida
  (NULL, 'actividad', 'vencida',    'completada', 'Marcar como completada', false, false, 4),
  (NULL, 'actividad', 'vencida',    'cancelada',  'Cancelar',               false, true,  5),
  (NULL, 'actividad', 'vencida',    'pendiente',  'Reabrir',                false, false, 6),
  -- Desde completada (reabrir)
  (NULL, 'actividad', 'completada', 'pendiente',  'Reabrir',                false, false, 7),
  -- Desde cancelada (reactivar)
  (NULL, 'actividad', 'cancelada',  'pendiente',  'Reactivar',              false, false, 8)
ON CONFLICT DO NOTHING;


-- 5) Comentarios de documentación
COMMENT ON COLUMN public.actividades.estado_anterior_id IS
  'FK al estado anterior. Capturado por trigger BEFORE UPDATE para tracking.';

COMMENT ON COLUMN public.actividades.estado_cambio_at IS
  'Timestamp del último cambio de estado. Capturado por trigger BEFORE UPDATE.';
