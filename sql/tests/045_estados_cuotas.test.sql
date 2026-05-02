-- =============================================================
-- Tests de la migración 045: estados configurables de cuotas
-- =============================================================
-- Cómo correrlo (modo seguro, en transacción que se revierte):
--
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f sql/tests/045_estados_cuotas.test.sql
--
-- Cubre:
--   - INSERT de cuota con `estado` legacy → sincroniza estado_clave/estado_id
--   - UPDATE de `estado` legacy → escribe en cambios_estado con origen=sistema
--   - UPDATE de `estado_clave` nuevo → sincroniza `estado` legacy
--   - Snapshot de grupo en cambios_estado (activo→completado)
--   - Validación de clave inválida (rechazo)
--   - Idempotencia: UPDATE sin cambio real es no-op
--   - Compatibilidad con función legacy `recalcular_estado_cuota`
--   - Cambio derivado del recálculo queda registrado
-- =============================================================

BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := '00000000-0000-0000-0000-00000000a045';
  v_user_id uuid := gen_random_uuid();
  v_pres_id uuid;
  v_cuota_id uuid;
  v_count integer;
  v_estado_id uuid;
  v_estado_anterior_id uuid;
  v_estado_clave text;
  v_estado_legacy text;
BEGIN
  -- Limpieza previa en orden inverso (sin cascade, para evitar disparar
  -- triggers de auditoría preexistentes que tienen FK a empresas).
  DELETE FROM public.presupuesto_pagos WHERE empresa_id = v_empresa_id;
  DELETE FROM public.presupuesto_cuotas WHERE empresa_id = v_empresa_id;
  DELETE FROM public.presupuestos WHERE empresa_id = v_empresa_id;
  DELETE FROM public.empresas WHERE id = v_empresa_id;

  -- Setup
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 045', 'test-045-' || extract(epoch from now())::text);

  INSERT INTO public.presupuestos (id, empresa_id, numero, estado, total_final, creado_por)
  VALUES (gen_random_uuid(), v_empresa_id, 'TEST-045', 'borrador', 1000, v_user_id)
  RETURNING id INTO v_pres_id;

  -- ─── TEST 1: INSERT con estado legacy sincroniza estado_clave + resuelve estado_id
  INSERT INTO public.presupuesto_cuotas (presupuesto_id, empresa_id, numero, porcentaje, monto, estado)
  VALUES (v_pres_id, v_empresa_id, 1, 100, 1000, 'pendiente')
  RETURNING id INTO v_cuota_id;

  SELECT estado_clave, estado_id INTO v_estado_clave, v_estado_id
  FROM public.presupuesto_cuotas WHERE id = v_cuota_id;
  IF v_estado_clave <> 'pendiente' THEN RAISE EXCEPTION 'TEST 1.1 FALLÓ: estado_clave=%', v_estado_clave; END IF;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'TEST 1.2 FALLÓ: estado_id NULL'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT con estado viejo sincroniza estado_clave/estado_id';

  -- ─── TEST 2: UPDATE de estado dispara cambio en cambios_estado con origen=sistema
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.presupuesto_cuotas SET estado = 'parcial' WHERE id = v_cuota_id;

  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE empresa_id = v_empresa_id AND entidad_id = v_cuota_id
    AND estado_anterior = 'pendiente' AND estado_nuevo = 'parcial' AND origen = 'sistema';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 2.1 FALLÓ: cambios=%', v_count; END IF;

  SELECT estado_clave, estado_anterior_id INTO v_estado_clave, v_estado_anterior_id
  FROM public.presupuesto_cuotas WHERE id = v_cuota_id;
  IF v_estado_clave <> 'parcial' THEN RAISE EXCEPTION 'TEST 2.2 FALLÓ: clave=%', v_estado_clave; END IF;
  IF v_estado_anterior_id IS NULL THEN RAISE EXCEPTION 'TEST 2.3 FALLÓ: estado_anterior_id NULL'; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE estado legacy sincroniza + registra cambio';

  -- ─── TEST 3: UPDATE de estado_clave (path nuevo) sincroniza estado legacy
  UPDATE public.presupuesto_cuotas SET estado_clave = 'cobrada' WHERE id = v_cuota_id;
  SELECT estado, estado_clave INTO v_estado_legacy, v_estado_clave
  FROM public.presupuesto_cuotas WHERE id = v_cuota_id;
  IF v_estado_legacy <> 'cobrada' THEN RAISE EXCEPTION 'TEST 3.1 FALLÓ: legacy=%', v_estado_legacy; END IF;
  IF v_estado_clave <> 'cobrada' THEN RAISE EXCEPTION 'TEST 3.2 FALLÓ: clave=%', v_estado_clave; END IF;
  RAISE NOTICE 'TEST 3 OK: UPDATE estado_clave sincroniza estado legacy';

  -- ─── TEST 4: snapshot de grupo (activo→completado)
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_cuota_id AND estado_nuevo = 'cobrada'
    AND grupo_anterior = 'activo' AND grupo_nuevo = 'completado';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 4 FALLÓ: %', v_count; END IF;
  RAISE NOTICE 'TEST 4 OK: grupo snapshoteado correctamente';

  -- ─── TEST 5: clave inválida es rechazada
  BEGIN
    UPDATE public.presupuesto_cuotas SET estado_clave = 'inexistente' WHERE id = v_cuota_id;
    RAISE EXCEPTION 'TEST 5 FALLÓ: debió fallar con clave inválida';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%clave de estado inválida%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 5 OK: clave inválida es rechazada';

  -- ─── TEST 6: UPDATE sin cambio real es no-op en cambios_estado
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.presupuesto_cuotas SET estado = 'cobrada' WHERE id = v_cuota_id;
  SELECT count(*) INTO v_count FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'TEST 6 FALLÓ: cambios=%', v_count; END IF;
  RAISE NOTICE 'TEST 6 OK: UPDATE sin cambio real es no-op';

  -- ─── TEST 7: la función legacy recalcular_estado_cuota sigue funcionando
  -- Volver a pendiente, registrar pago completo, verificar que el recálculo
  -- propaga el cambio a estado_clave vía la sincronización.
  UPDATE public.presupuesto_cuotas SET estado = 'pendiente' WHERE id = v_cuota_id;

  INSERT INTO public.presupuesto_pagos
    (empresa_id, presupuesto_id, cuota_id, monto, monto_en_moneda_presupuesto, creado_por)
  VALUES (v_empresa_id, v_pres_id, v_cuota_id, 1000, 1000, v_user_id);

  SELECT estado_clave INTO v_estado_clave FROM public.presupuesto_cuotas WHERE id = v_cuota_id;
  IF v_estado_clave <> 'cobrada' THEN
    RAISE EXCEPTION 'TEST 7 FALLÓ: recálculo no propagó (clave=%)', v_estado_clave;
  END IF;
  RAISE NOTICE 'TEST 7 OK: recalcular_estado_cuota legacy + sincroniza estado_clave';

  -- ─── TEST 8: el cambio derivado quedó en cambios_estado
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_cuota_id AND estado_nuevo = 'cobrada' AND origen = 'sistema';
  IF v_count < 1 THEN RAISE EXCEPTION 'TEST 8 FALLÓ: cambio derivado no registrado'; END IF;
  RAISE NOTICE 'TEST 8 OK: cambio derivado del recálculo queda registrado';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DEL PR 2 (CUOTAS) PASARON';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $tests$;

ROLLBACK;
