-- Columnas contables en presupuesto_pagos para preparar el módulo Contaduría.
-- Todas son nullable para no romper la lógica actual: la UI de Contaduría las
-- llenará a medida que el contador audite. Mientras estén en NULL, los pagos
-- se siguen viendo y comportando como hoy.

ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid,
  ADD COLUMN IF NOT EXISTS categoria_contable_id uuid,
  -- Fecha que el contador usa para imputar el pago (puede diferir de fecha_pago,
  -- ej. cobro 31/03 pero se imputa a abril por cierre de mes). Default = fecha_pago.
  ADD COLUMN IF NOT EXISTS fecha_imputacion timestamptz,
  -- Estado del flujo de conciliación con extractos bancarios / contabilidad.
  ADD COLUMN IF NOT EXISTS estado_conciliacion text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_conciliacion IN ('pendiente', 'reconciliado', 'cerrado')),
  ADD COLUMN IF NOT EXISTS notas_contables text;

COMMENT ON COLUMN presupuesto_pagos.centro_costo_id IS
  'FK al centro de costo al que se asigna el pago. Tabla centros_costo aún no creada (vendrá con módulo Contaduría).';
COMMENT ON COLUMN presupuesto_pagos.categoria_contable_id IS
  'FK a la categoría contable. Tabla categorias_contables aún no creada (vendrá con módulo Contaduría).';
COMMENT ON COLUMN presupuesto_pagos.fecha_imputacion IS
  'Fecha contable de imputación. Si NULL, usar fecha_pago (vista consolidada lo hace con COALESCE).';
COMMENT ON COLUMN presupuesto_pagos.estado_conciliacion IS
  'Estado del flujo de conciliación: pendiente | reconciliado | cerrado. cerrado = mes contable cerrado, no editable.';
COMMENT ON COLUMN presupuesto_pagos.notas_contables IS
  'Anotaciones del contador sobre el pago (ej: percepción IIBB pendiente, factura asociada, etc.).';

-- Índices para reportes contables: por centro de costo, categoría y por
-- fecha de imputación (que es la que usa Contaduría para cerrar períodos).
CREATE INDEX IF NOT EXISTS presupuesto_pagos_centro_costo_idx
  ON presupuesto_pagos(centro_costo_id) WHERE centro_costo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS presupuesto_pagos_categoria_contable_idx
  ON presupuesto_pagos(categoria_contable_id) WHERE categoria_contable_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS presupuesto_pagos_empresa_imputacion_idx
  ON presupuesto_pagos(empresa_id, fecha_imputacion) WHERE fecha_imputacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS presupuesto_pagos_conciliacion_idx
  ON presupuesto_pagos(empresa_id, estado_conciliacion) WHERE estado_conciliacion <> 'cerrado';
