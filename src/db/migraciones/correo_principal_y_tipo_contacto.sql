-- Migración: Correo principal + reglas por tipo de contacto
-- Permite marcar una bandeja como principal y asignar bandejas por tipo de contacto

-- 1. Campo es_principal en canales_inbox
ALTER TABLE canales_inbox ADD COLUMN IF NOT EXISTS es_principal boolean NOT NULL DEFAULT false;

-- Marcar el primer canal de correo activo de cada empresa como principal
WITH primeros AS (
  SELECT DISTINCT ON (empresa_id) id
  FROM canales_inbox
  WHERE tipo = 'correo' AND activo = true
  ORDER BY empresa_id, creado_en ASC
)
UPDATE canales_inbox SET es_principal = true WHERE id IN (SELECT id FROM primeros);

-- 2. Tabla correo_por_tipo_contacto
CREATE TABLE IF NOT EXISTS correo_por_tipo_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_contacto_id uuid NOT NULL REFERENCES tipos_contacto(id) ON DELETE CASCADE,
  canal_id uuid NOT NULL REFERENCES canales_inbox(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, tipo_contacto_id)
);

CREATE INDEX IF NOT EXISTS correo_por_tipo_contacto_empresa_idx
  ON correo_por_tipo_contacto(empresa_id);

-- RLS
ALTER TABLE correo_por_tipo_contacto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "correo_por_tipo_contacto_empresa" ON correo_por_tipo_contacto
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
