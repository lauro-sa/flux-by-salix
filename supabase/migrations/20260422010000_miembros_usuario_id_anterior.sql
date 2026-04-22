-- Guarda el usuario_id previo cuando un miembro pasa a "Solo fichaje".
-- Permite reactivar la cuenta sin perder vinculación ni datos.
-- Sin FK: si la cuenta auth se eliminó manualmente, el endpoint de
-- reactivar lo detecta y obliga a enviar invitación nueva.
ALTER TABLE miembros
  ADD COLUMN IF NOT EXISTS usuario_id_anterior uuid;
