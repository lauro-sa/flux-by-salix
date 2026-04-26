-- Defensa en profundidad para la regla "un pago adicional NO imputa a cuota":
--   1) CHECK constraint que impide es_adicional=true con cuota_id no nula.
--   2) Reforzar `recalcular_estado_cuota` para que IGNORE pagos con es_adicional=true
--      al calcular el total cobrado de la cuota (aunque el CHECK ya lo asegura,
--      mantenemos el filtro por si alguien aplica datos via service_role saltando
--      validaciones).

-- 1) CHECK constraint
ALTER TABLE presupuesto_pagos
  DROP CONSTRAINT IF EXISTS presupuesto_pagos_adicional_sin_cuota_chk;

ALTER TABLE presupuesto_pagos
  ADD CONSTRAINT presupuesto_pagos_adicional_sin_cuota_chk
  CHECK (NOT (es_adicional = true AND cuota_id IS NOT NULL));

COMMENT ON CONSTRAINT presupuesto_pagos_adicional_sin_cuota_chk ON presupuesto_pagos IS
  'Garantiza que un pago marcado como adicional (trabajo extra fuera del presupuesto) no imputa a una cuota del presupuesto original.';

-- 2) Refuerzo de recalcular_estado_cuota: filtra es_adicional=false al sumar.
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

  -- Sumar solo pagos no-adicionales asignados a esta cuota.
  SELECT
    COALESCE(SUM(monto_en_moneda_presupuesto), 0),
    MAX(fecha_pago),
    (SELECT creado_por_nombre FROM public.presupuesto_pagos
       WHERE cuota_id = p_cuota_id
         AND es_adicional = false
       ORDER BY fecha_pago DESC LIMIT 1)
  INTO v_total_pagado, v_fecha_ultimo_pago, v_nombre_ultimo_pago
  FROM public.presupuesto_pagos
  WHERE cuota_id = p_cuota_id
    AND es_adicional = false;

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
