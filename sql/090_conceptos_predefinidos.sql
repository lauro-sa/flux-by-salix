-- 090_conceptos_predefinidos.sql
--
-- Marca los conceptos del catálogo base ("Presentismo", "Premio
-- puntualidad", "Antigüedad", "Descuento por uniforme") como
-- `es_predefinido = true`. Estos conceptos son las plantillas que el
-- sistema crea automáticamente al instalar el módulo Nóminas (ver
-- 081_seed_conceptos_sugeridos.sql) y representan los casos de uso
-- más típicos atados a la lógica del motor.
--
-- Comportamiento del flag:
--   - true  → no se permite eliminar el concepto (la UI no muestra el
--             botón, el endpoint DELETE rechaza con 409). El operador
--             puede desactivarlo con el toggle `activo` o editarlo
--             libremente (monto, condición, periodicidad).
--   - false → concepto creado por la empresa: edición y borrado libres.
--
-- Razón: si se borra un predefinido por accidente, hay que recrearlo a
-- mano. Marcarlos protegidos evita ese caso y deja claro cuáles son
-- "del sistema" vs creados por la empresa.

ALTER TABLE conceptos_nomina
  ADD COLUMN IF NOT EXISTS es_predefinido boolean NOT NULL DEFAULT false;

-- Backfill: los 4 conceptos del seed quedan marcados como predefinidos.
UPDATE conceptos_nomina
SET es_predefinido = true
WHERE categoria IN ('presentismo', 'premio', 'antiguedad', 'descuento_uniforme')
  AND nombre IN ('Presentismo', 'Premio puntualidad', 'Antigüedad', 'Descuento por uniforme');

COMMENT ON COLUMN conceptos_nomina.es_predefinido IS
  'true para conceptos del catálogo base (Presentismo, Antigüedad, etc.) que el sistema seedea por empresa. No se permiten eliminar; sí se pueden editar y desactivar.';
