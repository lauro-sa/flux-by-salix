-- 085_licencias_contrato.sql
--
-- Licencias / pausas formales de un contrato laboral. Una licencia es
-- un período en el que el empleado NO trabaja pero el vínculo laboral
-- sigue vigente. Ej: licencia médica, maternidad, suspensión
-- disciplinaria, vacaciones extendidas, examen, duelo.
--
-- Modelo:
--   - Una licencia pertenece a UN contrato (FK contrato_id).
--   - `fecha_fin` es nullable: una licencia "abierta" (sin fecha de fin
--     conocida todavía, ej. licencia médica de duración indeterminada).
--   - `goce_sueldo` decide cómo la trata el motor de cálculo:
--       - true  → los días siguen pagos (licencia médica corta, vacaciones)
--       - false → se descuentan (suspensión disciplinaria, licencia sin
--                 goce, suspensión económica)
--
-- Constraint clave: no puede haber dos licencias abiertas (sin fecha_fin)
-- para el mismo contrato. Y las licencias cerradas no se pueden
-- superponer entre sí. Esto se enforza con un EXCLUDE constraint usando
-- GiST y daterange (más confiable que un trigger).

CREATE TABLE licencias_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES contratos_laborales(id) ON DELETE CASCADE,

  -- Tipo: lista cerrada para reportes y agregados consistentes.
  -- "otro" obliga a poner una nota desde el código (la BD no lo enforza
  -- para no complicar el constraint).
  tipo text NOT NULL CHECK (tipo IN (
    'medica',
    'maternidad',
    'paternidad',
    'estudio',
    'examen',
    'duelo',
    'matrimonio',
    'mudanza',
    'vacaciones',
    'suspension_disciplinaria',
    'suspension_economica',
    'otro'
  )),

  fecha_inicio date NOT NULL,
  fecha_fin date,  -- nullable = licencia abierta (todavía en curso sin fin conocido)

  -- ¿Los días de licencia se pagan? El motor lo respeta:
  -- true  → días cuentan como trabajados para el prorrateo.
  -- false → descontados del cálculo del recibo.
  goce_sueldo boolean NOT NULL DEFAULT true,

  notas text,

  -- Auditoría estándar
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id),

  CONSTRAINT licencias_fechas_orden CHECK (
    fecha_fin IS NULL OR fecha_fin >= fecha_inicio
  )
);

-- Extensión btree_gist necesaria para el EXCLUDE con uuid + daterange.
-- Solo se crea si todavía no existe en la BD.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- No permitir superposición de licencias para el mismo contrato.
-- daterange '[)' es half-open: [inicio, fin) — para la comparación
-- contamos `fecha_fin + 1` como exclusivo. Si fecha_fin es NULL,
-- consideramos hasta el infinito (la licencia abierta).
ALTER TABLE licencias_contrato
  ADD CONSTRAINT licencias_sin_superposicion EXCLUDE USING gist (
    contrato_id WITH =,
    daterange(fecha_inicio, COALESCE(fecha_fin + 1, 'infinity'::date), '[)') WITH &&
  );

-- Índices para queries del motor (cargar licencias que solapan un período)
-- y de la UI (listar por contrato/miembro).
CREATE INDEX idx_licencias_contrato ON licencias_contrato (contrato_id, fecha_inicio);
CREATE INDEX idx_licencias_miembro_periodo
  ON licencias_contrato (empresa_id, miembro_id, fecha_inicio, fecha_fin);

-- Trigger de timestamp.
DROP TRIGGER IF EXISTS trg_licencias_actualizado_en ON licencias_contrato;
CREATE TRIGGER trg_licencias_actualizado_en
  BEFORE UPDATE ON licencias_contrato
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- RLS: aislar por empresa.
ALTER TABLE licencias_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY licencias_contrato_tenant
  ON licencias_contrato
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
