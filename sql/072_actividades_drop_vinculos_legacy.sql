-- 072_actividades_drop_vinculos_legacy.sql
-- Sub-PR 20.6 commit 8 (final). DROP de las columnas legacy
-- `actividades.vinculos jsonb` y `actividades.vinculo_ids text[]` después
-- de migrar todos los consumidores a `actividades_relaciones` (tabla N:M
-- creada en sub-PR 20.2, con backfill + cache de entidad_nombre en
-- migraciones 070+071).
--
-- Verificaciones previas al drop (validadas en el repo a nivel código):
--   - Endpoints API leen y escriben relaciones exclusivamente via el
--     helper `actividades-relaciones-helpers.ts` (commits 2-7).
--   - Motor de workflows usa actividades_relaciones para auto-enriquecer
--     al crear actividad y para resolver completar_actividad (commit 3).
--   - Sync de contactos cachea `entidad_nombre` en relaciones (commit 4).
--   - Salix IA escribe y lee desde relaciones (commit 5).
--   - Sync de visitas registra el vínculo en relaciones (commit 7).
--   - Frontend lee `vinculos` del response del API (adaptador construido
--     desde relaciones, ver helper cargarVinculosPorActividad).
--
-- Una vez aplicada, NO HAY ROLLBACK trivial: los datos en vinculos jsonb
-- y vinculo_ids text[] se pierden. El backfill a actividades_relaciones
-- (migraciones 070+071) preserva la información en la tabla N:M.

ALTER TABLE actividades
  DROP COLUMN IF EXISTS vinculos,
  DROP COLUMN IF EXISTS vinculo_ids;
