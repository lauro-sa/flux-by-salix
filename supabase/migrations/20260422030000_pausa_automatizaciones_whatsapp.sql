-- Pausa de automatizaciones de WhatsApp cuando responde un humano
-- Config por empresa + timestamp en la conversación para saber hasta cuándo pausar

-- ─── Config por empresa ───
-- pausa_*_modo: 'siempre_activo' | 'manual' | 'temporal'
--   siempre_activo → el bot/IA nunca se pausa aunque responda el humano
--   manual         → se pausa hasta que el humano lo reactive o se cierre la conversación
--   temporal       → se pausa por X minutos tras la respuesta humana
-- pausa_*_minutos: duración del modo 'temporal' (null en otros modos)
ALTER TABLE config_whatsapp
  ADD COLUMN IF NOT EXISTS pausa_chatbot_modo text NOT NULL DEFAULT 'temporal',
  ADD COLUMN IF NOT EXISTS pausa_chatbot_minutos integer DEFAULT 720,
  ADD COLUMN IF NOT EXISTS pausa_agente_ia_modo text NOT NULL DEFAULT 'temporal',
  ADD COLUMN IF NOT EXISTS pausa_agente_ia_minutos integer DEFAULT 720;

-- Restricción de valores válidos
ALTER TABLE config_whatsapp
  DROP CONSTRAINT IF EXISTS config_whatsapp_pausa_chatbot_modo_check;
ALTER TABLE config_whatsapp
  ADD CONSTRAINT config_whatsapp_pausa_chatbot_modo_check
  CHECK (pausa_chatbot_modo IN ('siempre_activo', 'manual', 'temporal'));

ALTER TABLE config_whatsapp
  DROP CONSTRAINT IF EXISTS config_whatsapp_pausa_agente_ia_modo_check;
ALTER TABLE config_whatsapp
  ADD CONSTRAINT config_whatsapp_pausa_agente_ia_modo_check
  CHECK (pausa_agente_ia_modo IN ('siempre_activo', 'manual', 'temporal'));

-- ─── Timestamps de pausa por conversación ───
-- Las columnas chatbot_pausado_hasta e ia_pausado_hasta ya existen (migración previa).
-- Semántica:
--   flag=false y timestamp NULL   → pausa permanente (hasta reactivar manual)
--   flag=false y timestamp futuro → pausa temporal activa
--   flag=false y timestamp pasado → se reactiva al procesar el próximo mensaje
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS chatbot_pausado_hasta timestamptz,
  ADD COLUMN IF NOT EXISTS ia_pausado_hasta timestamptz;
