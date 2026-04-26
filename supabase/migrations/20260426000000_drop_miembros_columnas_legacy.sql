-- Eliminar columnas legacy de texto en `miembros`.
-- Razón: convivían con `miembros.puesto_id` (FK a `puestos`) y la tabla
-- `miembros_sectores` (relación N:M con `sectores`). Las columnas de texto se
-- llenaban manualmente y quedaban desincronizadas con las fuentes nuevas, lo
-- que provocaba que algunos usuarios se vieran sin puesto/sector en la UI
-- aunque tuvieran sus datos correctamente cargados en las tablas relacionales.
--
-- A partir de esta migración:
--   - El nombre del puesto se obtiene SIEMPRE por FK miembros.puesto_id → puestos.nombre.
--   - El sector primario se obtiene SIEMPRE por miembros_sectores con es_primario=true → sectores.nombre.
--   - El helper `cargarEtiquetasMiembros` (src/lib/miembros/etiquetas.ts) centraliza la resolución.

ALTER TABLE public.miembros DROP COLUMN IF EXISTS puesto_nombre;
ALTER TABLE public.miembros DROP COLUMN IF EXISTS sector;
