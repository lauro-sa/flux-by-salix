-- ──────────────────────────────────────────────────────────────────
-- Ajustes puntuales de conceptos por período
-- ──────────────────────────────────────────────────────────────────
--
-- El contrato + los conceptos asignados (con su vigencia) definen la
-- "plantilla" del recibo: lo que cobra normalmente cada liquidación.
-- Pero la realidad operativa de un mes específico puede requerir
-- ajustes puntuales sin modificar el contrato:
--
--   • Override de monto: este mes Presentismo es $30k en vez de los
--     $50k del catálogo (porque tuvo una falta justificada).
--   • Excluir: este mes no le pago Premio puntualidad (llegó tarde 3
--     veces) pero el concepto sigue en su contrato.
--   • Agregar: este mes le pago Bono navideño (concepto del catálogo)
--     pero no quiero asignarlo al contrato porque es one-shot.
--
-- Cómo es en software reales (Tango, Bejerman, Holded, Factorial):
-- "novedades del período" o "ajustes manuales del recibo" — exactamente
-- este patrón.
--
-- Importante:
--   • Los ajustes están atados a un PERÍODO específico (rango exacto).
--     Si el operador cambia el período, no se aplican.
--   • Los ajustes NUNCA modifican el contrato ni los conceptos del
--     catálogo. Solo afectan a un único recibo.
--   • Cuando se graba el pago, los ajustes ya quedaron snapshoteados
--     en `conceptos_aplicados_pago` — la tabla `ajustes_concepto_periodo`
--     solo guarda el "plan" del operador antes de pagar.

CREATE TABLE ajustes_concepto_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  -- Período exacto al que aplica. Solo se respeta si coincide
  -- byte-a-byte con el período liquidado (mismo desde/hasta).
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  -- Concepto del catálogo al que apunta el ajuste. Siempre presente,
  -- incluso en 'excluir': sabemos qué concepto del contrato vamos a
  -- saltar.
  concepto_id uuid NOT NULL REFERENCES conceptos_nomina(id) ON DELETE RESTRICT,
  tipo_ajuste text NOT NULL CHECK (tipo_ajuste IN ('override', 'excluir', 'agregar')),
  -- Monto custom para 'override' y 'agregar'. Para 'override' anula el
  -- valor del catálogo. Para 'agregar' es el monto que se aplica.
  -- Para 'excluir' debe ser NULL.
  monto_override numeric(14,4),
  -- Motivo opcional que documenta por qué se hizo el ajuste. Aparece
  -- como tooltip en la UI y en el detalle del recibo si se incluye.
  motivo text,
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  -- Un mismo (miembro, período, concepto) no puede tener dos ajustes.
  -- Si el operador quiere cambiar, se hace UPDATE.
  UNIQUE (miembro_id, periodo_inicio, periodo_fin, concepto_id)
);

-- Coherencia: si tipo_ajuste='excluir', monto_override DEBE ser NULL.
-- Si tipo_ajuste='override' o 'agregar', monto_override DEBE estar.
ALTER TABLE ajustes_concepto_periodo
  ADD CONSTRAINT ajustes_concepto_periodo_monto_check
  CHECK (
    (tipo_ajuste = 'excluir' AND monto_override IS NULL)
    OR (tipo_ajuste IN ('override', 'agregar') AND monto_override IS NOT NULL)
  );

-- Índice principal: el motor busca por (miembro, periodo).
CREATE INDEX ajustes_concepto_periodo_periodo_idx
  ON ajustes_concepto_periodo (empresa_id, miembro_id, periodo_inicio, periodo_fin);

-- RLS multi-tenant.
ALTER TABLE ajustes_concepto_periodo ENABLE ROW LEVEL SECURITY;

CREATE POLICY ajustes_concepto_periodo_select ON ajustes_concepto_periodo
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY ajustes_concepto_periodo_insert ON ajustes_concepto_periodo
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY ajustes_concepto_periodo_update ON ajustes_concepto_periodo
  FOR UPDATE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
            WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY ajustes_concepto_periodo_delete ON ajustes_concepto_periodo
  FOR DELETE USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Trigger para actualizado_en.
CREATE OR REPLACE FUNCTION ajustes_concepto_periodo_sync_actualizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ajustes_concepto_periodo_actualizado_trg
  BEFORE UPDATE ON ajustes_concepto_periodo
  FOR EACH ROW EXECUTE FUNCTION ajustes_concepto_periodo_sync_actualizado();

COMMENT ON TABLE ajustes_concepto_periodo IS
  'Ajustes puntuales (override/excluir/agregar) de conceptos para un período de liquidación específico. No modifica el contrato.';
