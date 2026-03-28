-- ============================================================
-- Migración 015: Features avanzados de correo
-- Etiquetas personalizadas, envío programado, reglas automáticas
-- ============================================================

-- 1. Etiquetas de correo personalizadas por empresa
CREATE TABLE IF NOT EXISTS etiquetas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280', -- hex color
  icono text, -- nombre de icono lucide (opcional)
  orden integer DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_etiquetas_correo_nombre
  ON etiquetas_correo (empresa_id, nombre);

ALTER TABLE etiquetas_correo ENABLE ROW LEVEL SECURITY;
CREATE POLICY etiquetas_correo_rls ON etiquetas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 2. Relación muchos-a-muchos conversaciones ↔ etiquetas
CREATE TABLE IF NOT EXISTS conversacion_etiquetas (
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES etiquetas_correo(id) ON DELETE CASCADE,
  asignado_en timestamptz NOT NULL DEFAULT now(),
  asignado_por uuid REFERENCES auth.users(id),
  PRIMARY KEY (conversacion_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_etiquetas_etiqueta
  ON conversacion_etiquetas (etiqueta_id);

-- 3. Envío programado
CREATE TABLE IF NOT EXISTS correos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id uuid NOT NULL REFERENCES canales_inbox(id) ON DELETE CASCADE,
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES auth.users(id),

  -- Datos del correo
  correo_para text[] NOT NULL,
  correo_cc text[],
  correo_cco text[],
  correo_asunto text NOT NULL,
  texto text,
  html text,
  correo_in_reply_to text,
  correo_references text[],
  adjuntos_ids uuid[],

  -- Programación
  enviar_en timestamptz NOT NULL, -- cuándo enviar
  estado text NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'enviado', 'cancelado', 'error'
  enviado_en timestamptz,
  error text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correos_programados_pendientes
  ON correos_programados (enviar_en)
  WHERE estado = 'pendiente';

ALTER TABLE correos_programados ENABLE ROW LEVEL SECURITY;
CREATE POLICY correos_programados_rls ON correos_programados
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 4. Reglas automáticas de correo
CREATE TABLE IF NOT EXISTS reglas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activa boolean DEFAULT true,
  orden integer DEFAULT 0,

  -- Condiciones (todas deben cumplirse - AND)
  condiciones jsonb NOT NULL DEFAULT '[]',
  -- Formato: [{ campo: 'correo_de'|'asunto'|'texto', operador: 'contiene'|'es'|'empieza'|'termina'|'dominio', valor: 'x' }]

  -- Acciones
  acciones jsonb NOT NULL DEFAULT '[]',
  -- Formato: [{ tipo: 'etiquetar'|'asignar'|'marcar_spam'|'archivar'|'responder', valor: 'x' }]

  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reglas_correo ENABLE ROW LEVEL SECURITY;
CREATE POLICY reglas_correo_rls ON reglas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- 5. Métricas de correo (tabla materializada para performance)
CREATE TABLE IF NOT EXISTS metricas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id uuid REFERENCES canales_inbox(id) ON DELETE SET NULL,
  fecha date NOT NULL,

  -- Contadores
  correos_recibidos integer DEFAULT 0,
  correos_enviados integer DEFAULT 0,
  conversaciones_nuevas integer DEFAULT 0,
  conversaciones_resueltas integer DEFAULT 0,
  correos_spam integer DEFAULT 0,

  -- Tiempos (en minutos)
  tiempo_primera_respuesta_promedio numeric,
  tiempo_resolucion_promedio numeric,

  UNIQUE (empresa_id, canal_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_metricas_correo_fecha
  ON metricas_correo (empresa_id, fecha DESC);

ALTER TABLE metricas_correo ENABLE ROW LEVEL SECURITY;
CREATE POLICY metricas_correo_rls ON metricas_correo
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);
