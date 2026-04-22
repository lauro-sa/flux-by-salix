-- Habilita Supabase Realtime en la tabla miembros para permisos reactivos en vivo.
-- El cliente se suscribe a UPDATE de su propia fila (filtrado por id) y
-- refresca permisos cuando el admin los cambia, sin necesidad de recargar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'miembros'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE miembros;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: el payload del realtime incluye la fila completa
-- antes/después del UPDATE, para que el cliente pueda diffear sin hacer
-- una query adicional por cada evento.
ALTER TABLE miembros REPLICA IDENTITY FULL;
