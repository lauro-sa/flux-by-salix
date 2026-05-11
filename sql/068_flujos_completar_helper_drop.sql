-- =============================================================
-- Migración 068: Cierre del helper auto-completar (sub-PR 20.5)
-- =============================================================
-- Cierra el ciclo iniciado por el sub-PR 20.3 + completado por los
-- commits 1-3 del 20.5:
--   1. Triggers ON INSERT en presupuestos + visitas que escriben a
--      `cambios_estado` con `estado_anterior=NULL`. El motor (commit
--      1: motor + Edge Function v8 con `solo_creacion`) matchea esos
--      eventos con los flujos del sistema `autocompletar_al_crear_*`.
--   2. Backfill safety net de `actividades_relaciones` (idempotente).
--      No-op esperado en flux-dev — los commits 2/3 ya migraron los
--      handlers, pero queda como red por si algún POST entre 20.3 y
--      hoy escribió `actividad_origen_id` sin pasar por la lógica
--      nueva.
--   3. Activación de los 2 flujos sembrados pausados en 20.3
--      (`autocompletar_al_enviar_presupuesto` +
--      `autocompletar_al_finalizar_visita`).
--   4. INSERT de los 2 flujos `al_crear` nuevos del 20.5
--      (`autocompletar_al_crear_presupuesto` +
--      `autocompletar_al_crear_visita`), `estado='activo'`,
--      `solo_creacion=true`. Reemplazan funcionalmente al
--      `evento_auto_completar='al_crear'` del helper legacy.
--   5. DROP COLUMN de las 3 columnas legacy:
--        - `presupuestos.actividad_origen_id`
--        - `visitas.actividad_origen_id`
--        - `tipos_actividad.evento_auto_completar`
--      Junto con sus índices. La migración del esquema TS y la
--      regeneración de `database.types.ts` se hacen en el mismo commit
--      4 (TS↔BD sincronizados).
--
-- NO incluye:
--   • Drop de `actividades.vinculos` jsonb — sub-PR 20.6 separado
--     (refactor grande de UI/IA, ver decisión D3 del 20.5).
--   • Eliminación del helper `auto-completar-actividad.ts` — commit 5
--     del 20.5 (sin call-sites después del commit 2).
--   • Seed-on-empresa-create — commit 6 del 20.5 (hook en API route).
--
-- Idempotencia:
--   • Triggers: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
--   • Backfill: ON CONFLICT DO NOTHING.
--   • UPDATE flujos: matchea por clave_sistema (idempotente, hasta
--     que el admin cambie el estado manualmente).
--   • INSERT flujos: WHERE NOT EXISTS (mismo patrón del 067).
--   • DROP COLUMN: IF EXISTS.
--   • DROP INDEX: IF EXISTS.
-- =============================================================

-- =============================================================
-- Paso 1: Funciones + triggers ON INSERT
-- =============================================================
-- Imitan el estilo de `tr_*_registrar_cambio_estado` (sub-PR 047/048)
-- pero pasando `p_estado_anterior=NULL` y `p_grupo_anterior=NULL`
-- para marcar el evento como creación. El motor lee estos campos via
-- el matcher `solo_creacion=true` (commit 1 del 20.5).

CREATE OR REPLACE FUNCTION public.tr_presupuestos_registrar_creacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_grupo_nuevo text;
  v_usuario_id uuid;
  v_usuario_nombre text;
  v_origen text;
BEGIN
  -- Defensivo: presupuestos_sincronizar_estado (BEFORE INSERT) garantiza
  -- estado_clave seteado, pero protegemos por si hay edge case raro.
  IF NEW.estado_clave IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_nuevo
  FROM public.estados_presupuesto
  WHERE id = NEW.estado_id;

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
    p_entidad_tipo    => 'presupuesto',
    p_entidad_id      => NEW.id,
    p_estado_anterior => NULL,                  -- marca de creación
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => NULL,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'numero',       NEW.numero,
      'contacto_id',  NEW.contacto_id,
      'total_final',  NEW.total_final
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS presupuestos_registrar_creacion ON public.presupuestos;
CREATE TRIGGER presupuestos_registrar_creacion
  AFTER INSERT ON public.presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_presupuestos_registrar_creacion();


CREATE OR REPLACE FUNCTION public.tr_visitas_registrar_creacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_grupo_nuevo text;
  v_usuario_id uuid;
  v_usuario_nombre text;
  v_origen text;
BEGIN
  IF NEW.estado_clave IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT grupo INTO v_grupo_nuevo
  FROM public.estados_visita
  WHERE id = NEW.estado_id;

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
    p_estado_anterior => NULL,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => NULL,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => v_origen,
    p_usuario_id      => v_usuario_id,
    p_usuario_nombre  => NULLIF(v_usuario_nombre, ''),
    p_metadatos       => jsonb_build_object(
      'contacto_id',       NEW.contacto_id,
      'fecha_programada',  NEW.fecha_programada
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS visitas_registrar_creacion ON public.visitas;
CREATE TRIGGER visitas_registrar_creacion
  AFTER INSERT ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_visitas_registrar_creacion();


-- =============================================================
-- Paso 2: Backfill safety net de actividades_relaciones
-- =============================================================
-- Espera no-op en flux-dev (verificado en pre-trabajo H4 del 20.5: 5
-- presupuestos con actividad_origen_id, todos ya en
-- actividades_relaciones). Queda como defensa por si entre la
-- aplicación de 067 y este commit hubo escrituras nuevas a
-- presupuestos/visitas con `actividad_origen_id` que no pasaron por
-- el backfill original.

INSERT INTO public.actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, creado_por, creado_en)
SELECT
  p.empresa_id,
  p.actividad_origen_id,
  'presupuesto',
  p.id,
  NULL,
  p.creado_en
  FROM public.presupuestos p
 WHERE p.actividad_origen_id IS NOT NULL
ON CONFLICT (empresa_id, actividad_id, entidad_tipo, entidad_id) DO NOTHING;

INSERT INTO public.actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, creado_por, creado_en)
SELECT
  v.empresa_id,
  v.actividad_origen_id,
  'visita',
  v.id,
  NULL,
  v.creado_en
  FROM public.visitas v
 WHERE v.actividad_origen_id IS NOT NULL
ON CONFLICT (empresa_id, actividad_id, entidad_tipo, entidad_id) DO NOTHING;


-- =============================================================
-- Paso 3: Activar los 2 flujos sembrados pausados en 20.3
-- =============================================================
-- El seed del 067 los dejó en 'pausado' para evitar doble-disparo con
-- el helper legacy. El commit 2 del 20.5 ya eliminó el helper de los
-- 4 call-sites, así que activar estos flujos ya no produce
-- doble-disparo. La activación marca el momento exacto en que pasan
-- a producción.

-- Nota: `flujos.activo` es generated column (`activo = (estado = 'activo')`),
-- NO se puede setear manualmente. Solo seteamos `estado` y la columna
-- `activo` se deriva. Mismo hallazgo del 20.3 (commit 5709c99).
UPDATE public.flujos
   SET estado = 'activo',
       actualizado_en = now()
 WHERE clave_sistema IN (
   'autocompletar_al_enviar_presupuesto',
   'autocompletar_al_finalizar_visita'
 )
   AND estado = 'pausado';


-- =============================================================
-- Paso 4: Sembrar los 2 flujos al_crear nuevos del 20.5
-- =============================================================
-- Reemplazan funcionalmente al `evento_auto_completar='al_crear'` del
-- helper legacy. Activos directo (sin pasar por pausado): la paridad
-- funcional con el helper que se elimina exige que disparen sin
-- intervención del admin. Usan `solo_creacion=true` para distinguir
-- creación de re-transición a estado inicial (ver hallazgo H10 del
-- 20.5 — convención votada en H10.C).
--
-- Espejo del catálogo TS `src/lib/workflows/flujos-sistema.ts`
-- (commit 1 del 20.5). Si el shape cambia en TS, actualizar acá y
-- alinear con el test `flujos-sistema.test.ts`.
--
-- Idempotente por WHERE NOT EXISTS sobre clave_sistema (mismo patrón
-- que 067).

-- Nota: `flujos.activo` NO se incluye en el INSERT — es generated column
-- derivada de `estado` (mismo hallazgo del 20.3). Solo seteamos
-- `estado='activo'` y la columna `activo` queda en true automáticamente.

INSERT INTO public.flujos
  (empresa_id, nombre, descripcion, estado, clave_sistema,
   disparador, condiciones, acciones, nodos_json,
   creado_por, creado_por_nombre)
SELECT
  e.id,
  'Cerrar actividades al crear presupuesto',
  'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas al presupuesto cuando se lo crea. Reemplaza el comportamiento legacy «evento_auto_completar=al_crear». Editalo desde el editor de Flujos si necesitás ajustar el comportamiento.',
  'activo',
  'autocompletar_al_crear_presupuesto',
  '{"tipo":"entidad.estado_cambio","configuracion":{"entidad_tipo":"presupuesto","hasta_clave":"borrador","solo_creacion":true},"etiqueta":"Presupuesto creado"}'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"completar_actividad","etiqueta":"Cerrar actividades vinculadas","criterio":{"relacionada_a":{"entidad_tipo":"presupuesto","entidad_id":"{{entidad.id}}"},"si_multiple":"todas","si_no_encuentra":"continuar"}}]'::jsonb,
  '{}'::jsonb,
  NULL,
  'Sistema'
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.flujos f
  WHERE f.empresa_id = e.id
    AND f.clave_sistema = 'autocompletar_al_crear_presupuesto'
);

INSERT INTO public.flujos
  (empresa_id, nombre, descripcion, estado, clave_sistema,
   disparador, condiciones, acciones, nodos_json,
   creado_por, creado_por_nombre)
SELECT
  e.id,
  'Cerrar actividades al crear visita',
  'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas a la visita cuando se la crea. Reemplaza el comportamiento legacy «evento_auto_completar=al_crear». Editalo desde el editor de Flujos si necesitás ajustar el comportamiento.',
  'activo',
  'autocompletar_al_crear_visita',
  '{"tipo":"entidad.estado_cambio","configuracion":{"entidad_tipo":"visita","hasta_clave":"programada","solo_creacion":true},"etiqueta":"Visita creada"}'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"completar_actividad","etiqueta":"Cerrar actividades vinculadas","criterio":{"relacionada_a":{"entidad_tipo":"visita","entidad_id":"{{entidad.id}}"},"si_multiple":"todas","si_no_encuentra":"continuar"}}]'::jsonb,
  '{}'::jsonb,
  NULL,
  'Sistema'
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.flujos f
  WHERE f.empresa_id = e.id
    AND f.clave_sistema = 'autocompletar_al_crear_visita'
);


-- =============================================================
-- Paso 5: DROP COLUMN de las 3 columnas legacy + sus índices
-- =============================================================
-- Después de los pasos 1-4, los handlers TS (commits 2 y 3 del 20.5)
-- ya no leen ni escriben estas columnas. La migración del esquema TS
-- (`src/db/esquema.ts`) y la regeneración de `database.types.ts`
-- ocurren en el mismo commit 4 para mantener TS↔BD sincronizados.

DROP INDEX IF EXISTS public.presupuestos_actividad_origen_idx;
ALTER TABLE public.presupuestos
  DROP COLUMN IF EXISTS actividad_origen_id;

DROP INDEX IF EXISTS public.visitas_actividad_origen_idx;
ALTER TABLE public.visitas
  DROP COLUMN IF EXISTS actividad_origen_id;

ALTER TABLE public.tipos_actividad
  DROP COLUMN IF EXISTS evento_auto_completar;
