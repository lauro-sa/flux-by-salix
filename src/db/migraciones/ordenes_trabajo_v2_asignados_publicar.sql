-- Migración: Órdenes de Trabajo v2 — Múltiples asignados + Publicar
-- Agrega tabla asignados_orden_trabajo y campo publicada a ordenes_trabajo

-- ═══════════════════════════════════════════════════════════════
-- CAMPO publicada EN ordenes_trabajo
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS publicada BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ordenes_trabajo_publicada_idx ON ordenes_trabajo(empresa_id, publicada);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: asignados_orden_trabajo
-- Múltiples asignados por OT. Uno es cabecilla (controla estados).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS asignados_orden_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  usuario_nombre TEXT NOT NULL,
  es_cabecilla BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS asignados_ot_orden_usuario_idx ON asignados_orden_trabajo(orden_trabajo_id, usuario_id);
CREATE INDEX IF NOT EXISTS asignados_ot_empresa_idx ON asignados_orden_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS asignados_ot_usuario_idx ON asignados_orden_trabajo(usuario_id);
CREATE INDEX IF NOT EXISTS asignados_ot_cabecilla_idx ON asignados_orden_trabajo(orden_trabajo_id, es_cabecilla) WHERE es_cabecilla = true;

-- RLS
ALTER TABLE asignados_orden_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asignados_ot_empresa_policy" ON asignados_orden_trabajo
  FOR ALL
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
