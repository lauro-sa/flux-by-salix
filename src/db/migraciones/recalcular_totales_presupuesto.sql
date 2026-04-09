-- Función PL/pgSQL para recalcular totales de un presupuesto.
-- Reemplaza la lógica JavaScript que hacía 2 roundtrips por 1 solo atómico.
-- Se llama desde: POST/PATCH/DELETE de líneas de presupuesto.
-- 2026-04-08

CREATE OR REPLACE FUNCTION public.recalcular_totales_presupuesto(
  p_presupuesto_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subtotal_neto numeric := 0;
  v_total_impuestos numeric := 0;
  v_descuento_global numeric := 0;
  v_descuento_global_monto numeric := 0;
  v_total_final numeric := 0;
BEGIN
  -- Calcular subtotal e impuestos desde líneas
  SELECT
    COALESCE(SUM(CASE WHEN tipo_linea = 'producto' THEN COALESCE(subtotal, 0) ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN tipo_linea = 'descuento' THEN COALESCE(monto, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_linea = 'producto' THEN COALESCE(impuesto_monto, 0) ELSE 0 END), 0)
  INTO v_subtotal_neto, v_total_impuestos
  FROM lineas_presupuesto
  WHERE presupuesto_id = p_presupuesto_id;

  -- Obtener descuento global del presupuesto
  SELECT COALESCE(descuento_global, 0)
  INTO v_descuento_global
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  -- Calcular descuento global y total final (redondeado a 2 decimales)
  v_descuento_global_monto := ROUND(v_subtotal_neto * v_descuento_global / 100, 2);
  v_total_final := ROUND(v_subtotal_neto - v_descuento_global_monto + v_total_impuestos, 2);

  -- Actualizar presupuesto
  UPDATE presupuestos SET
    subtotal_neto = ROUND(v_subtotal_neto, 2),
    total_impuestos = ROUND(v_total_impuestos, 2),
    descuento_global_monto = v_descuento_global_monto,
    total_final = v_total_final,
    editado_por = COALESCE(p_usuario_id, editado_por),
    actualizado_en = now()
  WHERE id = p_presupuesto_id;
END;
$$;
