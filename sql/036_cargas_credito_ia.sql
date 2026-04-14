-- 036: Cargas de crédito de IA por proveedor
-- Historial de recargas de saldo para cada proveedor de IA por empresa.
-- El saldo estimado = SUM(monto) - consumo calculado desde log_salix_ia.

CREATE TABLE IF NOT EXISTS cargas_credito_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proveedor TEXT NOT NULL DEFAULT 'anthropic',
  monto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  nota TEXT DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS cargas_credito_ia_empresa_idx ON cargas_credito_ia (empresa_id);
CREATE INDEX IF NOT EXISTS cargas_credito_ia_empresa_proveedor_idx ON cargas_credito_ia (empresa_id, proveedor);

-- RLS
ALTER TABLE cargas_credito_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargas_credito_ia_empresa" ON cargas_credito_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
