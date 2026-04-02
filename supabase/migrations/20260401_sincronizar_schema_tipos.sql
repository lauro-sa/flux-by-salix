-- Migración: Sincronizar schema Drizzle con tipos TypeScript
-- Fecha: 2026-04-01
-- Agrega campos faltantes en: empresas, perfiles, miembros

-- === EMPRESAS: agregar actualizado_en ===
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz DEFAULT now() NOT NULL;

-- === PERFILES: agregar campos personales y laborales ===
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS correo_empresa text,
  ADD COLUMN IF NOT EXISTS telefono_empresa text,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS documento_numero text,
  ADD COLUMN IF NOT EXISTS domicilio text,
  ADD COLUMN IF NOT EXISTS direccion jsonb;

-- === MIEMBROS: agregar campos laborales, horario, kiosco ===
ALTER TABLE miembros
  ADD COLUMN IF NOT EXISTS numero_empleado integer,
  ADD COLUMN IF NOT EXISTS puesto_id uuid,
  ADD COLUMN IF NOT EXISTS puesto_nombre text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS horario_tipo text,
  ADD COLUMN IF NOT EXISTS horario_flexible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metodo_fichaje text,
  ADD COLUMN IF NOT EXISTS salix_ia_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kiosco_rfid text,
  ADD COLUMN IF NOT EXISTS kiosco_pin text,
  ADD COLUMN IF NOT EXISTS foto_kiosco_url text;

-- Trigger para actualizar automáticamente actualizado_en en empresas
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'empresas_actualizar_timestamp'
  ) THEN
    CREATE TRIGGER empresas_actualizar_timestamp
      BEFORE UPDATE ON empresas
      FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
  END IF;
END $$;
