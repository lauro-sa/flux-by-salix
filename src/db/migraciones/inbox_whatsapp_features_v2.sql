-- Migración: Features WhatsApp inbox — paridad con Salix v1
-- Fecha: 2026-04-05
-- Incluye: pins, silencios, seguidores, sector, bloqueo, papelera, bot/IA pause, validaciones etapa

-- ─── 1. Campos nuevos en conversaciones ───

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sector_nombre TEXT,
  ADD COLUMN IF NOT EXISTS sector_color TEXT,
  ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS en_pipeline BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS en_papelera BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS papelera_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chatbot_pausado_hasta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ia_pausado_hasta TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversaciones_sector ON conversaciones(empresa_id, sector_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_papelera ON conversaciones(empresa_id, en_papelera);
CREATE INDEX IF NOT EXISTS idx_conversaciones_bloqueada ON conversaciones(empresa_id, bloqueada);

-- ─── 2. Conversacion pins (fijar por usuario) ───

CREATE TABLE IF NOT EXISTS conversacion_pins (
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  fijada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversacion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_conversacion_pins_usuario ON conversacion_pins(usuario_id);

ALTER TABLE conversacion_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversacion_pins_usuario" ON conversacion_pins
  USING (usuario_id = auth.uid());

-- ─── 3. Conversacion seguidores (followers para push) ───

CREATE TABLE IF NOT EXISTS conversacion_seguidores (
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  agregado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversacion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_conversacion_seguidores_usuario ON conversacion_seguidores(usuario_id);

ALTER TABLE conversacion_seguidores ENABLE ROW LEVEL SECURITY;

-- Los seguidores pueden verse entre sí (para mostrar quién sigue la conversación)
CREATE POLICY "conversacion_seguidores_ver" ON conversacion_seguidores
  FOR SELECT USING (true);

CREATE POLICY "conversacion_seguidores_gestionar" ON conversacion_seguidores
  FOR ALL USING (usuario_id = auth.uid());

-- ─── 4. Conversacion silencios (mute por usuario) ───

CREATE TABLE IF NOT EXISTS conversacion_silencios (
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  silenciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversacion_id, usuario_id)
);

ALTER TABLE conversacion_silencios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversacion_silencios_usuario" ON conversacion_silencios
  USING (usuario_id = auth.uid());

-- ─── 5. Campos de validación en etapas_conversacion ───

ALTER TABLE etapas_conversacion
  ADD COLUMN IF NOT EXISTS requisitos JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sectores_permitidos UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acciones_auto JSONB NOT NULL DEFAULT '[]';

-- Nota: requisitos es un array de { campo: string, estricto: boolean }
-- Campos posibles: contacto_vinculado, agente_asignado, sector, direccion, email, telefono
-- acciones_auto es un array de { tipo: string, config?: {} }
-- Tipos: crear_actividad, crear_visita, crear_presupuesto, pedir_motivo
