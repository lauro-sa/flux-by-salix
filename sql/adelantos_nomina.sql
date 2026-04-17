-- Adelantos de nómina + cuotas
-- Cada cuota es un movimiento financiero individual, preparado para contaduría

CREATE TABLE IF NOT EXISTS adelantos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  monto_total numeric NOT NULL,
  cuotas_totales integer NOT NULL DEFAULT 1,
  cuotas_descontadas integer NOT NULL DEFAULT 0,
  saldo_pendiente numeric NOT NULL,
  frecuencia_descuento text NOT NULL,
  fecha_solicitud date NOT NULL,
  fecha_inicio_descuento date NOT NULL,
  estado text NOT NULL DEFAULT 'activo',
  notas text,
  referencia_contable text,
  creado_por uuid NOT NULL,
  creado_por_nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  editado_por uuid,
  editado_en timestamptz,
  eliminado boolean NOT NULL DEFAULT false,
  eliminado_en timestamptz,
  eliminado_por uuid
);

CREATE INDEX IF NOT EXISTS adelantos_nomina_empresa_idx ON adelantos_nomina(empresa_id);
CREATE INDEX IF NOT EXISTS adelantos_nomina_miembro_idx ON adelantos_nomina(miembro_id);
CREATE INDEX IF NOT EXISTS adelantos_nomina_estado_idx ON adelantos_nomina(empresa_id, miembro_id, estado);

ALTER TABLE adelantos_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rls_adelantos_nomina" ON adelantos_nomina
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE TABLE IF NOT EXISTS adelantos_cuotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adelanto_id uuid NOT NULL REFERENCES adelantos_nomina(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  numero_cuota integer NOT NULL,
  monto_cuota numeric NOT NULL,
  fecha_programada date NOT NULL,
  fecha_descontada date,
  pago_nomina_id uuid REFERENCES pagos_nomina(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  referencia_contable text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adelantos_cuotas_adelanto_idx ON adelantos_cuotas(adelanto_id);
CREATE INDEX IF NOT EXISTS adelantos_cuotas_empresa_idx ON adelantos_cuotas(empresa_id);
CREATE INDEX IF NOT EXISTS adelantos_cuotas_miembro_idx ON adelantos_cuotas(miembro_id);
CREATE INDEX IF NOT EXISTS adelantos_cuotas_pendientes_idx ON adelantos_cuotas(empresa_id, miembro_id, estado);
CREATE INDEX IF NOT EXISTS adelantos_cuotas_pago_idx ON adelantos_cuotas(pago_nomina_id);

ALTER TABLE adelantos_cuotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rls_adelantos_cuotas" ON adelantos_cuotas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
