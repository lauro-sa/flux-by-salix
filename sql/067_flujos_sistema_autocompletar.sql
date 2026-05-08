-- =============================================================
-- Migración 067: Flujos del sistema para autocompletar (sub-PR 20.3)
-- =============================================================
-- Cierra el ciclo MOTOR de migración del helper legacy
-- `auto-completar-actividad.ts`. Este sub-PR NO elimina el helper ni
-- toca call-sites — esa transición la hace 20.5 cuando estén
-- implementados `entidad.creada` (necesario para los 2 POST que
-- todavía dependen del helper) y el panel UI del 20.4.
--
-- Lo que hace 20.3:
--   1. Suma columna `flujos.clave_sistema` con UNIQUE parcial para
--      identificar flujos preconfigurados (vs los del usuario) e
--      idempotentar el seed.
--   2. Backfill de `actividades_relaciones` desde el legacy
--      `actividades.actividad_origen_id` que existe en
--      `presupuestos` y `visitas`. Esto preserva el historial de
--      vínculos para que `completar_actividad.relacionada_a` pueda
--      resolverlos en runtime cuando los flujos del sistema se
--      activen (20.5).
--   3. Sembrar 2 flujos del sistema POR empresa, en estado='pausado':
--        - autocompletar_al_enviar_presupuesto
--        - autocompletar_al_finalizar_visita
--      Ambos llaman a `completar_actividad` con `relacionada_a` apuntando
--      a la entidad disparadora (presupuesto o visita) y `si_multiple:
--      'todas'` para cerrar todas las actividades vinculadas. La
--      activación formal la decide 20.5.
--
-- Lo que NO hace 20.3 (deudas explícitas para 20.5):
--   • Implementar disparador `entidad.creada` (necesario para migrar
--     los call-sites de POST visitas y POST presupuestos del helper).
--   • Eliminar `auto-completar-actividad.ts` (sigue usado por los 2
--     POST hasta que `entidad.creada` exista).
--   • Drop de `actividades.actividad_origen_id` (usado por 20+ archivos
--     de UI/APIs fuera del módulo Flujos — refactor coordinado en 20.5).
--   • Drop de `actividades.vinculos` jsonb (UI chatter lo lee).
--   • Drop de `tipos_actividad.evento_auto_completar` (UI editor de
--     tipo lo edita).
--   • Activar los flujos sembrados (paso final del 20.5 después de
--     migrar los 4 call-sites de manera atómica para evitar doble-disparo).
--   • Seed-on-empresa-create para onboardings nuevos (sub-PR posterior
--     o trigger en `empresas` AFTER INSERT).
-- =============================================================

-- Paso A: columna clave_sistema en flujos
ALTER TABLE public.flujos
  ADD COLUMN IF NOT EXISTS clave_sistema text;

CREATE UNIQUE INDEX IF NOT EXISTS flujos_clave_sistema_unique_idx
  ON public.flujos (empresa_id, clave_sistema)
  WHERE clave_sistema IS NOT NULL;

COMMENT ON COLUMN public.flujos.clave_sistema IS
  'Identificador estable de flujos preconfigurados del sistema. NULL = '
  'flujo creado por el usuario. Cuando NOT NULL, el flujo viene sembrado '
  'por una migración (ej: ''autocompletar_al_enviar_presupuesto''). '
  'Sub-PRs posteriores pueden referenciar el flujo por clave para '
  'activar/pausar sin necesidad de matchear por nombre (renombrable '
  'por el usuario).';

-- Paso B: backfill de actividades_relaciones desde actividad_origen_id
-- histórico. Las dos entidades que el helper legacy registraba como
-- "origen" son presupuestos y visitas. Idempotente por el UNIQUE de
-- actividades_relaciones (sql/066). Tipo de entidad va en literal text
-- coincidiendo con `EntidadRelacionable` de TS.

INSERT INTO public.actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, creado_por, creado_en)
SELECT
  p.empresa_id,
  p.actividad_origen_id,
  'presupuesto',
  p.id,
  NULL,                  -- creado_por NULL: backfill del sistema, sin usuario humano
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

-- Paso C: sembrar 2 flujos del sistema por empresa, en estado='pausado'.
-- WHERE NOT EXISTS sobre clave_sistema garantiza idempotencia: re-correr
-- la migración no duplica filas.

INSERT INTO public.flujos
  (empresa_id, nombre, descripcion, estado, clave_sistema,
   disparador, condiciones, acciones, nodos_json,
   creado_por, creado_por_nombre)
SELECT
  e.id,
  'Cerrar actividades al enviar presupuesto',
  'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas al presupuesto cuando pasa a estado «Enviado». Pausado por defecto — activalo desde el editor cuando estés listo.',
  'pausado',
  'autocompletar_al_enviar_presupuesto',
  '{"tipo":"entidad.estado_cambio","configuracion":{"entidad_tipo":"presupuesto","hasta_clave":"enviado"},"etiqueta":"Presupuesto enviado"}'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"completar_actividad","etiqueta":"Cerrar actividades vinculadas","criterio":{"relacionada_a":{"entidad_tipo":"presupuesto","entidad_id":"{{entidad.id}}"},"si_multiple":"todas","si_no_encuentra":"continuar"}}]'::jsonb,
  '{}'::jsonb,
  NULL,
  'Sistema'
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.flujos f
  WHERE f.empresa_id = e.id
    AND f.clave_sistema = 'autocompletar_al_enviar_presupuesto'
);

INSERT INTO public.flujos
  (empresa_id, nombre, descripcion, estado, clave_sistema,
   disparador, condiciones, acciones, nodos_json,
   creado_por, creado_por_nombre)
SELECT
  e.id,
  'Cerrar actividades al finalizar visita',
  'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas a la visita cuando pasa a estado «Completada». Pausado por defecto — activalo desde el editor cuando estés listo.',
  'pausado',
  'autocompletar_al_finalizar_visita',
  '{"tipo":"entidad.estado_cambio","configuracion":{"entidad_tipo":"visita","hasta_clave":"completada"},"etiqueta":"Visita completada"}'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"completar_actividad","etiqueta":"Cerrar actividades vinculadas","criterio":{"relacionada_a":{"entidad_tipo":"visita","entidad_id":"{{entidad.id}}"},"si_multiple":"todas","si_no_encuentra":"continuar"}}]'::jsonb,
  '{}'::jsonb,
  NULL,
  'Sistema'
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.flujos f
  WHERE f.empresa_id = e.id
    AND f.clave_sistema = 'autocompletar_al_finalizar_visita'
);
