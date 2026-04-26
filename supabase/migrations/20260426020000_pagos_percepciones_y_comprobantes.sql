-- Pagos de presupuestos: percepciones + múltiples comprobantes + adicionales.
--
-- Cambios:
--  1) Nueva columna `monto_percepciones` en presupuesto_pagos. Se cobra del
--     cliente y se descuenta de la cuota igual que el monto neto, así que
--     `monto_en_moneda_presupuesto = (monto + monto_percepciones) * cotizacion`.
--  2) Nueva columna `es_adicional` en presupuesto_pagos. Marca entradas de
--     dinero por fuera del presupuesto (trabajo extra, servicios no
--     presupuestados). No imputa a cuota y se contabiliza aparte para no
--     romper el cálculo de "saldo del presupuesto".
--  3) Nueva tabla `presupuesto_pago_comprobantes` (1 pago → N adjuntos),
--     con tipo 'comprobante' (del pago) o 'percepcion' (de la retención/percepción).
--  4) Backfill: cada pago con comprobante en la tabla vieja se migra como
--     1 fila tipo 'comprobante' a la tabla nueva. Las columnas legacy quedan
--     por compat (un PR futuro las elimina, ver memoria refactor_telefonos).
--  5) Limpiar entradas viejas de chatter con accion='pago_rechazado' que
--     quedaron como rastro al eliminar pagos. Política nueva: al eliminar
--     un pago se borra la entrada original del chatter, no se crea una nueva.

-- ─── 1) Percepciones ────────────────────────────────────────────────────
ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS monto_percepciones numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN presupuesto_pagos.monto_percepciones IS
  'Monto de percepciones/retenciones cobradas dentro de este pago, en la moneda del pago. Suma al cobrado real porque desde el cliente sale igual.';

-- Recalcular `monto_en_moneda_presupuesto` para incluir percepciones en
-- los pagos que ya existen. Igual da 0 percepciones por default, pero
-- dejamos la fórmula consistente.
UPDATE presupuesto_pagos
SET monto_en_moneda_presupuesto = (monto + COALESCE(monto_percepciones, 0)) * cotizacion_cambio;

-- ─── 2) Adicionales (entradas de dinero fuera del presupuesto) ──────────
ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS es_adicional boolean NOT NULL DEFAULT false;

ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS concepto_adicional text;

COMMENT ON COLUMN presupuesto_pagos.es_adicional IS
  'true = trabajo extra cobrado fuera del presupuesto original. No imputa a cuota y suma aparte del cobrado del presupuesto. Cuando es true, cuota_id debe ser null.';

COMMENT ON COLUMN presupuesto_pagos.concepto_adicional IS
  'Descripción corta del adicional (ej: "Servicio extra de limpieza"). Solo aplica cuando es_adicional=true.';

-- Si alguien marca es_adicional=true y deja cuota_id, lo limpiamos por
-- consistencia (un adicional no pertenece a una cuota).
UPDATE presupuesto_pagos
SET cuota_id = NULL
WHERE es_adicional = true AND cuota_id IS NOT NULL;

-- ─── 3) Tabla nueva de comprobantes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS presupuesto_pago_comprobantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pago_id uuid NOT NULL REFERENCES presupuesto_pagos(id) ON DELETE CASCADE,
  -- 'comprobante' = del pago en sí | 'percepcion' = de retenciones/percepciones
  tipo text NOT NULL DEFAULT 'comprobante',
  url text NOT NULL,
  storage_path text NOT NULL,
  nombre text NOT NULL,
  mime_tipo text,
  tamano_bytes bigint,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presupuesto_pago_comprobantes_pago_idx
  ON presupuesto_pago_comprobantes(pago_id);

CREATE INDEX IF NOT EXISTS presupuesto_pago_comprobantes_empresa_idx
  ON presupuesto_pago_comprobantes(empresa_id);

ALTER TABLE presupuesto_pago_comprobantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_presupuesto_pago_comprobantes_empresa" ON presupuesto_pago_comprobantes;
CREATE POLICY "rls_presupuesto_pago_comprobantes_empresa" ON presupuesto_pago_comprobantes
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ─── 4) Backfill de comprobantes legacy ─────────────────────────────────
INSERT INTO presupuesto_pago_comprobantes
  (empresa_id, pago_id, tipo, url, storage_path, nombre, mime_tipo, tamano_bytes, creado_en)
SELECT
  p.empresa_id,
  p.id,
  'comprobante',
  p.comprobante_url,
  p.comprobante_storage_path,
  COALESCE(p.comprobante_nombre, 'comprobante'),
  p.comprobante_tipo,
  p.comprobante_tamano_bytes,
  p.creado_en
FROM presupuesto_pagos p
LEFT JOIN presupuesto_pago_comprobantes c ON c.pago_id = p.id
WHERE p.comprobante_url IS NOT NULL
  AND p.comprobante_storage_path IS NOT NULL
  AND c.id IS NULL;

-- ─── 5) Limpiar pagos rechazados huérfanos del chatter ──────────────────
-- Las entradas con accion='pago_rechazado' eran un rastro de auditoría que
-- quedaba al eliminar un pago. La nueva política borra la entrada del pago
-- directamente y no crea esta. Las viejas se limpian acá.
DELETE FROM chatter
WHERE entidad_tipo = 'presupuesto'
  AND metadata->>'accion' = 'pago_rechazado';
