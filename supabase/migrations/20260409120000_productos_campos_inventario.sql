-- Campos de inventario para productos físicos

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS ubicacion_deposito text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stock_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_maximo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punto_reorden numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dimensiones text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proveedor_principal text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alerta_stock_bajo boolean NOT NULL DEFAULT false;
