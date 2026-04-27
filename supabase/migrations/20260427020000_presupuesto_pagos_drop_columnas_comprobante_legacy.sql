-- DROP físico de las columnas comprobante_* legacy de presupuesto_pagos.
-- Datos ya backfilleados a presupuesto_pago_comprobantes (verificado en
-- migración 20260427010000). El código del repo ya no las lee ni escribe.

ALTER TABLE presupuesto_pagos
  DROP COLUMN IF EXISTS comprobante_url,
  DROP COLUMN IF EXISTS comprobante_storage_path,
  DROP COLUMN IF EXISTS comprobante_nombre,
  DROP COLUMN IF EXISTS comprobante_tipo,
  DROP COLUMN IF EXISTS comprobante_tamano_bytes;
