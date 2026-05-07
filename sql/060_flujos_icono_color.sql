-- =============================================================
-- Migración 060: Columnas icono y color en flujos (PR 18.4)
-- =============================================================
-- Agrega dos columnas opcionales para personalización visual del
-- flujo en el listado y el header del editor (decisión de plan UX,
-- §1.6.7 de docs/PLAN_UI_FLUJOS.md). Las usa el listado central
-- (PR 19.1) como ícono+bolita en la columna "Nombre" y el header
-- del editor (PR 19.2) con MiniSelectorIcono.
--
-- Decisión clave (votada por coordinador en sub-PR 18.4):
-- columnas dedicadas en lugar de meterlas dentro de nodos_json.
-- Razón: meterlas en nodos_json es atajo semánticamente incorrecto
-- — nodos_json es la representación visual del canvas (posiciones
-- de pasos, edges); icono y color son metadata del flujo en sí
-- (independiente del canvas). Cuando llegue PR 19.1 (listado con
-- ícono) vamos a querer SELECT sin parsear jsonb.
--
-- Sin índices: se leen siempre como parte del SELECT del flujo,
-- nunca se filtra por ellos.
--
-- Sin backfill: NULL = "sin personalizar", la UI usa ícono y color
-- por default (igual que cualquier entidad de Flux antes de elegir
-- ícono propio).
-- =============================================================

ALTER TABLE public.flujos
  ADD COLUMN IF NOT EXISTS icono text,
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.flujos.icono IS
  'Ícono del flujo en la UI (clave de la librería de íconos de Flux). NULL = sin personalizar (la UI muestra ícono default según tipo de disparador).';

COMMENT ON COLUMN public.flujos.color IS
  'Color del flujo en la UI (token de PALETA_COLORES_ETIQUETA). NULL = sin personalizar (la UI muestra color neutro).';
