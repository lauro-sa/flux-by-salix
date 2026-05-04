-- =============================================================
-- Migración 055: Triggers de tiempo en workflows (PR 17)
-- =============================================================
-- Agrega soporte a disparadores time-driven:
--   - tiempo.cron               (expresiones cron tipo `0 9 * * *`)
--   - tiempo.relativo_a_campo   ("entidades cuyo campo_fecha + delta = hoy")
--
-- El cron `/api/cron/disparar-workflows-tiempo` corre cada minuto
-- y escanea flujos con disparador.tipo LIKE 'tiempo.%'. Para cada
-- match crea ejecuciones_flujo y dispara fire-and-forget al worker.
--
-- Componentes:
--   1) Columna `flujos.ultima_ejecucion_tiempo` — timestamp del último
--      disparo del flujo. Permite que el cron evalúe "¿la próxima
--      ventana ya pasó?" y dispare incluso si el cron se atrasó (deploy,
--      caída de Vercel, etc.). Patrón estándar de Sidekiq/Quartz.
--   2) Índice parcial sobre flujos con disparador tiempo.* — el cron
--      escanea solo lo que necesita, sin full table scan.
--
-- Sin breaking changes: la columna es nullable, los flujos existentes
-- (entidad.estado_cambio) no se ven afectados.
-- =============================================================

ALTER TABLE public.flujos
  ADD COLUMN ultima_ejecucion_tiempo timestamptz;

COMMENT ON COLUMN public.flujos.ultima_ejecucion_tiempo IS
  'Timestamp del último disparo de un flujo time-driven (PR 17). Usado por el cron /api/cron/disparar-workflows-tiempo para calcular si la próxima ventana ya pasó. NULL = nunca disparó (la primera próxima ejecución se calcula desde now() — flujos recién creados NO disparan retroactivamente para ventanas que ya pasaron en el día actual).';

-- Índice parcial: el cron de tiempo solo escanea flujos activos cuyo
-- disparador empieza con 'tiempo.'. Mantiene el índice chico aunque
-- crezcan los flujos event-driven.
CREATE INDEX IF NOT EXISTS flujos_tiempo_activos_idx
  ON public.flujos (empresa_id, ultima_ejecucion_tiempo)
  WHERE activo = true AND disparador->>'tipo' LIKE 'tiempo.%';
