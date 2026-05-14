-- 073_modulo_nominas_catalogo.sql
-- PR 1 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Inserta el módulo `nominas` en `catalogo_modulos` con dependencia
-- explícita en `asistencias`. Esto habilita:
--   - Que aparezca en la tienda /aplicaciones como instalable (tier starter).
--   - Que el flujo de instalación (POST /api/modulos) instale en cascada
--     `asistencias` si todavía no está activo en la empresa.
--
-- La columna `requiere text[]` ya existe en `catalogo_modulos` desde la
-- migración 017_catalogo_modulos.sql, así que esta migración solo agrega
-- el seed.
--
-- Sin DDL → reaplicable de forma segura gracias al ON CONFLICT (slug).

INSERT INTO catalogo_modulos (
  slug,
  nombre,
  descripcion,
  icono,
  categoria,
  es_base,
  orden,
  tier,
  requiere
) VALUES (
  'nominas',
  'Nóminas',
  'Liquidación de salarios, contratos laborales, conceptos de pago y adelantos.',
  'banknote',
  'admin',
  false,
  18,
  'starter',
  ARRAY['asistencias']
)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  icono = EXCLUDED.icono,
  categoria = EXCLUDED.categoria,
  es_base = EXCLUDED.es_base,
  orden = EXCLUDED.orden,
  tier = EXCLUDED.tier,
  requiere = EXCLUDED.requiere;
