-- Catálogo de bancos por empresa
-- Permite que cada empresa gestione su propia lista de bancos reutilizables

CREATE TABLE IF NOT EXISTS bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bancos_empresa_idx ON bancos(empresa_id);

-- Evitar duplicados por empresa (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS bancos_empresa_nombre_unique ON bancos(empresa_id, lower(nombre));

-- RLS
ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bancos_empresa" ON bancos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
