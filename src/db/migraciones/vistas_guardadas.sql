-- Migración: Tabla de vistas guardadas
-- Almacena las vistas de datos (búsqueda + filtros + orden) por usuario, empresa y módulo.
-- NO almacena config visual (columnas, anchos, etc.) — eso va en preferencias_usuario.

CREATE TABLE IF NOT EXISTS vistas_guardadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  predefinida BOOLEAN NOT NULL DEFAULT false,
  estado JSONB NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS vistas_guardadas_usuario_modulo_idx
  ON vistas_guardadas (usuario_id, empresa_id, modulo);

-- RLS: cada usuario solo ve sus propias vistas
ALTER TABLE vistas_guardadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias vistas"
  ON vistas_guardadas
  FOR ALL
  USING (usuario_id = auth.uid() AND empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (usuario_id = auth.uid() AND empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
