-- ═══════════════════════════════════════════════════════════════
-- Migración: Módulo de Calendario completo
-- Fecha: 2026-04-08
-- Incluye: tipos_evento_calendario, config_calendario,
--          eventos_calendario con RLS, seed de tipos predefinidos
-- ═══════════════════════════════════════════════════════════════

-- 1. Tipos de evento de calendario (configurables por empresa)
CREATE TABLE IF NOT EXISTS tipos_evento_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  clave text NOT NULL,
  etiqueta text NOT NULL,
  icono text NOT NULL DEFAULT 'Calendar',
  color text NOT NULL DEFAULT '#3B82F6',
  duracion_default integer NOT NULL DEFAULT 60,
  todo_el_dia_default boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  es_predefinido boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tipos_evento_cal_empresa_clave_idx
  ON tipos_evento_calendario(empresa_id, clave);
CREATE INDEX IF NOT EXISTS tipos_evento_cal_empresa_idx
  ON tipos_evento_calendario(empresa_id);

-- RLS
ALTER TABLE tipos_evento_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY tipos_evento_cal_empresa_policy ON tipos_evento_calendario
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 2. Configuración del calendario por empresa
CREATE TABLE IF NOT EXISTS config_calendario (
  empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  hora_inicio_laboral time NOT NULL DEFAULT '08:00',
  hora_fin_laboral time NOT NULL DEFAULT '18:00',
  dias_laborales integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  intervalo_slot integer NOT NULL DEFAULT 30,
  vista_default text NOT NULL DEFAULT 'semana',
  mostrar_fines_semana boolean NOT NULL DEFAULT true,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE config_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_calendario_empresa_policy ON config_calendario
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 3. Eventos de calendario
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Contenido
  titulo text NOT NULL,
  descripcion text,
  ubicacion text,

  -- Tipo
  tipo_id uuid REFERENCES tipos_evento_calendario(id),
  tipo_clave text,
  color text,

  -- Temporalidad
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  todo_el_dia boolean NOT NULL DEFAULT false,

  -- Recurrencia
  recurrencia jsonb,
  evento_padre_id uuid REFERENCES eventos_calendario(id) ON DELETE CASCADE,
  es_excepcion boolean NOT NULL DEFAULT false,
  fecha_excepcion timestamptz,

  -- Asignación múltiple
  creado_por uuid NOT NULL,
  creado_por_nombre text,
  asignados jsonb NOT NULL DEFAULT '[]',
  asignado_ids text[] NOT NULL DEFAULT '{}',

  -- Visibilidad
  visibilidad text NOT NULL DEFAULT 'publica',

  -- Vinculaciones polimórficas
  vinculos jsonb NOT NULL DEFAULT '[]',
  vinculo_ids text[] NOT NULL DEFAULT '{}',

  -- Actividad vinculada (relación directa)
  actividad_id uuid,

  -- Estado
  estado text NOT NULL DEFAULT 'confirmado',

  -- Notas
  notas text,

  -- Auditoría
  editado_por uuid,
  editado_por_nombre text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  en_papelera boolean NOT NULL DEFAULT false,
  papelera_en timestamptz,

  -- Validación
  CONSTRAINT eventos_calendario_fechas_check CHECK (fecha_fin >= fecha_inicio)
);

-- Índices
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_rango_idx
  ON eventos_calendario(empresa_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_creador_idx
  ON eventos_calendario(empresa_id, creado_por);
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_tipo_idx
  ON eventos_calendario(empresa_id, tipo_clave);
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_actividad_idx
  ON eventos_calendario(empresa_id, actividad_id);
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_padre_idx
  ON eventos_calendario(empresa_id, evento_padre_id);
CREATE INDEX IF NOT EXISTS eventos_cal_empresa_papelera_idx
  ON eventos_calendario(empresa_id, en_papelera);
CREATE INDEX IF NOT EXISTS eventos_cal_asignados_idx
  ON eventos_calendario USING GIN (asignado_ids);
CREATE INDEX IF NOT EXISTS eventos_cal_vinculos_idx
  ON eventos_calendario USING GIN (vinculo_ids);

-- RLS
ALTER TABLE eventos_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_calendario_empresa_policy ON eventos_calendario
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- 4. Seed: tipos predefinidos para empresas existentes
-- (Se insertan vía la API al activar el módulo o con un trigger)
-- Función para insertar tipos predefinidos de calendario
CREATE OR REPLACE FUNCTION seed_tipos_evento_calendario(p_empresa_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO tipos_evento_calendario (empresa_id, clave, etiqueta, icono, color, duracion_default, todo_el_dia_default, es_predefinido, orden)
  VALUES
    (p_empresa_id, 'reunion',      'Reunión',            'Users',   '#3B82F6', 60,  false, true, 0),
    (p_empresa_id, 'llamada',      'Llamada',            'Phone',   '#10B981', 30,  false, true, 1),
    (p_empresa_id, 'tarea',        'Bloque de trabajo',  'Wrench',  '#F59E0B', 120, false, true, 2),
    (p_empresa_id, 'bloqueo',      'Bloqueo de tiempo',  'Clock',   '#6B7280', 60,  false, true, 3),
    (p_empresa_id, 'recordatorio', 'Recordatorio',       'Bell',    '#EF4444', 15,  false, true, 4)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Seed para todas las empresas existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM empresas LOOP
    PERFORM seed_tipos_evento_calendario(r.id);
  END LOOP;
END;
$$;

-- Seed config_calendario para empresas existentes
INSERT INTO config_calendario (empresa_id)
SELECT id FROM empresas
ON CONFLICT DO NOTHING;
