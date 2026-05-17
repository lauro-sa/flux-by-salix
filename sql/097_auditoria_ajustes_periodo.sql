-- ──────────────────────────────────────────────────────────────────
-- Auditoría de ajustes_concepto_periodo
-- ──────────────────────────────────────────────────────────────────
--
-- Igual que `auditoria_conceptos_contrato` para las asignaciones del
-- contrato (sql/091), pero para los ajustes puntuales del período
-- (sql/095). Registra altas/cambios/bajas con quién/cuándo/qué
-- cambió, para que después se pueda responder preguntas como:
--
--   "¿Quién decidió excluir Premio puntualidad en mayo de Romero?"
--   "¿Cuál era el monto antes del override en abril de Costa?"
--
-- La tabla es inmutable: solo INSERT, nunca UPDATE ni DELETE. Si
-- una fila de ajuste se borra al pagar (cleanup en /api/nominas/
-- pagos), la auditoría queda — eso es justamente lo que la hace
-- útil para auditoría.

CREATE TABLE auditoria_ajustes_concepto_periodo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- Referenciamos por valor (no por FK) porque el ajuste se borra al
  -- pagar y la auditoría debe sobrevivir. Guardamos los IDs como
  -- texto para que un DELETE/cleanup no rompa la auditoría.
  ajuste_id uuid,
  miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  concepto_id uuid REFERENCES conceptos_nomina(id) ON DELETE SET NULL,
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  editado_por uuid NOT NULL REFERENCES auth.users(id),
  accion text NOT NULL CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'limpiar_al_pagar')),
  -- Estado anterior y nuevo (snapshot JSON del ajuste). Para 'crear'
  -- el anterior es NULL; para 'eliminar' / 'limpiar_al_pagar' el
  -- nuevo es NULL.
  estado_anterior jsonb,
  estado_nuevo jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auditoria_ajustes_concepto_periodo ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditoria_ajustes_concepto_periodo_select ON auditoria_ajustes_concepto_periodo
  FOR SELECT USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

CREATE POLICY auditoria_ajustes_concepto_periodo_insert ON auditoria_ajustes_concepto_periodo
  FOR INSERT WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Índices para queries típicas: por miembro+período (ver auditoría
-- de una liquidación específica) y por concepto (ver historia del
-- concepto a través del tiempo).
CREATE INDEX auditoria_ajustes_concepto_periodo_periodo_idx
  ON auditoria_ajustes_concepto_periodo (empresa_id, miembro_id, periodo_inicio, periodo_fin, creado_en DESC);

CREATE INDEX auditoria_ajustes_concepto_periodo_concepto_idx
  ON auditoria_ajustes_concepto_periodo (empresa_id, concepto_id, creado_en DESC);

COMMENT ON TABLE auditoria_ajustes_concepto_periodo IS
  'Trazabilidad inmutable de altas, cambios, eliminaciones y limpiezas al pagar de ajustes_concepto_periodo (sql/095).';
