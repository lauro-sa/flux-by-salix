-- =============================================================
-- 070_actividades_relaciones_entidad_nombre.sql
-- =============================================================
-- Sub-PR 20.6 paso 1: migrar actividades.vinculos jsonb a
-- actividades_relaciones. Esta migración prepara el terreno:
--   1. Agrega columna cache entidad_nombre (decisión D1 = A).
--   2. Backfill entidad_nombre en filas que ya existen.
--   3. INSERT de filas faltantes (44 actividades con vinculos
--      legacy -> solo 5 ya estaban en actividades_relaciones).
--   4. Data fix: vinculos legacy con tipo='documento' que en
--      realidad apuntan a presupuestos (CE-4 del plan).
-- Idempotente: rerun no rompe (ON CONFLICT contra el unique idx
-- existente actividades_relaciones_unique_idx + IS NULL guards).
-- =============================================================

-- Paso 1: columna cache (paridad con vinculos.nombre legacy)
ALTER TABLE actividades_relaciones
  ADD COLUMN IF NOT EXISTS entidad_nombre text;

-- Paso 2: backfill entidad_nombre en filas ya existentes
UPDATE actividades_relaciones ar
SET entidad_nombre = elem.nombre
FROM actividades a,
     jsonb_array_elements(a.vinculos) AS v,
     LATERAL (SELECT v->>'tipo' AS tipo, (v->>'id')::uuid AS id, v->>'nombre' AS nombre) elem
WHERE a.id = ar.actividad_id
  AND elem.tipo = ar.entidad_tipo
  AND elem.id = ar.entidad_id
  AND ar.entidad_nombre IS NULL;

-- Paso 3: INSERT de filas faltantes (tipos validos de EntidadRelacionable)
INSERT INTO actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, entidad_nombre, creado_por, creado_en)
SELECT
  a.empresa_id,
  a.id,
  v->>'tipo',
  (v->>'id')::uuid,
  v->>'nombre',
  a.creado_por,
  a.creado_en
FROM actividades a, jsonb_array_elements(a.vinculos) AS v
WHERE jsonb_typeof(a.vinculos) = 'array'
  AND v->>'tipo' IN (
    'contacto','presupuesto','orden','visita','conversacion',
    'asistencia','cuota','actividad','adelanto_nomina','pago_nomina'
  )
ON CONFLICT (empresa_id, actividad_id, entidad_tipo, entidad_id) DO NOTHING;

-- Paso 4: data-fix one-time. Hay 2 vinculos legacy con tipo='documento'
-- que en realidad apuntan a presupuestos (flow viejo del PDF). El guard
-- EXISTS contra presupuestos los normaliza al tipo correcto. Sin guard,
-- un UUID huerfano podria insertarse y romper el JOIN del frontend.
INSERT INTO actividades_relaciones
  (empresa_id, actividad_id, entidad_tipo, entidad_id, entidad_nombre, creado_por, creado_en)
SELECT
  a.empresa_id,
  a.id,
  'presupuesto',
  (v->>'id')::uuid,
  v->>'nombre',
  a.creado_por,
  a.creado_en
FROM actividades a, jsonb_array_elements(a.vinculos) AS v
WHERE jsonb_typeof(a.vinculos) = 'array'
  AND v->>'tipo' = 'documento'
  AND EXISTS (
    SELECT 1 FROM presupuestos p
    WHERE p.id = (v->>'id')::uuid
      AND p.empresa_id = a.empresa_id
  )
ON CONFLICT (empresa_id, actividad_id, entidad_tipo, entidad_id) DO NOTHING;

COMMENT ON COLUMN actividades_relaciones.entidad_nombre IS
  'Nombre cacheado de la entidad vinculada (paridad con vinculos.nombre legacy). Se sincroniza al renombrar la entidad — ver api/contactos/[id]/route.ts.';
