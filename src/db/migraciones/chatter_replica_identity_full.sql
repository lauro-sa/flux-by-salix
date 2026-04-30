-- chatter: REPLICA IDENTITY FULL
-- Por defecto Postgres usa REPLICA IDENTITY DEFAULT, que en eventos DELETE
-- envía solo la PK al stream de replicación. Supabase Realtime aplica el
-- filter (`entidad_id=eq.X`) sobre la fila vieja del DELETE: si esa fila
-- no incluye `entidad_id`, el filter no matchea y el cliente nunca recibe
-- el evento. Resultado: el frontend no se entera cuando se borra una
-- entrada del chatter (ej. al soft-delete de un pago).
-- Con FULL la fila vieja viaja completa y el filter funciona también para
-- DELETEs. Costo: ligero overhead en el WAL para esta tabla.
ALTER TABLE chatter REPLICA IDENTITY FULL;
