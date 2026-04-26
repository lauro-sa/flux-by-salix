-- Columna `estado_cambiado_en` en presupuestos: marca cuándo el presupuesto
-- pasó al estado ACTUAL. Permite ordenar por "recién aceptados" / "recién
-- completados" sin importar la fecha de creación.
--
-- Caso de uso: un presupuesto creado hace 2 años que recién hoy pasa a
-- `completado` debe aparecer arriba al ordenar por esta fecha.

-- 1) Columna nueva (NOT NULL diferido — primero backfill, después constraint)
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS estado_cambiado_en timestamptz;

-- 2) Backfill: para cada presupuesto, fecha de la última entrada del
--    historial cuyo estado coincide con el estado actual; si no hay
--    historial, caer en `fecha_aceptacion` (si aplica al estado actual)
--    o finalmente en `creado_en`.
WITH ultima_transicion AS (
  SELECT
    p.id,
    (
      SELECT MAX(h.fecha)
      FROM presupuesto_historial h
      WHERE h.presupuesto_id = p.id
        AND h.estado = p.estado
    ) AS fecha_historial
  FROM presupuestos p
)
UPDATE presupuestos p
SET estado_cambiado_en = COALESCE(
  ut.fecha_historial,
  CASE
    WHEN p.estado IN ('confirmado_cliente', 'orden_venta', 'completado')
      THEN p.fecha_aceptacion
    ELSE NULL
  END,
  p.creado_en
)
FROM ultima_transicion ut
WHERE p.id = ut.id;

-- 3) Constraint NOT NULL una vez backfilleado
ALTER TABLE presupuestos
  ALTER COLUMN estado_cambiado_en SET NOT NULL;

-- 4) Default para nuevos registros
ALTER TABLE presupuestos
  ALTER COLUMN estado_cambiado_en SET DEFAULT NOW();

-- 5) Índice compuesto para ordenamiento eficiente por empresa + fecha
CREATE INDEX IF NOT EXISTS idx_presupuestos_empresa_estado_cambiado
  ON presupuestos (empresa_id, estado_cambiado_en DESC)
  WHERE en_papelera = false;

-- 6) Trigger: en cualquier UPDATE que modifique `estado`, refrescar
--    `estado_cambiado_en = NOW()`. Cubre los caminos:
--      - PATCH /api/presupuestos/[id] (cambio manual)
--      - subida de comprobante → orden_venta
--      - sincronizarEstadoPresupuesto (cobros automáticos)
--      - cancelación
CREATE OR REPLACE FUNCTION actualizar_estado_cambiado_en()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.estado_cambiado_en = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_presupuestos_estado_cambiado_en ON presupuestos;
CREATE TRIGGER trg_presupuestos_estado_cambiado_en
  BEFORE UPDATE OF estado ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_estado_cambiado_en();

COMMENT ON COLUMN presupuestos.estado_cambiado_en IS
  'Fecha/hora en que el presupuesto pasó al estado ACTUAL. Se actualiza por trigger en cada cambio de estado. Usar para ordenar listados por "recién aceptados / recién completados".';
