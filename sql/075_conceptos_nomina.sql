-- 075_conceptos_nomina.sql
-- PR 2 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Modelo de conceptos de nómina (premios, presentismo, antigüedad,
-- descuentos, etc.). Tres tablas en una migración porque viven juntas:
--
--   1. `conceptos_nomina` — Catálogo por empresa. "Presentismo 10%",
--      "Descuento uniforme", etc. Configurable desde Config Nóminas.
--
--   2. `conceptos_contrato` — N:M entre contratos y conceptos:
--      qué conceptos aplican a qué contrato (con valor_override
--      opcional si este empleado tiene un valor distinto al catálogo).
--
--   3. `conceptos_aplicados_pago` — Snapshot de los conceptos que
--      efectivamente entraron a un recibo concreto. Aunque después se
--      borre el concepto del catálogo, el recibo histórico mantiene
--      `nombre_snapshot` y `monto` intactos.
--
-- Diseño guiado por:
--   - Permitir conceptos automáticos (motor PR 7 evalúa
--     condicion_jsonb) y conceptos manuales (sugerencias para sumar a
--     mano en el editor del recibo).
--   - Snapshot inmutable en recibos pagados (historia no se reescribe).

-- ════════════════════════════════════════════════════════════════
-- 1. Catálogo de conceptos
-- ════════════════════════════════════════════════════════════════
CREATE TABLE conceptos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Identidad
  nombre text NOT NULL,
  descripcion text,
  icono text NOT NULL DEFAULT 'star',
  color text NOT NULL DEFAULT '#6b7280',

  -- Clasificación
  tipo text NOT NULL CHECK (tipo IN ('haber', 'descuento')),
  categoria text CHECK (categoria IN (
    'presentismo', 'premio', 'bono', 'antiguedad', 'adicional',
    'descuento_uniforme', 'descuento_otro', 'otro'
  )),

  -- Cálculo
  modo_calculo text NOT NULL CHECK (modo_calculo IN (
    'monto_fijo', 'porcentaje_basico', 'por_dia', 'por_evento', 'manual'
  )),
  -- numérico abierto: monto en pesos, porcentaje (0-100), valor por día, etc.
  -- Se interpreta según `modo_calculo`. NULL si modo_calculo='manual'.
  valor numeric(14,4),

  -- Comportamiento. `automatico=true` significa que el motor lo aplica
  -- al evaluar el recibo (consulta `condicion_jsonb`); false = sugerencia
  -- para que el usuario lo agregue manualmente.
  automatico boolean NOT NULL DEFAULT true,
  -- Condición a evaluar (estructura abierta para extender en PR 6/7).
  -- Ejemplos: {"tipo":"sin_ausencias"}, {"tipo":"antiguedad_minima","meses":12}
  condicion_jsonb jsonb,

  -- Recurrencia: true = aplica en cada recibo donde se cumpla la
  -- condición; false = aplicación de única vez (la app marca cuándo
  -- se consumió). El motor del recibo respeta esto en PR 7.
  recurrente boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 0,

  -- Auditoría
  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id),

  -- Si el modo es manual, el valor debe ser NULL (lo carga el usuario
  -- en cada recibo). Para los demás, valor es obligatorio.
  CONSTRAINT conceptos_valor_segun_modo CHECK (
    (modo_calculo = 'manual' AND valor IS NULL) OR
    (modo_calculo <> 'manual' AND valor IS NOT NULL)
  )
);

CREATE INDEX idx_conceptos_nomina_empresa_activo
  ON conceptos_nomina (empresa_id, activo, orden);

DROP TRIGGER IF EXISTS trg_conceptos_nomina_actualizado_en ON conceptos_nomina;
CREATE TRIGGER trg_conceptos_nomina_actualizado_en
  BEFORE UPDATE ON conceptos_nomina
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

ALTER TABLE conceptos_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY conceptos_nomina_tenant
  ON conceptos_nomina
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- ════════════════════════════════════════════════════════════════
-- 2. Conceptos asignados a cada contrato (N:M)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE conceptos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES contratos_laborales(id) ON DELETE CASCADE,
  -- ON DELETE RESTRICT: no se puede borrar un concepto si está asignado.
  -- (Para "desactivar" un concepto, usar `conceptos_nomina.activo=false`.)
  concepto_id uuid NOT NULL REFERENCES conceptos_nomina(id) ON DELETE RESTRICT,

  -- Permite que un empleado tenga el mismo concepto que el catálogo
  -- pero con un valor distinto (ej: bono individual diferente al
  -- estándar). Si NULL, el motor usa `conceptos_nomina.valor`.
  valor_override numeric(14,4),

  activo boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  creado_por uuid REFERENCES auth.users(id),

  -- No se puede asignar el mismo concepto dos veces al mismo contrato.
  UNIQUE (contrato_id, concepto_id)
);

CREATE INDEX idx_conceptos_contrato_contrato
  ON conceptos_contrato (contrato_id, activo);

ALTER TABLE conceptos_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY conceptos_contrato_tenant
  ON conceptos_contrato
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


-- ════════════════════════════════════════════════════════════════
-- 3. Conceptos efectivamente aplicados a un pago (snapshot inmutable)
-- ════════════════════════════════════════════════════════════════
-- Esta tabla es el detalle del recibo. Una fila por cada haber o
-- descuento aplicado, con snapshot del nombre y monto. Si más tarde
-- el concepto del catálogo cambia o se borra, este registro
-- conserva los valores históricos exactos.
CREATE TABLE conceptos_aplicados_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pago_nomina_id uuid NOT NULL REFERENCES pagos_nomina(id) ON DELETE CASCADE,
  -- SET NULL si se borra el concepto del catálogo: el recibo no se rompe.
  concepto_id uuid REFERENCES conceptos_nomina(id) ON DELETE SET NULL,

  -- Snapshot inmutable. `nombre_snapshot` viene de
  -- `conceptos_nomina.nombre` al momento de aplicar; `tipo` se
  -- replica acá para no depender de un join al imprimir el recibo.
  nombre_snapshot text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('haber', 'descuento')),
  monto numeric(14,2) NOT NULL,

  -- Trazabilidad: vino de aplicar una regla automática o lo agregó
  -- un humano en el editor del recibo. Útil para reportes.
  automatico boolean NOT NULL DEFAULT true,
  detalle text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conceptos_aplicados_pago
  ON conceptos_aplicados_pago (pago_nomina_id);

ALTER TABLE conceptos_aplicados_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY conceptos_aplicados_pago_tenant
  ON conceptos_aplicados_pago
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
