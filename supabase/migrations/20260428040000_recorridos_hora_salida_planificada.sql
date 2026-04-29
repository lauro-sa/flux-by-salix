-- Hora de salida planificada del recorrido.
--
-- Cuando el coordinador (o el propio visitador) elige una hora de salida desde
-- el modal de recorrido, esta columna guarda ese timestamp y dispara un
-- recálculo en cascada de fecha_programada para cada visita del día — usando
-- duracion_viaje_min + duracion_estimada_min para estimar la llegada a cada
-- parada en el orden actual.
--
-- Nullable: si el día no tiene hora de salida planificada, las visitas quedan
-- "sin hora específica" como hasta ahora.

ALTER TABLE public.recorridos
  ADD COLUMN IF NOT EXISTS hora_salida_planificada timestamptz;
