-- 081_seed_conceptos_sugeridos.sql
-- PR 6 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Crea los 4 conceptos sugeridos en el catálogo de cada empresa que
-- ya tiene el módulo Nóminas instalado. Para empresas que instalen el
-- módulo después de esta migración, el seed se ejecuta desde el
-- handler POST de /api/modulos (ver src/app/api/modulos/route.ts).
--
-- Conceptos creados:
--   1. Presentismo (haber, 10% del básico, condición "sin ausencias")
--   2. Premio puntualidad (haber, monto fijo, condición "sin tardanzas")
--   3. Antigüedad (haber, manual — el usuario calcula caso por caso)
--   4. Descuento por uniforme (descuento, manual)
--
-- Idempotente: usa UNIQUE virtual por (empresa_id, nombre) chequeado
-- con `WHERE NOT EXISTS` para no duplicar si ya están.

INSERT INTO conceptos_nomina (
  empresa_id, nombre, descripcion, icono, color,
  tipo, categoria, modo_calculo, valor,
  automatico, condicion_jsonb, recurrente, activo, orden
)
SELECT e.id, x.nombre, x.descripcion, x.icono, x.color,
       x.tipo, x.categoria, x.modo_calculo, x.valor,
       x.automatico, x.condicion_jsonb, x.recurrente, x.activo, x.orden
FROM empresas e
JOIN modulos_empresa me ON me.empresa_id = e.id AND me.modulo = 'nominas' AND me.activo = true
CROSS JOIN (VALUES
  (
    'Presentismo',
    'Premio del 10% sobre el monto base cuando el empleado no tuvo ausencias en el período.',
    'BadgeCheck', '#10b981',
    'haber', 'presentismo', 'porcentaje_basico', 10::numeric,
    true, '{"tipo":"sin_ausencias"}'::jsonb, true, true, 1
  ),
  (
    'Premio puntualidad',
    'Monto fijo cuando el empleado no llegó tarde en el período.',
    'Clock', '#3b82f6',
    'haber', 'premio', 'monto_fijo', 0::numeric,
    true, '{"tipo":"sin_tardanzas"}'::jsonb, true, true, 2
  ),
  (
    'Antigüedad',
    'Adicional por antigüedad. Se calcula manualmente por empleado según años de relación.',
    'Award', '#f59e0b',
    'haber', 'antiguedad', 'manual', NULL::numeric,
    false, '{"tipo":"siempre"}'::jsonb, true, true, 3
  ),
  (
    'Descuento por uniforme',
    'Descuento mensual del uniforme. El monto se carga manualmente al asignar a un contrato.',
    'Shirt', '#94a3b8',
    'descuento', 'descuento_uniforme', 'manual', NULL::numeric,
    false, NULL::jsonb, true, true, 4
  )
) AS x (
  nombre, descripcion, icono, color,
  tipo, categoria, modo_calculo, valor,
  automatico, condicion_jsonb, recurrente, activo, orden
)
WHERE NOT EXISTS (
  SELECT 1 FROM conceptos_nomina cn
  WHERE cn.empresa_id = e.id AND cn.nombre = x.nombre
);
