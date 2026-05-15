-- 087_motivos_no_salida_contratos.sql
--
-- Agrega dos motivos de cierre de contrato que NO implican que el
-- empleado deje la empresa:
--
--   - 'cambio_condiciones': el contrato se cierra porque cambian las
--     condiciones económicas o laborales (aumento, cambio de modalidad,
--     de frecuencia, de sector, etc.) y se abre uno nuevo desde el día
--     siguiente. El empleado sigue activo.
--
--   - 'renovacion': aplica a contratos con fecha_fin (plazo_fijo,
--     temporal, pasantía) que se vencen y se renuevan con condiciones
--     idénticas o muy similares. El empleado sigue activo.
--
-- Antes de este PR todos los motivos representaban una salida real
-- ("renuncia", "despido_*", "jubilacion", etc.), por lo que para
-- cualquier cambio "en caliente" el operador tenía que usar "otro" +
-- nota libre, perdiendo trazabilidad para reportes ("¿cuántos cambios
-- de salario hicimos este año?", "¿qué tasa de renovación tenemos?").
--
-- Los motivos siguen siendo lista cerrada: lo que cambia es el dominio
-- del CHECK constraint.

ALTER TABLE contratos_laborales
  DROP CONSTRAINT IF EXISTS contratos_laborales_motivo_fin_check;

ALTER TABLE contratos_laborales
  ADD CONSTRAINT contratos_laborales_motivo_fin_check CHECK (motivo_fin IN (
    'renuncia',
    'despido_con_causa',
    'despido_sin_causa',
    'fin_plazo',
    'mutuo_acuerdo',
    'abandono',
    'jubilacion',
    'fallecimiento',
    'cambio_condiciones',
    'renovacion',
    'otro'
  ));
