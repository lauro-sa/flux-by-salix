-- Tabla para tracking de uso de storage por empresa y bucket
-- Permite implementar cuotas y monitoreo de uso de almacenamiento

CREATE TABLE IF NOT EXISTS uso_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  bytes_usados BIGINT NOT NULL DEFAULT 0,
  cantidad_archivos INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicados empresa + bucket
CREATE UNIQUE INDEX IF NOT EXISTS uso_storage_empresa_bucket_idx ON uso_storage(empresa_id, bucket);
CREATE INDEX IF NOT EXISTS uso_storage_empresa_idx ON uso_storage(empresa_id);

-- RLS: cada empresa solo ve su propio uso
ALTER TABLE uso_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso_storage_empresa" ON uso_storage
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
