-- =============================================================
-- Migración 059: Vista flujos_con_estadisticas + índice (PR 18.3)
-- =============================================================
-- Tres componentes:
--
--   1) Vista `flujos_con_estadisticas` que agrega columnas
--      derivadas de `ejecuciones_flujo` al modelo de `flujos`:
--
--        ultima_ejecucion_en      timestamptz | null
--        total_ejecuciones_30d    int
--
--      La UI del PR 19 las muestra como columnas del listado
--      (memoria del proyecto: §1.4 plan UX). Pre-computar acá
--      evita que el endpoint haga 2 queries y rompa la paginación
--      cuando se filtra por `fecha_ultima_ejecucion` (filtro
--      diferido del 18.1, ahora resuelto).
--
--      `security_invoker = true` (Postgres 15+) hace que la vista
--      respete las RLS de las tablas subyacentes (`flujos`,
--      `ejecuciones_flujo`) según el caller — sin esto el SELECT
--      bypassearía RLS porque las vistas heredan el owner por
--      default.
--
--   2) GRANT SELECT a authenticated y service_role. La vista no
--      tiene RLS propia (es un objeto derivado); el control de
--      visibilidad lo hacen las RLS de las tablas subyacentes
--      gracias a `security_invoker`.
--
--   3) Índice `ejecuciones_flujo_por_flujo_creado_idx (flujo_id,
--      creado_en DESC)`. El índice existente
--      `ejecuciones_flujo_por_flujo_idx (empresa_id, flujo_id,
--      creado_en DESC)` también puede servir, pero con
--      empresa_id como primera key requiere seek; un índice
--      directo sobre (flujo_id, creado_en) es óptimo para los dos
--      LATERAL JOINs de la vista (MAX y COUNT en ventana de 30d).
--      Decisión: agregarlo definitivo, no como parche.
-- =============================================================

-- =============================================================
-- 1) Índice de soporte para los LATERAL JOINs de la vista
-- =============================================================
CREATE INDEX IF NOT EXISTS ejecuciones_flujo_por_flujo_creado_idx
  ON public.ejecuciones_flujo (flujo_id, creado_en DESC);

-- =============================================================
-- 2) Vista flujos_con_estadisticas
-- =============================================================
CREATE OR REPLACE VIEW public.flujos_con_estadisticas
WITH (security_invoker = true) AS
SELECT
  f.*,
  ult.ultima_ejecucion_en,
  cnt.total_ejecuciones_30d
FROM public.flujos f
LEFT JOIN LATERAL (
  SELECT MAX(creado_en) AS ultima_ejecucion_en
  FROM public.ejecuciones_flujo
  WHERE flujo_id = f.id
) ult ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS total_ejecuciones_30d
  FROM public.ejecuciones_flujo
  WHERE flujo_id = f.id
    AND creado_en >= now() - interval '30 days'
) cnt ON true;

GRANT SELECT ON public.flujos_con_estadisticas TO authenticated, service_role;

COMMENT ON VIEW public.flujos_con_estadisticas IS
  'PR 18.3 — vista de flujos con estadísticas agregadas de ejecuciones_flujo (última ejecución y total en 30 días). security_invoker=true hace que herede las RLS del caller. Reusada por GET /api/flujos para soportar filtro fecha_ultima_ejecucion antes de paginar.';
