-- Migración: tablas de auditoría para contactos, productos, actividades y presupuestos
-- Misma estructura que auditoria_asistencias: campo_modificado, valor anterior/nuevo, motivo

-- ═══ Auditoría de contactos ═══
CREATE TABLE IF NOT EXISTS auditoria_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_contactos_contacto_idx ON auditoria_contactos(contacto_id);
CREATE INDEX IF NOT EXISTS auditoria_contactos_empresa_idx ON auditoria_contactos(empresa_id);

ALTER TABLE auditoria_contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_contactos_empresa" ON auditoria_contactos
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══ Auditoría de productos ═══
CREATE TABLE IF NOT EXISTS auditoria_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_productos_producto_idx ON auditoria_productos(producto_id);
CREATE INDEX IF NOT EXISTS auditoria_productos_empresa_idx ON auditoria_productos(empresa_id);

ALTER TABLE auditoria_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_productos_empresa" ON auditoria_productos
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══ Auditoría de actividades ═══
CREATE TABLE IF NOT EXISTS auditoria_actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  actividad_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_actividades_actividad_idx ON auditoria_actividades(actividad_id);
CREATE INDEX IF NOT EXISTS auditoria_actividades_empresa_idx ON auditoria_actividades(empresa_id);

ALTER TABLE auditoria_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_actividades_empresa" ON auditoria_actividades
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══ Auditoría de presupuestos ═══
CREATE TABLE IF NOT EXISTS auditoria_presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  presupuesto_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_presupuestos_presupuesto_idx ON auditoria_presupuestos(presupuesto_id);
CREATE INDEX IF NOT EXISTS auditoria_presupuestos_empresa_idx ON auditoria_presupuestos(empresa_id);

ALTER TABLE auditoria_presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_presupuestos_empresa" ON auditoria_presupuestos
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
