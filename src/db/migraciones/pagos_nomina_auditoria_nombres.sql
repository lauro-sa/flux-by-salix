-- Agrega nombres de editor/eliminador a pagos_nomina para auditoría consistente
ALTER TABLE pagos_nomina
  ADD COLUMN IF NOT EXISTS editado_por_nombre text,
  ADD COLUMN IF NOT EXISTS eliminado_por_nombre text;
