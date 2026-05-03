-- =============================================================
-- Migración 053: Cleanup arquitectónico final del refactor de estados
-- =============================================================
-- Cierra prolijamente la fase 1 del refactor de estados configurables.
--
-- LO QUE HACE:
--   1) NOT NULL en `estado_clave` e `estado_id` de las 9 entidades
--      migradas. Garantiza integridad: todas las filas existentes ya
--      tienen valor (verificado con backfills 100%).
--   2) Comentarios SQL marcando las columnas `estado` text como
--      DEPRECATED, con referencia al PR 12bis que las droppea.
--
-- LO QUE NO HACE (tarea futura, PR 12bis):
--   - Drop de columnas `estado` text. Mantener requerirá migrar ~700
--     queries del código consumidor a `estado_clave`. Se difiere a un
--     PR dedicado cuando se pueda revisar el código con tiempo y QA.
--   - Drop de la lógica de sincronización en triggers BEFORE. Mientras
--     existan ambas columnas, los triggers garantizan consistencia.
--
-- ESTADO POST-MIGRACIÓN:
--   - 9 entidades 100% conectadas al sistema genérico de estados.
--   - cambios_estado registra todo evento, fuente para workflows.
--   - estado_clave + estado_id son la fuente de verdad.
--   - estado text legacy queda como shim retrocompatible.
-- =============================================================


-- ─── Cuotas (presupuesto_cuotas) ──────────────────────────────
ALTER TABLE public.presupuesto_cuotas
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.presupuesto_cuotas.estado IS
  'DEPRECATED. Mantener por compatibilidad con código consumidor existente. La fuente de verdad es estado_clave. Drop programado para PR 12bis cuando se migren los queries.';


-- ─── Conversaciones ──────────────────────────────────────────
ALTER TABLE public.conversaciones
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.conversaciones.estado IS
  'DEPRECATED. Mantener por compatibilidad con código consumidor existente. La fuente de verdad es estado_clave. Drop programado para PR 12bis cuando se migren los queries.';


-- ─── Visitas ─────────────────────────────────────────────────
ALTER TABLE public.visitas
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.visitas.estado IS
  'DEPRECATED. Mantener por compatibilidad con código consumidor existente. La fuente de verdad es estado_clave. Drop programado para PR 12bis cuando se migren los queries.';


-- ─── Órdenes de trabajo ──────────────────────────────────────
ALTER TABLE public.ordenes_trabajo
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.ordenes_trabajo.estado IS
  'DEPRECATED. La fuente de verdad es estado_clave. Drop programado para PR 12bis. Renombre histórico (PR 9): esperando → en_espera. El trigger BEFORE traduce el alias por compatibilidad.';


-- ─── Presupuestos ────────────────────────────────────────────
ALTER TABLE public.presupuestos
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.presupuestos.estado IS
  'DEPRECATED. La fuente de verdad es estado_clave. Drop programado para PR 12bis. Estados reales: borrador | enviado | confirmado_cliente | orden_venta | completado | vencido | rechazado | cancelado.';


-- ─── Asistencias ─────────────────────────────────────────────
ALTER TABLE public.asistencias
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.asistencias.estado IS
  'DEPRECATED. La fuente de verdad es estado_clave. Drop programado para PR 12bis. Renombres históricos (PR 11): almuerzo → en_almuerzo, particular → en_particular. El trigger BEFORE traduce los alias por compatibilidad.';


-- ─── Adelantos de nómina ─────────────────────────────────────
ALTER TABLE public.adelantos_nomina
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.adelantos_nomina.estado IS
  'DEPRECATED. La fuente de verdad es estado_clave. Drop programado para PR 12bis. Estados: pendiente | activo | pagado | cancelado.';


-- ─── Pagos de nómina ─────────────────────────────────────────
ALTER TABLE public.pagos_nomina
  ALTER COLUMN estado_clave SET NOT NULL,
  ALTER COLUMN estado_id    SET NOT NULL;

COMMENT ON COLUMN public.pagos_nomina.estado IS
  'DEPRECATED. La fuente de verdad es estado_clave. Drop programado para PR 12bis. La creación del registro ES el evento "se le pagó al empleado" — el trigger AFTER INSERT lo registra como estado_anterior=NULL → estado_nuevo=pagado.';


-- ─── Actividades (especial: estado_clave SÍ NOT NULL desde antes) ─
-- actividades.estado_clave era NOT NULL desde la creación de la tabla
-- (ver schema). Solo verificamos que estado_id (FK al sistema) también
-- esté NOT NULL ahora.
ALTER TABLE public.actividades
  ALTER COLUMN estado_id SET NOT NULL;

-- actividades NO tiene columna `estado` text — usa solo estado_clave +
-- estado_id desde el principio. No requiere comentario de deprecation.


-- =============================================================
-- Verificación de integridad post-cleanup
-- =============================================================
DO $check$
DECLARE
  v_inconsistencias integer;
BEGIN
  -- Asegurar que ninguna fila tiene estado != estado_clave en las 7
  -- entidades con doble columna
  SELECT (
    (SELECT count(*) FROM public.presupuesto_cuotas WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.conversaciones      WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.visitas             WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.ordenes_trabajo     WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.presupuestos        WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.asistencias         WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.adelantos_nomina    WHERE estado <> estado_clave) +
    (SELECT count(*) FROM public.pagos_nomina        WHERE estado <> estado_clave)
  ) INTO v_inconsistencias;

  IF v_inconsistencias > 0 THEN
    RAISE EXCEPTION 'INCONSISTENCIA POST-CLEANUP: % filas con estado != estado_clave', v_inconsistencias;
  END IF;

  RAISE NOTICE '✓ Cleanup completado sin inconsistencias';
END $check$;
