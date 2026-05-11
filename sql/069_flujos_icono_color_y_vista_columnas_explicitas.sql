-- =============================================================
-- Migración 069: Hotfix flujos icono/color + vista columnas explícitas
-- =============================================================
-- Cierra dos deudas pre-existentes (anotadas como hotfix en
-- CHANGELOG_FLUJOS.md del PR 20):
--
-- 1. Agrega columnas icono y color a flujos. El archivo
--    sql/060_flujos_icono_color.sql existe en filesystem desde
--    PR 18.4 pero nunca se aplicó a la BD. El código de main
--    (PR 19.1+) lee f.icono y f.color, causando 422 en runtime.
--
-- 2. Recrea la vista flujos_con_estadisticas con columnas
--    explícitas. La versión anterior (sql/059) usa SELECT f.*
--    que PostgreSQL congela al CREATE VIEW — agregar columnas
--    nuevas a flujos no se refleja automáticamente. Ahora
--    enumeradas explícitamente.
--
-- También incluye clave_sistema (de 067, sub-PR 20.3) que la
-- vista actual tampoco devuelve.
--
-- Las nuevas columnas (icono, color, clave_sistema) se agregan
-- al final del SELECT — PostgreSQL no permite reordenar columnas
-- existentes con CREATE OR REPLACE VIEW.
-- =============================================================

-- Paso 1: Columnas icono y color (idempotente)
ALTER TABLE public.flujos
  ADD COLUMN IF NOT EXISTS icono text,
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.flujos.icono IS
  'Ícono del flujo en la UI (clave de la librería de íconos de Flux). NULL = sin personalizar (la UI muestra ícono default según tipo de disparador).';

COMMENT ON COLUMN public.flujos.color IS
  'Color del flujo en la UI (token de PALETA_COLORES_ETIQUETA). NULL = sin personalizar (la UI muestra color neutro).';

-- Paso 2: Recrear vista con columnas explícitas (nuevas AL FINAL)
CREATE OR REPLACE VIEW public.flujos_con_estadisticas AS
SELECT
  f.id,
  f.empresa_id,
  f.nombre,
  f.descripcion,
  f.disparador,
  f.condiciones,
  f.acciones,
  f.nodos_json,
  f.creado_por,
  f.creado_en,
  f.actualizado_en,
  f.ultima_ejecucion_tiempo,
  f.estado,
  f.activo,
  f.borrador_jsonb,
  f.editado_por,
  f.editado_por_nombre,
  f.creado_por_nombre,
  ult.ultima_ejecucion_en,
  cnt.total_ejecuciones_30d,
  f.icono,
  f.color,
  f.clave_sistema
FROM public.flujos f
LEFT JOIN LATERAL (
  SELECT max(ejecuciones_flujo.creado_en) AS ultima_ejecucion_en
  FROM public.ejecuciones_flujo
  WHERE ejecuciones_flujo.flujo_id = f.id
) ult ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS total_ejecuciones_30d
  FROM public.ejecuciones_flujo
  WHERE ejecuciones_flujo.flujo_id = f.id
    AND ejecuciones_flujo.creado_en >= (now() - '30 days'::interval)
) cnt ON true;

COMMENT ON VIEW public.flujos_con_estadisticas IS
  'Vista de flujos enriquecida con ultima_ejecucion_en y total_ejecuciones_30d. Columnas enumeradas explícitamente (no SELECT *) para que agregar columnas a flujos no requiera recrear la vista — solo agregar la columna explícita acá.';
