-- ═══════════════════════════════════════════════════════════════
-- NOTAS RÁPIDAS — Sistema de notas personales y compartidas
-- Botón flotante con acceso rápido, pestañas, dictado, compartir
-- ═══════════════════════════════════════════════════════════════

-- Notas rápidas — cada nota pertenece a un creador dentro de una empresa
CREATE TABLE IF NOT EXISTS notas_rapidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  creador_id UUID NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  contenido TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'amarillo',
  fijada BOOLEAN NOT NULL DEFAULT false,
  archivada BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID
);

CREATE INDEX notas_rapidas_empresa_creador_idx
  ON notas_rapidas(empresa_id, creador_id);

CREATE INDEX notas_rapidas_empresa_idx
  ON notas_rapidas(empresa_id);

-- RLS: solo ver notas de tu empresa (propias o compartidas contigo)
ALTER TABLE notas_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_rapidas_empresa" ON notas_rapidas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Compartidos — relación nota↔usuario con permisos y tracking de lectura
CREATE TABLE IF NOT EXISTS notas_rapidas_compartidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES notas_rapidas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  puede_editar BOOLEAN NOT NULL DEFAULT true,
  leido_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notas_compartidas_nota_usuario_idx
  ON notas_rapidas_compartidas(nota_id, usuario_id);

CREATE INDEX notas_compartidas_usuario_idx
  ON notas_rapidas_compartidas(usuario_id);

-- RLS: acceso via la nota padre (que ya filtra por empresa_id)
ALTER TABLE notas_rapidas_compartidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_compartidas_acceso" ON notas_rapidas_compartidas
  USING (
    nota_id IN (
      SELECT id FROM notas_rapidas
      WHERE empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- Agregar herramientas de notas a config_salix_ia existente
UPDATE config_salix_ia
SET herramientas_habilitadas = array_cat(
  herramientas_habilitadas,
  ARRAY['anotar_nota', 'consultar_notas']
)
WHERE NOT ('anotar_nota' = ANY(herramientas_habilitadas));

-- Actualizar default de herramientas en config_salix_ia
ALTER TABLE config_salix_ia
  ALTER COLUMN herramientas_habilitadas SET DEFAULT ARRAY[
    'buscar_contactos', 'obtener_contacto', 'crear_contacto',
    'crear_actividad', 'crear_recordatorio', 'crear_visita',
    'consultar_asistencias', 'consultar_calendario',
    'consultar_actividades', 'consultar_visitas',
    'buscar_presupuestos',
    'modificar_actividad', 'modificar_visita',
    'modificar_presupuesto', 'modificar_evento',
    'anotar_nota', 'consultar_notas'
  ];
