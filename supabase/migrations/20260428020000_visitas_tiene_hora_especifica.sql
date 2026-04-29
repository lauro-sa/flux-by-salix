-- Agrega `tiene_hora_especifica` a `visitas`.
--
-- Permite distinguir entre una visita programada para una hora puntual del día
-- (ej: "9:30 AM, llegada exacta") y una visita planificada solo por día con hora
-- a definir en el recorrido (ej: "martes 28/04, en algún momento entre 11 y 17").
--
-- Cuando es false, la UI muestra solo la fecha y trata la hora como referencia
-- (no contamina reportes con horarios artificiales). Default false: las visitas
-- existentes pasan a "sin hora específica" — si la hora actual era 09:00 (default
-- histórico) eso era exactamente "no se eligió hora", así que el flag refleja la
-- realidad de los datos.

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS tiene_hora_especifica boolean NOT NULL DEFAULT false;
