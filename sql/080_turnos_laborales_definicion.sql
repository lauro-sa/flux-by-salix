-- 080_turnos_laborales_definicion.sql
-- PR 3 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Igual que sectores (ver 079), la tabla `turnos_laborales` existe
-- desde antes del módulo Nóminas sin migración explícita en `sql/`.
-- Este archivo documenta el esquema canónico para que el repo sea
-- reproducible. Idempotente con IF NOT EXISTS.
--
-- Estructura:
--   - Cada turno es una plantilla por empresa: nombre + horarios por
--     día de la semana (JSONB).
--   - `flexible` + `tolerancia_min` permiten configurar fichaje
--     tolerante al inicio/cierre del turno.
--   - `es_default` marca el turno que se sugiere al crear un miembro
--     o un sector nuevo. La app garantiza unicidad por empresa al
--     marcar uno (no hay UNIQUE en BD; es lógica de aplicación
--     en /api/asistencias/turnos).
--
-- Forma esperada de `dias` (JSONB):
--   {
--     "lunes":     { "activo": true,  "desde": "09:00", "hasta": "18:00" },
--     "martes":    { "activo": true,  "desde": "09:00", "hasta": "18:00" },
--     ...
--     "domingo":   { "activo": false, "desde": "09:00", "hasta": "13:00" }
--   }
--
-- API existente: /api/asistencias/turnos/route.ts (GET + POST CRUD
-- completo + acción de reordenar en lote).

CREATE TABLE IF NOT EXISTS turnos_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nombre text NOT NULL,
  es_default boolean NOT NULL DEFAULT false,
  flexible boolean NOT NULL DEFAULT false,
  tolerancia_min integer NOT NULL DEFAULT 10,

  -- Horario por día de la semana (ver forma en cabecera).
  dias jsonb NOT NULL DEFAULT jsonb_build_object(
    'lunes',     jsonb_build_object('activo', true,  'desde', '09:00', 'hasta', '18:00'),
    'martes',    jsonb_build_object('activo', true,  'desde', '09:00', 'hasta', '18:00'),
    'miercoles', jsonb_build_object('activo', true,  'desde', '09:00', 'hasta', '18:00'),
    'jueves',    jsonb_build_object('activo', true,  'desde', '09:00', 'hasta', '18:00'),
    'viernes',   jsonb_build_object('activo', true,  'desde', '09:00', 'hasta', '18:00'),
    'sabado',    jsonb_build_object('activo', false, 'desde', '09:00', 'hasta', '13:00'),
    'domingo',   jsonb_build_object('activo', false, 'desde', '09:00', 'hasta', '13:00')
  ),

  orden integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices: filtros típicos.
CREATE INDEX IF NOT EXISTS turnos_laborales_empresa_idx
  ON turnos_laborales (empresa_id);
CREATE INDEX IF NOT EXISTS turnos_laborales_orden_idx
  ON turnos_laborales (empresa_id, orden);
CREATE INDEX IF NOT EXISTS turnos_laborales_default_idx
  ON turnos_laborales (empresa_id, es_default);

-- Trigger reusable para auto-tocar actualizado_en en cada UPDATE.
DROP TRIGGER IF EXISTS trg_turnos_actualizado_en ON turnos_laborales;
CREATE TRIGGER trg_turnos_actualizado_en
  BEFORE UPDATE ON turnos_laborales
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- RLS multi-tenant estándar.
ALTER TABLE turnos_laborales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='turnos_laborales'
      AND policyname='empresa_turnos_laborales'
  ) THEN
    CREATE POLICY empresa_turnos_laborales
      ON turnos_laborales
      USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
  END IF;
END $$;
