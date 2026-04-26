-- Trazabilidad pago → OT para Contaduría.
-- Permite responder "qué pagos corresponden a la OT X" sin tener que
-- inferirlo joins por presupuesto_id. Es nullable porque hay pagos previos
-- a la creación de la OT (adelanto al confirmar presupuesto antes de
-- generar la OT) y porque los pagos adicionales no necesariamente cuelgan
-- de una OT.

ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS orden_trabajo_id uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presupuesto_pagos_orden_trabajo_idx
  ON presupuesto_pagos(orden_trabajo_id);

COMMENT ON COLUMN presupuesto_pagos.orden_trabajo_id IS
  'Vinculación opcional con la OT a la que el pago corresponde operativamente. Se setea automáticamente al registrar un pago si el presupuesto tiene una OT activa única. Para reportes de Contaduría centrados en OT.';

-- Backfill: para cada pago sin orden_trabajo_id, asignar la OT viva más
-- reciente del mismo presupuesto (si la hay). Si hay varias, se elige la
-- creada antes que el pago para no asignar una posterior.
UPDATE presupuesto_pagos pp
SET orden_trabajo_id = sub.ot_id
FROM (
  SELECT
    pp2.id AS pago_id,
    (
      SELECT ot.id
      FROM ordenes_trabajo ot
      WHERE ot.presupuesto_id = pp2.presupuesto_id
        AND ot.en_papelera = false
        AND ot.estado <> 'cancelada'
        AND ot.creado_en <= pp2.creado_en
      ORDER BY ot.creado_en DESC
      LIMIT 1
    ) AS ot_id
  FROM presupuesto_pagos pp2
  WHERE pp2.orden_trabajo_id IS NULL
) AS sub
WHERE pp.id = sub.pago_id
  AND sub.ot_id IS NOT NULL;
