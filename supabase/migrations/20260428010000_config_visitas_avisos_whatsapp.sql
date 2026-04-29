-- Agrega el toggle `enviar_avisos_whatsapp` a `config_visitas`.
--
-- Controla si el módulo de Visitas envía avisos automáticos por WhatsApp
-- ("voy en camino" y "ya llegué") al receptor durante el recorrido. Cuando
-- está OFF, el flujo del recorrido salta directamente al cambio de estado
-- sin abrir los modales de envío. Default: false (opt-in explícito).

ALTER TABLE public.config_visitas
  ADD COLUMN IF NOT EXISTS enviar_avisos_whatsapp boolean NOT NULL DEFAULT false;
