-- ═══════════════════════════════════════════════════════════════
-- Migración: Módulo de Asistencias completo
-- Fecha: 2026-04-06
-- Incluye: turnos laborales, asistencias expandida, fichajes actividad,
--          solicitudes, terminales kiosco, config, auditoría,
--          campos nuevos en miembros y sectores
-- ═══════════════════════════════════════════════════════════════

-- 1. Campos nuevos en miembros
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS turno_id uuid;
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

-- 2. Campo nuevo en sectores
ALTER TABLE sectores ADD COLUMN IF NOT EXISTS turno_id uuid;

-- 3. Turnos laborales
CREATE TABLE IF NOT EXISTS turnos_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  es_default boolean NOT NULL DEFAULT false,
  flexible boolean NOT NULL DEFAULT false,
  tolerancia_min integer NOT NULL DEFAULT 10,
  dias jsonb NOT NULL DEFAULT '{"lunes":{"activo":true,"desde":"09:00","hasta":"18:00"},"martes":{"activo":true,"desde":"09:00","hasta":"18:00"},"miercoles":{"activo":true,"desde":"09:00","hasta":"18:00"},"jueves":{"activo":true,"desde":"09:00","hasta":"18:00"},"viernes":{"activo":true,"desde":"09:00","hasta":"18:00"},"sabado":{"activo":false,"desde":"09:00","hasta":"13:00"},"domingo":{"activo":false,"desde":"09:00","hasta":"13:00"}}',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS turnos_laborales_empresa_idx ON turnos_laborales(empresa_id);
CREATE INDEX IF NOT EXISTS turnos_laborales_default_idx ON turnos_laborales(empresa_id, es_default);

-- 4. Expandir tabla asistencias (agregar columnas nuevas a la existente)
-- Nuevos timestamps de jornada
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS inicio_almuerzo timestamptz;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS fin_almuerzo timestamptz;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS salida_particular timestamptz;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS vuelta_particular timestamptz;

-- Cambiar default de estado de 'presente' a 'activo'
ALTER TABLE asistencias ALTER COLUMN estado SET DEFAULT 'activo';

-- Clasificación
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'normal';
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS puntualidad_min integer;

-- Método de registro
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS metodo_registro text NOT NULL DEFAULT 'manual';
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS terminal_id uuid;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS terminal_nombre text;

-- Fotos silenciosas
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS foto_entrada text;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS foto_salida text;

-- Turno laboral aplicado
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS turno_id uuid;

-- Auditoría
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS cierre_automatico boolean NOT NULL DEFAULT false;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS creado_por uuid;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS editado_por uuid;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS solicitud_id uuid;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

-- Índices nuevos para asistencias
CREATE UNIQUE INDEX IF NOT EXISTS asistencias_miembro_fecha_idx ON asistencias(empresa_id, miembro_id, fecha);
CREATE INDEX IF NOT EXISTS asistencias_estado_entrada_idx ON asistencias(empresa_id, estado, hora_entrada);
CREATE INDEX IF NOT EXISTS asistencias_fecha_empresa_idx ON asistencias(empresa_id, fecha);

-- 5. Fichajes de actividad (heartbeats)
CREATE TABLE IF NOT EXISTS fichajes_actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  timestamp timestamptz NOT NULL,
  tipo text NOT NULL,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS fichajes_actividad_miembro_fecha_idx ON fichajes_actividad(empresa_id, miembro_id, fecha);
CREATE INDEX IF NOT EXISTS fichajes_actividad_timestamp_idx ON fichajes_actividad(empresa_id, miembro_id, timestamp);

-- 6. Solicitudes de fichaje (reclamos)
CREATE TABLE IF NOT EXISTS solicitudes_fichaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_entrada text,
  hora_salida text,
  motivo text NOT NULL,
  terminal_nombre text,
  estado text NOT NULL DEFAULT 'pendiente',
  resuelto_por uuid,
  resuelto_en timestamptz,
  notas_resolucion text,
  solicitud_original_id uuid,
  es_apelacion boolean NOT NULL DEFAULT false,
  motivo_apelacion text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitudes_fichaje_solicitante_idx ON solicitudes_fichaje(empresa_id, solicitante_id, fecha);
CREATE INDEX IF NOT EXISTS solicitudes_fichaje_estado_idx ON solicitudes_fichaje(empresa_id, estado);

-- 7. Terminales de kiosco
CREATE TABLE IF NOT EXISTS terminales_kiosco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  ultimo_ping timestamptz,
  token_hash text,
  creado_por uuid,
  revocado_por uuid,
  revocado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS terminales_kiosco_empresa_idx ON terminales_kiosco(empresa_id);
CREATE INDEX IF NOT EXISTS terminales_kiosco_activo_idx ON terminales_kiosco(empresa_id, activo);

-- 8. Configuración de asistencias (una por empresa)
CREATE TABLE IF NOT EXISTS config_asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  -- Kiosco
  kiosco_habilitado boolean NOT NULL DEFAULT false,
  kiosco_metodo_lectura text NOT NULL DEFAULT 'rfid_hid',
  kiosco_pin_admin text,
  kiosco_capturar_foto boolean NOT NULL DEFAULT false,
  kiosco_modo_empresa text NOT NULL DEFAULT 'logo_y_nombre',
  -- Auto-checkout
  auto_checkout_habilitado boolean NOT NULL DEFAULT true,
  auto_checkout_max_horas integer NOT NULL DEFAULT 12,
  -- Cálculo de horas
  descontar_almuerzo boolean NOT NULL DEFAULT true,
  duracion_almuerzo_min integer NOT NULL DEFAULT 60,
  horas_minimas_diarias numeric(4,2) NOT NULL DEFAULT 0,
  horas_maximas_diarias numeric(4,2) NOT NULL DEFAULT 0,
  -- Fichaje automático
  fichaje_auto_habilitado boolean NOT NULL DEFAULT false,
  fichaje_auto_notif_min integer NOT NULL DEFAULT 10,
  fichaje_auto_umbral_salida integer NOT NULL DEFAULT 30,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS config_asistencias_empresa_idx ON config_asistencias(empresa_id);

-- 9. Auditoría de asistencias (ediciones manuales)
CREATE TABLE IF NOT EXISTS auditoria_asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  asistencia_id uuid NOT NULL,
  editado_por uuid NOT NULL,
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_asistencias_asistencia_idx ON auditoria_asistencias(asistencia_id);
CREATE INDEX IF NOT EXISTS auditoria_asistencias_empresa_idx ON auditoria_asistencias(empresa_id);

-- 10. RLS para todas las tablas nuevas
ALTER TABLE turnos_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes_actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_fichaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminales_kiosco ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_asistencias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS multi-tenant
CREATE POLICY "empresa_turnos_laborales" ON turnos_laborales
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY "empresa_fichajes_actividad" ON fichajes_actividad
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY "empresa_solicitudes_fichaje" ON solicitudes_fichaje
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY "empresa_terminales_kiosco" ON terminales_kiosco
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY "empresa_config_asistencias" ON config_asistencias
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY "empresa_auditoria_asistencias" ON auditoria_asistencias
  FOR ALL USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
