-- =============================================================
-- Migración 056: Estados de flujo + borrador interno (PR 18.1)
-- =============================================================
-- Prepara la tabla `flujos` para soportar los tres estados visibles
-- en la UI (Borrador / Activo / Pausado) y el modelo de "borrador
-- interno" para editar flujos activos sin afectar la versión que el
-- motor está ejecutando (decisión §5.3 de docs/PLAN_UI_FLUJOS.md).
--
-- Cambios:
--
--   1) Columna `estado` text con CHECK ('borrador' | 'activo' | 'pausado').
--      Default 'borrador'. Es la fuente de verdad operacional a partir
--      de este PR.
--
--   2) Columna `activo` se transforma en generated column derivada:
--          activo = (estado = 'activo')
--      Mantiene compatibilidad con los 4 consumidores actuales que
--      filtran por `WHERE activo = true` (dispatcher Edge Function,
--      cron disparar-workflows-tiempo, correr-ejecucion, listado
--      interno) sin tener que tocarles el código. Cuando llegue el
--      día que ningún consumidor lea `activo`, se puede dropear sin
--      drama porque ya no es la fuente de verdad.
--
--   3) Columna `borrador_jsonb` jsonb (nullable). Almacena la versión
--      en edición de un flujo cuyo estado es 'activo' o 'pausado'.
--      Shape esperado: { disparador, condiciones, acciones }. Es null
--      cuando no hay borrador en curso o cuando el flujo está en
--      'borrador' (que edita in-place sobre las columnas publicadas).
--
--   4) Columnas de auditoría visual: `editado_por uuid`,
--      `editado_por_nombre text`, `creado_por_nombre text`. Patrón
--      idéntico al de plantillas_correo: el endpoint las setea al
--      escribir, la UI las lee sin join (memoria
--      feedback_auditoria_tablas.md).
--
-- Backfill:
--   - estado := CASE WHEN activo THEN 'activo' ELSE 'borrador' END.
--     Filas previas con activo=false caen en 'borrador' (no había
--     manera de pausar antes; nunca existió 'pausado').
--
-- Toda la migración corre dentro de una transacción explícita: si
-- falla la recreación de los índices o el ADD GENERATED, el ROLLBACK
-- vuelve a la columna `activo` original. Sin ventana de inconsistencia.
-- =============================================================

BEGIN;

-- =============================================================
-- 1) Columna `estado` + backfill
-- =============================================================
ALTER TABLE public.flujos
  ADD COLUMN estado text NOT NULL DEFAULT 'borrador'
  CHECK (estado IN ('borrador', 'activo', 'pausado'));

-- Backfill: filas existentes mantienen su semántica operacional.
UPDATE public.flujos
SET estado = CASE WHEN activo THEN 'activo' ELSE 'borrador' END;

-- =============================================================
-- 2) Reemplazar columna `activo` por generated column
-- =============================================================
-- Postgres bloquea DROP COLUMN si hay índices dependientes. Drop
-- antes y recreamos sobre la nueva columna generada al final.
DROP INDEX IF EXISTS public.flujos_activos_idx;
DROP INDEX IF EXISTS public.flujos_tiempo_activos_idx;

ALTER TABLE public.flujos DROP COLUMN activo;

ALTER TABLE public.flujos
  ADD COLUMN activo boolean
  GENERATED ALWAYS AS (estado = 'activo') STORED;

-- Recreación idéntica a sql/054 y sql/055. Los consumidores no se
-- enteran del cambio porque siguen leyendo y filtrando por `activo`.
CREATE INDEX flujos_activos_idx
  ON public.flujos (empresa_id)
  WHERE activo = true;

CREATE INDEX flujos_tiempo_activos_idx
  ON public.flujos (empresa_id, ultima_ejecucion_tiempo)
  WHERE activo = true AND disparador->>'tipo' LIKE 'tiempo.%';

-- =============================================================
-- 3) Borrador interno + auditoría visual
-- =============================================================
ALTER TABLE public.flujos
  ADD COLUMN borrador_jsonb jsonb;

ALTER TABLE public.flujos
  ADD COLUMN editado_por uuid;

ALTER TABLE public.flujos
  ADD COLUMN editado_por_nombre text;

ALTER TABLE public.flujos
  ADD COLUMN creado_por_nombre text;

-- =============================================================
-- 4) Comentarios de documentación
-- =============================================================
COMMENT ON COLUMN public.flujos.estado IS
  'Estado operacional del flujo (PR 18). borrador = se edita in-place y no dispara. activo = el motor lo ejecuta cuando matchea. pausado = mantiene config sin ejecutar (apagado temporal). Fuente de verdad operacional; activo se deriva de acá.';

COMMENT ON COLUMN public.flujos.activo IS
  'DERIVADO: true sii estado = ''activo''. Generated column STORED para mantener compat con dispatcher / cron / correr-ejecucion sin que tengan que migrar al campo estado. NO escribir directo: cambiar `estado` y este sigue.';

COMMENT ON COLUMN public.flujos.borrador_jsonb IS
  'Versión en edición de un flujo activo o pausado (modelo borrador interno, decisión §5.3 de docs/PLAN_UI_FLUJOS.md). Shape: { disparador, condiciones, acciones }. NULL = no hay borrador en curso. Los flujos en estado borrador editan in-place sobre las columnas publicadas, no acá.';

COMMENT ON COLUMN public.flujos.editado_por IS
  'UUID del usuario que tocó el flujo por última vez (PUT, publicar, descartar, activar, pausar). Mantenido por los endpoints CRUD del PR 18.';

COMMENT ON COLUMN public.flujos.editado_por_nombre IS
  'Nombre denormalizado del último editor para mostrar en la UI sin hacer join. Patrón idéntico a plantillas_correo.';

COMMENT ON COLUMN public.flujos.creado_por_nombre IS
  'Nombre denormalizado del creador. Patrón idéntico a editado_por_nombre.';

COMMIT;
