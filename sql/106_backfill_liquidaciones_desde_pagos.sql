-- =============================================================
-- Migración 106: Backfill desde pagos_nomina existentes
-- =============================================================
-- Para cada pago_nomina histórico no eliminado, generar:
--   - Una fila en liquidaciones_periodo con estado='cerrado' para
--     cada combinación única (empresa_id, periodo_inicio, periodo_fin)
--     que aparezca. Los períodos históricos quedan cerrados porque
--     ya pasaron y no se van a editar más.
--   - Una fila en liquidaciones_empleado_periodo con estado='pagado'
--     para cada pago existente, linkeada al pago_nomina_id.
--
-- snapshot_calculo = NULL para todos los históricos. No podemos
-- reconstruir el cálculo del momento con certeza (el motor pudo
-- haber cambiado, los conceptos pueden haberse renombrado o
-- borrado, etc.). NULL es honesto: "este pago se hizo, no sabemos
-- el cálculo detallado, pero pagos_nomina.monto_abonado tiene la
-- verdad financiera".
--
-- IDEMPOTENTE: si ya hay filas en las tablas nuevas, no duplica.
-- Usa INSERT ... ON CONFLICT DO NOTHING contra los UNIQUE.
-- =============================================================

-- ─── 1) Crear liquidaciones_periodo para cada (empresa, periodo) ───
-- Estado='cerrado' porque históricamente ya terminaron de procesarse.
-- abierto_en y cerrado_en se setean al min/max de creado_en de los pagos.
INSERT INTO public.liquidaciones_periodo (
  empresa_id, periodo_inicio, periodo_fin,
  estado, estado_clave,
  abierto_en, cerrado_en,
  motivo_cierre,
  creado_en, actualizado_en
)
SELECT
  p.empresa_id,
  p.fecha_inicio_periodo,
  p.fecha_fin_periodo,
  'cerrado', 'cerrado',
  MIN(p.creado_en),       -- abierto cuando se hizo el primer pago
  MAX(p.creado_en),       -- "cerrado" cuando se hizo el último
  'Backfill desde pagos históricos (sql/106)',
  MIN(p.creado_en),
  MAX(p.creado_en)
FROM public.pagos_nomina p
WHERE p.eliminado = false
GROUP BY p.empresa_id, p.fecha_inicio_periodo, p.fecha_fin_periodo
ON CONFLICT (empresa_id, periodo_inicio, periodo_fin) DO NOTHING;


-- ─── 2) Crear liquidaciones_empleado_periodo para cada pago ───
-- snapshot_calculo=NULL (no podemos reconstruir con certeza).
-- pago_nomina_id linkea al pago real.
-- liquidado/enviado/pagado_en se setean al creado_en del pago
-- (en el modelo viejo todas las fases ocurrían al mismo tiempo).
INSERT INTO public.liquidaciones_empleado_periodo (
  empresa_id, liquidacion_periodo_id, miembro_id,
  periodo_inicio, periodo_fin,
  estado, estado_clave,
  snapshot_calculo,
  pago_nomina_id,
  liquidado_en, liquidado_por, liquidado_por_nombre,
  enviado_en,   enviado_por,   enviado_por_nombre,
  pagado_en,    pagado_por,    pagado_por_nombre,
  creado_en, creado_por, actualizado_en
)
SELECT
  p.empresa_id,
  lp.id,                                   -- FK a liquidaciones_periodo recién creada
  p.miembro_id,
  p.fecha_inicio_periodo,
  p.fecha_fin_periodo,
  'pagado', 'pagado',
  NULL,                                    -- snapshot histórico: honestidad > falsa precisión
  p.id,                                    -- linkea al pago real
  p.creado_en, p.creado_por, p.creado_por_nombre,
  COALESCE(p.recibo_whatsapp_enviado_en, p.recibo_correo_enviado_en),
  COALESCE(p.recibo_whatsapp_enviado_por, p.recibo_correo_enviado_por),
  NULL,                                    -- no guardábamos snapshot del nombre del que envió
  p.creado_en, p.creado_por, p.creado_por_nombre,
  p.creado_en, p.creado_por, p.creado_en
FROM public.pagos_nomina p
JOIN public.liquidaciones_periodo lp
  ON lp.empresa_id = p.empresa_id
 AND lp.periodo_inicio = p.fecha_inicio_periodo
 AND lp.periodo_fin = p.fecha_fin_periodo
WHERE p.eliminado = false
ON CONFLICT (empresa_id, miembro_id, periodo_inicio, periodo_fin) DO NOTHING;


-- ─── 3) Sanity check ───
-- Si el backfill dejó pagos_nomina sin su correspondiente fila en
-- liquidaciones_empleado_periodo, falla la migración para forzar
-- diagnóstico antes de cualquier deploy.
DO $$
DECLARE
  v_pagos_huerfanos int;
BEGIN
  SELECT count(*) INTO v_pagos_huerfanos
  FROM public.pagos_nomina p
  WHERE p.eliminado = false
    AND NOT EXISTS (
      SELECT 1 FROM public.liquidaciones_empleado_periodo lep
      WHERE lep.pago_nomina_id = p.id
    );

  IF v_pagos_huerfanos > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % pagos_nomina sin liquidacion_empleado_periodo asociada', v_pagos_huerfanos;
  END IF;
END $$;
