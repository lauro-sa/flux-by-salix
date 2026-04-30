-- Migración: trazabilidad de pausa de chatbot e IA por conversación
-- Fecha: 2026-04-29
-- Permite mostrar en el tooltip del pill por qué, cuándo y quién pausó la
-- automatización en cada conversación. La lógica de reactivación sigue
-- dependiendo de chatbot_pausado_hasta / ia_pausado_hasta.

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS chatbot_pausado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS ia_pausado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS chatbot_pausado_por UUID,
  ADD COLUMN IF NOT EXISTS ia_pausado_por UUID,
  ADD COLUMN IF NOT EXISTS chatbot_pausado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ia_pausado_en TIMESTAMPTZ;

-- Valores esperados de motivo (no se enforza con CHECK para flexibilidad futura):
--   'manual'           — el usuario clickeó el pill y pausó la conversación
--   'respuesta_humana' — el agente envió un mensaje manual (texto/media)
--   'plantilla'        — se envió una plantilla desde una entidad (presupuesto, factura, etc.)
--   'sistema'          — el webhook pausó la automatización por un patrón configurado o
--                        un admin desactivó la automatización globalmente desde config
--
-- chatbot_pausado_por / ia_pausado_por: usuario que disparó la pausa. NULL si motivo='sistema'.
-- chatbot_pausado_en / ia_pausado_en: cuándo se pausó. Permite mostrar antigüedad de la pausa.

-- ─── Backfill de conversaciones pausadas previo a esta migración ───
-- Para conversaciones ya pausadas, inferimos motivo/por/en desde el último mensaje
-- saliente (que típicamente es el que disparó la pausa). Si era una plantilla
-- (plantilla_id NOT NULL) → 'plantilla'; si era texto/media de un agente humano
-- → 'respuesta_humana'; si fue del sistema → 'sistema'.

WITH ultimo_saliente AS (
  SELECT DISTINCT ON (m.conversacion_id)
    m.conversacion_id,
    m.creado_en,
    m.remitente_id,
    m.plantilla_id,
    m.remitente_tipo
  FROM mensajes m
  WHERE m.es_entrante = false
    AND m.remitente_tipo IN ('agente', 'sistema')
    AND COALESCE(m.es_nota_interna, false) = false
  ORDER BY m.conversacion_id, m.creado_en DESC
)
UPDATE conversaciones c
SET
  ia_pausado_motivo = CASE
    WHEN us.plantilla_id IS NOT NULL THEN 'plantilla'
    WHEN us.remitente_tipo = 'agente' THEN 'respuesta_humana'
    ELSE 'sistema'
  END,
  ia_pausado_por = CASE WHEN us.remitente_tipo = 'sistema' THEN NULL ELSE us.remitente_id END,
  ia_pausado_en = us.creado_en
FROM ultimo_saliente us
WHERE c.id = us.conversacion_id
  AND c.ia_pausado_motivo IS NULL
  AND c.agente_ia_activo = false;

WITH ultimo_saliente AS (
  SELECT DISTINCT ON (m.conversacion_id)
    m.conversacion_id,
    m.creado_en,
    m.remitente_id,
    m.plantilla_id,
    m.remitente_tipo
  FROM mensajes m
  WHERE m.es_entrante = false
    AND m.remitente_tipo IN ('agente', 'sistema')
    AND COALESCE(m.es_nota_interna, false) = false
  ORDER BY m.conversacion_id, m.creado_en DESC
)
UPDATE conversaciones c
SET
  chatbot_pausado_motivo = CASE
    WHEN us.plantilla_id IS NOT NULL THEN 'plantilla'
    WHEN us.remitente_tipo = 'agente' THEN 'respuesta_humana'
    ELSE 'sistema'
  END,
  chatbot_pausado_por = CASE WHEN us.remitente_tipo = 'sistema' THEN NULL ELSE us.remitente_id END,
  chatbot_pausado_en = us.creado_en
FROM ultimo_saliente us
WHERE c.id = us.conversacion_id
  AND c.chatbot_pausado_motivo IS NULL
  AND c.chatbot_activo = false;
