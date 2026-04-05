-- Migración: Etapas de conversación, snooze con nota, WhatsApp programados
-- Fecha: 2026-04-05

-- ─── 1. Etapas de conversación (configurables por empresa y tipo de canal) ───

CREATE TABLE IF NOT EXISTS etapas_conversacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_canal TEXT NOT NULL, -- 'whatsapp' | 'correo'
  clave TEXT NOT NULL,
  etiqueta TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icono TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  es_predefinida BOOLEAN NOT NULL DEFAULT false,
  activa BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo_canal, clave)
);

CREATE INDEX idx_etapas_conversacion_empresa ON etapas_conversacion(empresa_id, tipo_canal);

ALTER TABLE etapas_conversacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etapas_conversacion_empresa" ON etapas_conversacion
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── 2. Campos de snooze y etapa en conversaciones ───

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS etapa_id UUID REFERENCES etapas_conversacion(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snooze_hasta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snooze_nota TEXT,
  ADD COLUMN IF NOT EXISTS snooze_por UUID;

CREATE INDEX idx_conversaciones_etapa ON conversaciones(empresa_id, etapa_id);
CREATE INDEX idx_conversaciones_snooze ON conversaciones(empresa_id, snooze_hasta)
  WHERE snooze_hasta IS NOT NULL;

-- ─── 3. WhatsApp mensajes programados ───

CREATE TABLE IF NOT EXISTS whatsapp_programados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canales_inbox(id),
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE SET NULL,
  creado_por UUID NOT NULL,
  destinatario TEXT NOT NULL, -- número de teléfono
  tipo_contenido TEXT NOT NULL DEFAULT 'texto', -- 'texto' | 'imagen' | 'audio' | 'video' | 'documento' | 'plantilla'
  texto TEXT,
  media_url TEXT,
  media_nombre TEXT,
  plantilla_nombre TEXT,
  plantilla_idioma TEXT,
  plantilla_componentes JSONB,
  enviar_en TIMESTAMPTZ NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'enviado' | 'cancelado' | 'error'
  enviado_en TIMESTAMPTZ,
  wa_message_id TEXT,
  error TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_programados_empresa ON whatsapp_programados(empresa_id);
CREATE INDEX idx_whatsapp_programados_estado ON whatsapp_programados(estado, enviar_en);

ALTER TABLE whatsapp_programados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_programados_empresa" ON whatsapp_programados
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── 4. Insertar etapas predefinidas (se ejecuta por API al crear empresa o restablecer) ───
-- Las etapas default se insertan desde la API, no desde SQL,
-- para que el patrón de restablecer funcione igual que en contactos.

-- Etapas WhatsApp default:
-- nuevo (gris) → contactado (azul) → calificado (amarillo) → propuesta (violeta) → ganado (verde) → perdido (rojo)

-- Etapas Correo default:
-- recibido (gris) → en_proceso (azul) → respondido (verde) → seguimiento (amarillo) → cerrado (violeta)
