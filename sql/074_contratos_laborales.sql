-- 074_contratos_laborales.sql
-- PR 2 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Crea la tabla `contratos_laborales`, núcleo del módulo. Cada empleado
-- tiene **un contrato vigente + N contratos históricos**. Al cambiar
-- salario, sector, turno o modalidad → se genera un contrato nuevo y el
-- anterior queda con `fecha_fin` y `vigente = false`. Esto:
--   - Permite reconstruir la evolución laboral (timeline en la UI).
--   - Congela los recibos pasados con su contrato (snapshot en pagos).
--   - Deja la base lista para auditoría legal y contaduría.
--
-- Separación crítica:
--   - `modalidad_calculo` = CÓMO se calcula cuánto ganó.
--   - `frecuencia_pago`   = CADA CUÁNTO se le paga.
-- Combinándolos cubrimos todos los casos reales (ej: sueldo fijo mensual
-- pagado quincenalmente → modalidad=fijo_mensual, frecuencia=quincenal,
-- el motor de cálculo prorratea).
--
-- Convenciones del repo aplicadas:
--   - empresa_id NOT NULL + RLS por empresa_id del JWT (multi-tenant).
--   - Audit columns (creado_*, actualizado_*) + trigger reusable
--     `public.actualizar_timestamp`.
--   - FK a auth.users(id) para autores (no a perfiles, igual que
--     pagos_nomina).
--   - Índice UNIQUE parcial para garantizar "solo un vigente por miembro".

CREATE TABLE contratos_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,

  -- Vigencia
  fecha_inicio date NOT NULL,
  fecha_fin date,
  vigente boolean NOT NULL DEFAULT true,

  -- Condición legal (tipo de contrato laboral)
  condicion text NOT NULL CHECK (condicion IN (
    'tiempo_indeterminado', 'plazo_fijo', 'temporal', 'pasantia', 'otro'
  )),

  -- Cálculo del haber base
  modalidad_calculo text NOT NULL CHECK (modalidad_calculo IN (
    'por_hora', 'por_dia', 'fijo_semanal', 'fijo_quincenal', 'fijo_mensual'
  )),
  monto_base numeric(14,2) NOT NULL CHECK (monto_base >= 0),
  frecuencia_pago text NOT NULL CHECK (frecuencia_pago IN (
    'diaria', 'semanal', 'quincenal', 'mensual'
  )),

  -- Asignación organizacional
  sector_id uuid REFERENCES sectores(id) ON DELETE SET NULL,
  turno_id uuid REFERENCES turnos_laborales(id) ON DELETE SET NULL,

  -- Régimen fiscal (para Fase 3 — por ahora 'informal' por default)
  regimen text NOT NULL DEFAULT 'informal' CHECK (regimen IN (
    'informal', 'monotributo', 'relacion_dependencia'
  )),

  -- Documentación
  pdf_url text,
  motivo_cambio text,
  notas text,

  -- Auditoría
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id),

  -- Un contrato cerrado debe tener fecha_fin. Inversamente, si tiene
  -- fecha_fin no debería seguir vigente. Se chequea acá para evitar
  -- estados inconsistentes desde inserts directos.
  CONSTRAINT contratos_vigencia_consistente CHECK (
    (vigente = true AND fecha_fin IS NULL) OR
    (vigente = false AND fecha_fin IS NOT NULL)
  ),
  CONSTRAINT contratos_fechas_orden CHECK (
    fecha_fin IS NULL OR fecha_fin >= fecha_inicio
  )
);

-- Solo puede haber un contrato vigente por miembro a la vez.
-- (Índice parcial UNIQUE; lo enforza la BD, no la app.)
CREATE UNIQUE INDEX idx_contrato_vigente_unico
  ON contratos_laborales (miembro_id)
  WHERE vigente = true;

-- Para queries típicas: listar contratos de un miembro ordenados por inicio,
-- o filtrar por período en reportes.
CREATE INDEX idx_contratos_empresa_miembro
  ON contratos_laborales (empresa_id, miembro_id, fecha_inicio DESC);
CREATE INDEX idx_contratos_empresa_periodo
  ON contratos_laborales (empresa_id, fecha_inicio, fecha_fin);

-- Trigger reusable para auto-tocar actualizado_en en cada UPDATE.
DROP TRIGGER IF EXISTS trg_contratos_actualizado_en ON contratos_laborales;
CREATE TRIGGER trg_contratos_actualizado_en
  BEFORE UPDATE ON contratos_laborales
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- RLS: aislar por empresa_id del JWT (misma convención que pagos_nomina,
-- asistencias, etc.).
ALTER TABLE contratos_laborales ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratos_laborales_tenant
  ON contratos_laborales
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
