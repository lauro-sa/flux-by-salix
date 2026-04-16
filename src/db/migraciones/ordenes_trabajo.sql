-- Migración: Órdenes de Trabajo
-- Crea las tablas ordenes_trabajo, lineas_orden_trabajo y orden_trabajo_historial
-- Ficha operativa generada desde presupuestos confirmados (sin precios)

-- ═══════════════════════════════════════════════════════════════
-- TABLA PRINCIPAL: ordenes_trabajo
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierta',
  prioridad TEXT NOT NULL DEFAULT 'media',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  notas TEXT,

  -- Contacto operativo (snapshot sin datos fiscales)
  contacto_id UUID REFERENCES contactos(id) ON DELETE SET NULL,
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  contacto_correo TEXT,
  contacto_direccion TEXT,
  contacto_whatsapp TEXT,

  -- Vínculo con presupuesto origen
  presupuesto_id UUID REFERENCES presupuestos(id) ON DELETE SET NULL,
  presupuesto_numero TEXT,

  -- Responsable principal
  asignado_a UUID,
  asignado_nombre TEXT,

  -- Fechas operativas
  fecha_inicio TIMESTAMPTZ,
  fecha_fin_estimada TIMESTAMPTZ,
  fecha_fin_real TIMESTAMPTZ,

  -- Auditoría
  creado_por UUID NOT NULL,
  creado_por_nombre TEXT,
  editado_por UUID,
  editado_por_nombre TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft delete
  en_papelera BOOLEAN NOT NULL DEFAULT false,
  papelera_en TIMESTAMPTZ
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_trabajo_empresa_numero_idx ON ordenes_trabajo(empresa_id, numero);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_empresa_idx ON ordenes_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_contacto_idx ON ordenes_trabajo(contacto_id);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_estado_idx ON ordenes_trabajo(empresa_id, estado);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_presupuesto_idx ON ordenes_trabajo(presupuesto_id);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_asignado_idx ON ordenes_trabajo(asignado_a);
CREATE INDEX IF NOT EXISTS ordenes_trabajo_papelera_idx ON ordenes_trabajo(empresa_id, en_papelera);

-- RLS
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordenes_trabajo_empresa_policy" ON ordenes_trabajo
  FOR ALL
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══════════════════════════════════════════════════════════════
-- LÍNEAS DE ORDEN DE TRABAJO (sin precios)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lineas_orden_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  tipo_linea TEXT NOT NULL DEFAULT 'producto',
  orden INTEGER NOT NULL DEFAULT 0,

  codigo_producto TEXT,
  descripcion TEXT,
  descripcion_detalle TEXT,
  cantidad NUMERIC DEFAULT 1,
  unidad TEXT,

  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lineas_ot_orden_trabajo_idx ON lineas_orden_trabajo(orden_trabajo_id);
CREATE INDEX IF NOT EXISTS lineas_ot_empresa_idx ON lineas_orden_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS lineas_ot_orden_idx ON lineas_orden_trabajo(orden_trabajo_id, orden);

ALTER TABLE lineas_orden_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_ot_empresa_policy" ON lineas_orden_trabajo
  FOR ALL
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══════════════════════════════════════════════════════════════
-- HISTORIAL DE ESTADOS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orden_trabajo_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  estado TEXT NOT NULL,
  usuario_id UUID NOT NULL,
  usuario_nombre TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas TEXT
);

CREATE INDEX IF NOT EXISTS ot_historial_orden_trabajo_idx ON orden_trabajo_historial(orden_trabajo_id);

ALTER TABLE orden_trabajo_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_historial_empresa_policy" ON orden_trabajo_historial
  FOR ALL
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ═══════════════════════════════════════════════════════════════
-- SECUENCIA para numeración OT-0001
-- ═══════════════════════════════════════════════════════════════

INSERT INTO secuencias (empresa_id, entidad, prefijo, siguiente, digitos)
SELECT id, 'orden_trabajo', 'OT', 1, 4
FROM empresas
ON CONFLICT (empresa_id, entidad) DO NOTHING;
