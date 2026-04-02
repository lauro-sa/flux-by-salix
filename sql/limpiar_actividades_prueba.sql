-- ═══════════════════════════════════════════════════════════════════════════
-- Limpiar actividades de prueba — Flux
--
-- Ejecutar en Supabase: SQL Editor (rol con permisos sobre las tablas).
-- Revisá el SELECT de abajo ANTES de descomentar los DELETE.
--
-- IMPORTANTE (multi-tenant):
--   En producción, SIEMPRE filtrá por empresa_id. No borres todas las empresas.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Vista previa: cuántas actividades hay por empresa
SELECT empresa_id, count(*) AS total
FROM actividades
GROUP BY empresa_id
ORDER BY total DESC;

-- 2) Reemplazá este UUID por el de tu empresa activa (JWT / selector de empresa)
--    Si solo tenés datos de prueba en UNA empresa, usá ese filtro en todo.
-- \set empresa_test '00000000-0000-0000-0000-000000000000'

-- 3) Chatter vinculado a actividades (polimórfico: entidad_tipo = 'actividad')
--    Borrar antes evita mensajes huérfanos en el chatter.
-- Descomentá y ajustá empresa_id:

-- DELETE FROM chatter
-- WHERE entidad_tipo = 'actividad'
--   AND empresa_id = 'PONER_UUID_EMPRESA_AQUI';

-- 4) Notificaciones que referencian una actividad (opcional, limpia campana)
-- DELETE FROM notificaciones
-- WHERE referencia_tipo = 'actividad'
--   AND empresa_id = 'PONER_UUID_EMPRESA_AQUI';

-- 5) Filas en actividades
-- DELETE FROM actividades
-- WHERE empresa_id = 'PONER_UUID_EMPRESA_AQUI';

-- ═══════════════════════════════════════════════════════════════════════════
-- SOLO entorno local / una sola empresa de test (¡peligro si hay datos reales!)
-- Descomentá solo si estás seguro de borrar TODAS las actividades de TODAS las empresas:
-- ═══════════════════════════════════════════════════════════════════════════

-- DELETE FROM chatter WHERE entidad_tipo = 'actividad';
-- DELETE FROM notificaciones WHERE referencia_tipo = 'actividad';
-- DELETE FROM actividades;
