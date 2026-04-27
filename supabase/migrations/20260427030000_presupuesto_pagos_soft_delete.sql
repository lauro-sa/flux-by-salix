-- Soft-delete para presupuesto_pagos.
-- En lugar de DELETE físico, los pagos quedan con `eliminado_en` seteado.
-- Esto permite:
--   1) Undo inmediato desde la UI con un toast "Deshacer".
--   2) Papelera de pagos: el contador puede recuperar un pago eliminado
--      por error días después, antes del cierre fiscal.
--   3) Trazabilidad: mantener el rastro completo aún cuando se elimine.
--
-- Un cron de purga física (a implementar después) borra los pagos con
-- eliminado_en > 7 días, junto con sus comprobantes en Storage.

-- 1) Columnas nuevas
ALTER TABLE presupuesto_pagos
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid,
  ADD COLUMN IF NOT EXISTS eliminado_por_nombre text;

COMMENT ON COLUMN presupuesto_pagos.eliminado_en IS
  'Soft-delete: si no es NULL, el pago está eliminado (papelera). NO debe contarse en saldos ni cobrado. Un cron lo borrará físicamente después de 7 días.';

-- 2) Índice parcial para queries habituales (filtran "vivos").
--    Más eficiente que un índice global porque la mayoría de pagos tendrán
--    eliminado_en = NULL.
CREATE INDEX IF NOT EXISTS presupuesto_pagos_vivos_presupuesto_idx
  ON presupuesto_pagos(presupuesto_id) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS presupuesto_pagos_vivos_cuota_idx
  ON presupuesto_pagos(cuota_id) WHERE eliminado_en IS NULL;

-- 3) Refuerzo del trigger de cuota: ahora también ignora pagos eliminados.
--    Esto garantiza que recalcular_estado_cuota nunca cuente un pago en
--    papelera para el saldo, aún si por algún motivo el código olvida
--    filtrar.
CREATE OR REPLACE FUNCTION public.recalcular_estado_cuota(p_cuota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_monto_cuota numeric;
  v_total_pagado numeric;
  v_nuevo_estado text;
  v_fecha_ultimo_pago timestamptz;
  v_nombre_ultimo_pago text;
BEGIN
  IF p_cuota_id IS NULL THEN RETURN; END IF;

  SELECT monto INTO v_monto_cuota
  FROM public.presupuesto_cuotas
  WHERE id = p_cuota_id;

  IF v_monto_cuota IS NULL THEN RETURN; END IF;

  -- Sumar solo pagos NO adicionales y NO eliminados imputados a esta cuota.
  SELECT
    COALESCE(SUM(monto_en_moneda_presupuesto), 0),
    MAX(fecha_pago),
    (SELECT creado_por_nombre FROM public.presupuesto_pagos
       WHERE cuota_id = p_cuota_id
         AND es_adicional = false
         AND eliminado_en IS NULL
       ORDER BY fecha_pago DESC LIMIT 1)
  INTO v_total_pagado, v_fecha_ultimo_pago, v_nombre_ultimo_pago
  FROM public.presupuesto_pagos
  WHERE cuota_id = p_cuota_id
    AND es_adicional = false
    AND eliminado_en IS NULL;

  IF v_total_pagado <= 0 THEN
    v_nuevo_estado := 'pendiente';
  ELSIF v_total_pagado >= v_monto_cuota THEN
    v_nuevo_estado := 'cobrada';
  ELSE
    v_nuevo_estado := 'parcial';
  END IF;

  UPDATE public.presupuesto_cuotas
  SET
    estado = v_nuevo_estado,
    fecha_cobro = CASE WHEN v_nuevo_estado = 'cobrada' THEN v_fecha_ultimo_pago ELSE NULL END,
    cobrado_por_nombre = CASE WHEN v_nuevo_estado = 'cobrada' THEN v_nombre_ultimo_pago ELSE NULL END
  WHERE id = p_cuota_id;
END;
$function$;
