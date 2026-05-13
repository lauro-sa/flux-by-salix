-- 071_actividades_relaciones_resync_nombre_legacy.sql
-- Sub-PR 20.6 commit 1 (continuación de 070). Rellena entidad_nombre
-- para relaciones pre-existentes en actividades_relaciones cuyo entidad_tipo
-- NO matchea el tipo de los vinculos legacy de la misma actividad. Estas
-- filas son típicamente auto-enriquecidas por el motor de flujos del PR 20:
-- una actividad genera un presupuesto vía completar_actividad, queda la
-- relación actividad→presupuesto en actividades_relaciones, pero el
-- vinculos legacy de la actividad sigue apuntando al contacto destinatario.
-- Idempotente: solo afecta filas con entidad_nombre IS NULL.

UPDATE actividades_relaciones ar
SET entidad_nombre = TRIM(BOTH FROM (c.nombre || ' ' || COALESCE(c.apellido, '')))
FROM contactos c
WHERE ar.entidad_tipo = 'contacto'
  AND ar.entidad_id = c.id
  AND ar.empresa_id = c.empresa_id
  AND ar.entidad_nombre IS NULL;

UPDATE actividades_relaciones ar
SET entidad_nombre = p.numero
FROM presupuestos p
WHERE ar.entidad_tipo = 'presupuesto'
  AND ar.entidad_id = p.id
  AND ar.empresa_id = p.empresa_id
  AND ar.entidad_nombre IS NULL;

UPDATE actividades_relaciones ar
SET entidad_nombre = o.numero
FROM ordenes_trabajo o
WHERE ar.entidad_tipo = 'orden'
  AND ar.entidad_id = o.id
  AND ar.empresa_id = o.empresa_id
  AND ar.entidad_nombre IS NULL;
