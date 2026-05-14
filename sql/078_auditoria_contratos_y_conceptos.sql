-- 078_auditoria_contratos_y_conceptos.sql
-- PR 2 del plan "Módulo Nóminas" (ver PLAN_MODULO_NOMINAS.md).
--
-- Tablas de auditoría siguiendo el patrón del repo
-- (`auditoria_<entidad>` con columnas:
--  id, empresa_id, <entidad>_id, editado_por, campo_modificado,
--  valor_anterior, valor_nuevo, motivo, creado_en).
--
-- Se crean dos tablas:
--   - auditoria_contratos_laborales  — cambios en el contrato vigente
--     y cierres/reaperturas (sector, modalidad, monto, etc.).
--   - auditoria_conceptos_nomina     — cambios en el catálogo
--     (cambios de fórmula, activar/desactivar, etc.).
--
-- No se audita `conceptos_aplicados_pago` porque es snapshot inmutable
-- (no se edita una vez creado el recibo). Tampoco `conceptos_contrato`
-- porque sus cambios quedan trazados a través del contrato.

CREATE TABLE auditoria_contratos_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES contratos_laborales(id) ON DELETE CASCADE,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_contratos_contrato
  ON auditoria_contratos_laborales (contrato_id, creado_en DESC);

ALTER TABLE auditoria_contratos_laborales ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_auditoria_contratos_laborales
  ON auditoria_contratos_laborales
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);


CREATE TABLE auditoria_conceptos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  concepto_id uuid NOT NULL REFERENCES conceptos_nomina(id) ON DELETE CASCADE,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  campo_modificado text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_conceptos_concepto
  ON auditoria_conceptos_nomina (concepto_id, creado_en DESC);

ALTER TABLE auditoria_conceptos_nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_auditoria_conceptos_nomina
  ON auditoria_conceptos_nomina
  USING (empresa_id = ((auth.jwt() ->> 'empresa_id'::text))::uuid);
