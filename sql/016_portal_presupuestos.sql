-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  016 — Portal público de presupuestos                          ║
-- ║  Tokens de acceso para que clientes vean presupuestos sin auth ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Tabla de tokens de acceso público
CREATE TABLE IF NOT EXISTS portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  visto_en timestamptz,
  veces_visto integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true
);

-- Índices
CREATE INDEX IF NOT EXISTS portal_tokens_token_idx ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS portal_tokens_presupuesto_idx ON portal_tokens(presupuesto_id);
CREATE INDEX IF NOT EXISTS portal_tokens_empresa_idx ON portal_tokens(empresa_id);

-- Agregar campo descripcion a empresas si no existe
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS descripcion text;
