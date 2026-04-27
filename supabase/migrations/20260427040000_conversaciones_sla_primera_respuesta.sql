-- Agrega las columnas de tracking de SLA de primera respuesta a `conversaciones`.
--
-- El feature de SLA (configuración por canal, cron de vencimiento, métricas
-- de cumplimiento, notificaciones, columnas en config_correo/config_whatsapp)
-- está cableado en el código desde el commit c3d4e3a (2026-03-31), pero las
-- columnas de tracking en `conversaciones` nunca se crearon. Como resultado,
-- todos los endpoints que dependen de SLA (cron sla-vencido, /api/inbox/metricas,
-- /api/whatsapp/enviar/webhook) estaban rotos silenciosamente.
--
-- Esta migración cierra el gap creando las columnas faltantes:
--   - sla_primera_respuesta_vence_en: cuándo vence el SLA (lo setea el webhook
--     al recibir el primer mensaje, según config_inbox.sla_primera_respuesta_minutos).
--   - sla_primera_respuesta_en: cuándo el agente respondió por primera vez.
--   - sla_primera_respuesta_cumplido: true si la respuesta llegó antes del vencimiento.

ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS sla_primera_respuesta_vence_en timestamptz,
  ADD COLUMN IF NOT EXISTS sla_primera_respuesta_en timestamptz,
  ADD COLUMN IF NOT EXISTS sla_primera_respuesta_cumplido boolean;

-- Índice para el cron de SLA vencido: corre cada 15min y filtra por
--   sla_primera_respuesta_vence_en < now()
--   AND sla_primera_respuesta_en IS NULL
--   AND estado IN ('abierta','pendiente').
-- Partial index sobre las que aún no respondieron.
CREATE INDEX IF NOT EXISTS conversaciones_sla_pendientes_idx
  ON public.conversaciones (empresa_id, sla_primera_respuesta_vence_en)
  WHERE sla_primera_respuesta_en IS NULL
    AND sla_primera_respuesta_vence_en IS NOT NULL;
