-- Marca las columnas comprobante_* de presupuesto_pagos como deprecadas.
-- Datos ya backfilleados en presupuesto_pago_comprobantes (23/23 pagos con
-- legacy tienen su fila en la tabla nueva). Estas columnas siguen
-- escribiéndose hoy con el "primer comprobante" para mantener compat con
-- consumidores antiguos. Se eliminarán físicamente en una migración futura
-- cuando se confirme en producción que ningún consumidor lee de acá.

COMMENT ON COLUMN presupuesto_pagos.comprobante_url IS
  'DEPRECATED. Usar presupuesto_pago_comprobantes. Mantenida por compat; será eliminada en sprint futuro.';
COMMENT ON COLUMN presupuesto_pagos.comprobante_storage_path IS
  'DEPRECATED. Usar presupuesto_pago_comprobantes.';
COMMENT ON COLUMN presupuesto_pagos.comprobante_nombre IS
  'DEPRECATED. Usar presupuesto_pago_comprobantes.';
COMMENT ON COLUMN presupuesto_pagos.comprobante_tipo IS
  'DEPRECATED. Usar presupuesto_pago_comprobantes.';
COMMENT ON COLUMN presupuesto_pagos.comprobante_tamano_bytes IS
  'DEPRECATED. Usar presupuesto_pago_comprobantes.';
