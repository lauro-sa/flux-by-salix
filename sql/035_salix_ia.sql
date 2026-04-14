-- ═══════════════════════════════════════════════════════════════
-- SALIX IA — Copilot interno para empleados
-- ═══════════════════════════════════════════════════════════════

-- Configuración de Salix IA por empresa
CREATE TABLE IF NOT EXISTS config_salix_ia (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT false,
  nombre TEXT NOT NULL DEFAULT 'Salix IA',
  personalidad TEXT DEFAULT '',
  herramientas_habilitadas TEXT[] NOT NULL DEFAULT ARRAY[
    'buscar_contactos', 'obtener_contacto', 'crear_contacto',
    'crear_actividad', 'crear_recordatorio', 'crear_visita',
    'consultar_asistencias', 'consultar_calendario',
    'consultar_actividades', 'consultar_visitas',
    'buscar_presupuestos',
    'modificar_actividad', 'modificar_visita',
    'modificar_presupuesto', 'modificar_evento'
  ],
  whatsapp_copilot_habilitado BOOLEAN NOT NULL DEFAULT false,
  max_iteraciones_herramientas INTEGER NOT NULL DEFAULT 5,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para config_salix_ia
ALTER TABLE config_salix_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_salix_ia_empresa" ON config_salix_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Conversaciones de Salix IA (historial de chats con el copilot)
CREATE TABLE IF NOT EXISTS conversaciones_salix_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  canal TEXT NOT NULL DEFAULT 'app' CHECK (canal IN ('app', 'whatsapp')),
  titulo TEXT DEFAULT '',
  mensajes JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumen TEXT DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversaciones_salix_ia_usuario_idx
  ON conversaciones_salix_ia(empresa_id, usuario_id);

CREATE INDEX conversaciones_salix_ia_canal_idx
  ON conversaciones_salix_ia(empresa_id, canal);

-- RLS para conversaciones_salix_ia
ALTER TABLE conversaciones_salix_ia ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve sus propias conversaciones
CREATE POLICY "conversaciones_salix_ia_propio" ON conversaciones_salix_ia
  USING (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    AND usuario_id = auth.uid()
  );

-- Log de interacciones Salix IA (auditoría y métricas)
CREATE TABLE IF NOT EXISTS log_salix_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  conversacion_id UUID REFERENCES conversaciones_salix_ia(id) ON DELETE SET NULL,
  canal TEXT NOT NULL DEFAULT 'app',
  mensaje_usuario TEXT DEFAULT '',
  respuesta TEXT DEFAULT '',
  herramientas_usadas TEXT[] DEFAULT '{}',
  tokens_entrada INTEGER DEFAULT 0,
  tokens_salida INTEGER DEFAULT 0,
  latencia_ms INTEGER DEFAULT 0,
  proveedor TEXT DEFAULT 'anthropic',
  modelo TEXT DEFAULT '',
  exito BOOLEAN NOT NULL DEFAULT true,
  error TEXT DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX log_salix_ia_empresa_idx ON log_salix_ia(empresa_id);
CREATE INDEX log_salix_ia_usuario_idx ON log_salix_ia(empresa_id, usuario_id);
CREATE INDEX log_salix_ia_fecha_idx ON log_salix_ia(creado_en);

-- RLS para log
ALTER TABLE log_salix_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_salix_ia_admin" ON log_salix_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION actualizar_timestamp_salix_ia()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_config_salix_ia_updated
  BEFORE UPDATE ON config_salix_ia
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_salix_ia();

CREATE TRIGGER tr_conversaciones_salix_ia_updated
  BEFORE UPDATE ON conversaciones_salix_ia
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_salix_ia();
