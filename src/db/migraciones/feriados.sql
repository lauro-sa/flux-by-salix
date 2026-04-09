-- Migración: Tabla de feriados por empresa
-- Permite gestionar días no laborables (nacionales, puente, empresa, regionales)

CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nacional', -- 'nacional' | 'puente' | 'empresa' | 'regional'
  pais_codigo TEXT, -- ISO 3166-1 alpha-2 (null = aplica a todos)
  recurrente BOOLEAN NOT NULL DEFAULT false,
  dia_mes INTEGER, -- día del mes para recurrentes
  mes INTEGER, -- mes para recurrentes
  activo BOOLEAN NOT NULL DEFAULT true,
  origen TEXT NOT NULL DEFAULT 'manual', -- 'libreria' | 'manual' | 'importado'
  creado_por UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX feriados_empresa_fecha_idx ON feriados(empresa_id, fecha);
CREATE INDEX feriados_empresa_anio_idx ON feriados(empresa_id, activo);
CREATE UNIQUE INDEX feriados_empresa_fecha_nombre_idx ON feriados(empresa_id, fecha, nombre);

-- RLS
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feriados_tenant" ON feriados
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

CREATE POLICY "feriados_insert" ON feriados
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

CREATE POLICY "feriados_update" ON feriados
  FOR UPDATE USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

CREATE POLICY "feriados_delete" ON feriados
  FOR DELETE USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

-- Permitir al service_role acceso completo (para cron y admin)
CREATE POLICY "feriados_service_role" ON feriados
  FOR ALL TO service_role USING (true) WITH CHECK (true);
