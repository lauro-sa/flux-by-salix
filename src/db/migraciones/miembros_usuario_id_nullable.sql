-- Miembros sin cuenta Flux: permite que el admin cargue empleados completos
-- (con legajo, puesto, compensación, RFID/PIN de kiosco, etc.) antes de que
-- el empleado reclame su cuenta. Cubre tres escenarios:
--   1. "fichaje"   — empleado que solo ficha en kiosco, no usa la app
--   2. "pendiente" — admin envió invitación, esperando registro
--   3. "activo"    — empleado con cuenta Flux vinculada
-- El estado se deriva en el frontend desde (usuario_id, activo, invitación).

-- 1. Hacer usuario_id nullable
ALTER TABLE miembros
  ALTER COLUMN usuario_id DROP NOT NULL;

-- 2. Reemplazar unique index por partial unique index:
--    permite múltiples miembros con usuario_id NULL en la misma empresa
--    (cada uno es un empleado distinto sin cuenta), pero sigue impidiendo
--    que un mismo usuario real esté dos veces en la misma empresa.
DROP INDEX IF EXISTS miembros_usuario_empresa_idx;

CREATE UNIQUE INDEX miembros_usuario_empresa_idx
  ON miembros (usuario_id, empresa_id)
  WHERE usuario_id IS NOT NULL;

-- 3. Índice para búsqueda por correo en miembros sin cuenta.
--    El correo se guarda en contactos.correo (vinculado vía contactos.miembro_id),
--    así que no agregamos columna nueva; el índice va sobre contactos.
CREATE INDEX IF NOT EXISTS contactos_correo_sin_miembro_idx
  ON contactos (correo)
  WHERE miembro_id IS NOT NULL AND correo IS NOT NULL;

COMMENT ON COLUMN miembros.usuario_id IS 'FK a auth.users — NULL si el empleado aún no tiene cuenta Flux (solo fichaje o pendiente de activar)';
