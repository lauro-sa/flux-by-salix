-- 079_sectores_definicion.sql
-- PR 3 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- La tabla `sectores` existe en flux-dev/flux-prod desde antes del
-- módulo Nóminas: se creó vía Studio sin trackear migración en este
-- repo. Esta migración documenta el esquema canónico (con IF NOT
-- EXISTS para que sea segura sobre BDs donde la tabla ya está) para
-- que un dev nuevo pueda reproducir el estado desde cero ejecutando
-- los archivos de `sql/` en orden.
--
-- Estructura:
--   - Tabla jerárquica (padre_id self-FK) con jefe opcional.
--   - Color e ícono visibles en la UI de Estructura organizacional.
--   - turno_id opcional para sugerir turno default al asignar
--     miembros al sector (consumido por configuración de asistencias).
--
-- RLS y FKs:
--   - Multi-tenant por `empresa_id` (JWT).
--   - `padre_id` y `jefe_id` → ON DELETE SET NULL para no romper
--     subárboles si el padre/jefe se borra.
--   - `turno_id` NO tiene FK actualmente (tech debt pre-existente
--     anterior a nóminas). Documentado para revisar fuera de este PR.
--
-- Idempotente: no ejecuta nada si la tabla ya está.

CREATE TABLE IF NOT EXISTS sectores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  icono text NOT NULL DEFAULT 'Building',
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,

  -- Jerarquía: un sector puede tener un sector padre (árbol).
  padre_id uuid REFERENCES sectores(id) ON DELETE SET NULL,
  -- Líder del sector (miembro con cuenta en auth.users).
  jefe_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Turno default sugerido al asignar miembros a este sector. Sin FK
  -- explícita por consistencia con el estado actual (ver nota arriba).
  turno_id uuid,

  -- Marca de sector que viene en el seed inicial (no se debe borrar
  -- con facilidad; lo respeta la UI).
  es_predefinido boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices: filtros típicos del listado de Estructura.
CREATE INDEX IF NOT EXISTS sectores_empresa_idx
  ON sectores (empresa_id);
CREATE INDEX IF NOT EXISTS sectores_padre_idx
  ON sectores (padre_id);

-- RLS multi-tenant. Convención canónica del repo: `auth.jwt() ->>
-- 'empresa_id'`. (Existen también dos policies legacy en flux-dev que
-- usan `app_metadata.empresa_activa_id` — quedan pendientes de
-- limpieza fuera del scope del módulo Nóminas.)
ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sectores'
      AND policyname='rls_sectores_empresa'
  ) THEN
    CREATE POLICY rls_sectores_empresa
      ON sectores
      USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
  END IF;
END $$;
