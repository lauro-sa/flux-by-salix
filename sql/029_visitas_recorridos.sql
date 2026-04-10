-- ═══════════════════════════════════════════════════════════════
-- Migración 029: Sistema de Visitas y Recorridos
-- Tablas: visitas, recorridos, recorrido_paradas, plantillas_recorrido, config_visitas
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de visitas
CREATE TABLE IF NOT EXISTS visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Relaciones
  contacto_id uuid NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  contacto_nombre text NOT NULL,
  direccion_id uuid REFERENCES contacto_direcciones(id) ON DELETE SET NULL,
  direccion_texto text,
  direccion_lat double precision,
  direccion_lng double precision,

  -- Asignación
  asignado_a uuid,
  asignado_nombre text,

  -- Programación
  fecha_programada timestamptz NOT NULL,
  fecha_inicio timestamptz,
  fecha_llegada timestamptz,
  fecha_completada timestamptz,
  duracion_estimada_min integer DEFAULT 30,
  duracion_real_min integer,

  -- Estado: programada, en_camino, en_sitio, completada, cancelada, reprogramada
  estado text NOT NULL DEFAULT 'programada',

  -- Contenido
  motivo text,
  resultado text,
  notas text,
  prioridad text NOT NULL DEFAULT 'normal',

  -- Checklist configurable
  checklist jsonb NOT NULL DEFAULT '[]',

  -- Geolocalización de registro
  registro_lat double precision,
  registro_lng double precision,
  registro_precision_m integer,

  -- Vinculación
  actividad_id uuid,
  vinculos jsonb NOT NULL DEFAULT '[]',

  -- Soft delete
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices de visitas
CREATE INDEX IF NOT EXISTS visitas_empresa_idx ON visitas(empresa_id);
CREATE INDEX IF NOT EXISTS visitas_contacto_idx ON visitas(empresa_id, contacto_id);
CREATE INDEX IF NOT EXISTS visitas_asignado_idx ON visitas(empresa_id, asignado_a);
CREATE INDEX IF NOT EXISTS visitas_estado_idx ON visitas(empresa_id, estado);
CREATE INDEX IF NOT EXISTS visitas_fecha_idx ON visitas(empresa_id, fecha_programada);
CREATE INDEX IF NOT EXISTS visitas_papelera_idx ON visitas(empresa_id, en_papelera);

-- RLS para visitas
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visitas_empresa_policy ON visitas;
CREATE POLICY visitas_empresa_policy ON visitas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 2. Tabla de recorridos
CREATE TABLE IF NOT EXISTS recorridos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Asignación
  asignado_a uuid NOT NULL,
  asignado_nombre text NOT NULL,

  -- Fecha
  fecha date NOT NULL,

  -- Estado: pendiente, en_curso, completado
  estado text NOT NULL DEFAULT 'pendiente',

  -- Punto de partida
  origen_lat double precision,
  origen_lng double precision,
  origen_texto text,

  -- Resumen
  total_visitas integer NOT NULL DEFAULT 0,
  visitas_completadas integer NOT NULL DEFAULT 0,
  distancia_total_km numeric,
  duracion_total_min integer,

  -- Notas
  notas text,

  -- Auditoría
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices de recorridos
CREATE INDEX IF NOT EXISTS recorridos_empresa_idx ON recorridos(empresa_id);
CREATE INDEX IF NOT EXISTS recorridos_asignado_fecha_idx ON recorridos(empresa_id, asignado_a, fecha);
CREATE UNIQUE INDEX IF NOT EXISTS recorridos_unico_idx ON recorridos(empresa_id, asignado_a, fecha);

-- RLS para recorridos
ALTER TABLE recorridos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recorridos_empresa_policy ON recorridos;
CREATE POLICY recorridos_empresa_policy ON recorridos
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 3. Tabla de paradas del recorrido
CREATE TABLE IF NOT EXISTS recorrido_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorrido_id uuid NOT NULL REFERENCES recorridos(id) ON DELETE CASCADE,
  visita_id uuid NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,

  -- Orden
  orden integer NOT NULL DEFAULT 0,

  -- Estimaciones de ruta
  distancia_km numeric,
  duracion_viaje_min integer,
  hora_estimada_llegada timestamptz,

  -- Notas
  notas text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices de paradas
CREATE INDEX IF NOT EXISTS recorrido_paradas_recorrido_idx ON recorrido_paradas(recorrido_id);
CREATE UNIQUE INDEX IF NOT EXISTS recorrido_paradas_unico_idx ON recorrido_paradas(recorrido_id, visita_id);

-- RLS para paradas (hereda del recorrido via JOIN, pero aplicamos RLS directo también)
ALTER TABLE recorrido_paradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recorrido_paradas_policy ON recorrido_paradas;
CREATE POLICY recorrido_paradas_policy ON recorrido_paradas
  USING (
    EXISTS (
      SELECT 1 FROM recorridos r
      WHERE r.id = recorrido_paradas.recorrido_id
      AND r.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    )
  );

-- 4. Plantillas de recorrido
CREATE TABLE IF NOT EXISTS plantillas_recorrido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  paradas jsonb NOT NULL DEFAULT '[]',
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plantillas_recorrido_empresa_idx ON plantillas_recorrido(empresa_id);

ALTER TABLE plantillas_recorrido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plantillas_recorrido_policy ON plantillas_recorrido;
CREATE POLICY plantillas_recorrido_policy ON plantillas_recorrido
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 5. Configuración del módulo visitas por empresa
CREATE TABLE IF NOT EXISTS config_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  checklist_predeterminado jsonb NOT NULL DEFAULT '[]',
  requiere_geolocalizacion boolean NOT NULL DEFAULT false,
  distancia_maxima_m integer NOT NULL DEFAULT 500,
  duracion_estimada_default integer NOT NULL DEFAULT 30,
  motivos_predefinidos jsonb NOT NULL DEFAULT '[]',
  resultados_predefinidos jsonb NOT NULL DEFAULT '[]',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS config_visitas_empresa_idx ON config_visitas(empresa_id);

ALTER TABLE config_visitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_visitas_policy ON config_visitas;
CREATE POLICY config_visitas_policy ON config_visitas
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 6. Actualizar catálogo de módulos — agregar dependencias
UPDATE catalogo_modulos SET requiere = ARRAY['contactos'] WHERE slug = 'visitas';
UPDATE catalogo_modulos SET requiere = ARRAY['visitas'] WHERE slug = 'recorrido';

-- 7. Trigger para actualizar actualizado_en automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp_visitas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER visitas_actualizar_timestamp
  BEFORE UPDATE ON visitas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_visitas();

CREATE TRIGGER recorridos_actualizar_timestamp
  BEFORE UPDATE ON recorridos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_visitas();

CREATE TRIGGER config_visitas_actualizar_timestamp
  BEFORE UPDATE ON config_visitas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_visitas();

CREATE TRIGGER plantillas_recorrido_actualizar_timestamp
  BEFORE UPDATE ON plantillas_recorrido
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp_visitas();
