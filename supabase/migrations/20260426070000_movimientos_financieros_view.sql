-- Vista canónica de movimientos financieros para el módulo Contaduría.
-- Hoy solo agrega presupuesto_pagos. Cuando se agreguen otras fuentes
-- (adelantos_nomina, gastos, ingresos manuales) se sumarán como UNION ALL.
--
-- Reglas:
--   - tipo: 'pago_presupuesto' o 'adicional' (entrada de dinero fuera del
--     presupuesto). Permite a Contaduría sumar/separar como necesite.
--   - fecha_contable: COALESCE(fecha_imputacion, fecha_pago) — el contador
--     puede sobrescribir la fecha de imputación sin tocar fecha_pago.
--   - monto_neto/monto_percepciones: derivados para que la vista muestre
--     directamente el "ingreso real" (monto_total - percepciones).
--   - RLS de la tabla origen se hereda automáticamente cuando se selecciona
--     vía supabase client (security_invoker = true).

CREATE OR REPLACE VIEW public.movimientos_financieros_v
WITH (security_invoker = true)
AS
SELECT
  pp.id,
  pp.empresa_id,
  CASE WHEN pp.es_adicional THEN 'adicional'::text
       ELSE 'pago_presupuesto'::text END                            AS tipo,
  pp.presupuesto_id                                                 AS entidad_referencia_id,
  'presupuesto'::text                                               AS entidad_referencia_tipo,
  pp.orden_trabajo_id,
  pp.cuota_id,
  pp.fecha_pago,
  COALESCE(pp.fecha_imputacion, pp.fecha_pago)                      AS fecha_contable,
  pp.monto                                                          AS monto_origen,
  pp.moneda                                                         AS moneda_origen,
  pp.cotizacion_cambio,
  pp.monto_en_moneda_presupuesto                                    AS monto_total,
  pp.monto_percepciones                                             AS monto_percepciones_origen,
  -- Percepciones llevadas a moneda del presupuesto.
  ROUND((pp.monto_percepciones * pp.cotizacion_cambio)::numeric, 2) AS monto_percepciones_total,
  -- Ingreso real para la empresa: total cobrado menos retenciones a depositar.
  ROUND(
    (pp.monto_en_moneda_presupuesto - (pp.monto_percepciones * pp.cotizacion_cambio))::numeric,
    2
  )                                                                 AS monto_neto_empresa,
  pp.metodo,
  pp.referencia,
  pp.descripcion,
  pp.concepto_adicional,
  pp.centro_costo_id,
  pp.categoria_contable_id,
  pp.estado_conciliacion,
  pp.notas_contables,
  pp.creado_por                                                     AS registrado_por,
  pp.creado_por_nombre                                              AS registrado_por_nombre,
  pp.creado_en,
  pp.actualizado_en
FROM public.presupuesto_pagos pp;

COMMENT ON VIEW public.movimientos_financieros_v IS
  'Vista canónica de movimientos financieros para Contaduría. Hoy solo presupuesto_pagos; futuro: UNION con adelantos_nomina, gastos, ingresos varios. security_invoker=true respeta RLS de la tabla origen.';
