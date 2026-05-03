-- Tests de la migración 050: estados configurables de presupuestos.
BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_pres_id uuid;
  v_count integer;
  v_clave text;
BEGIN
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 050', 'test-050-' || extract(epoch from now())::text);

  -- TEST 1: INSERT con estado borrador sincroniza
  INSERT INTO public.presupuestos (empresa_id, numero, estado, total_final, creado_por)
  VALUES (v_empresa_id, 'P-TEST-001', 'borrador', 1000, v_user_id)
  RETURNING id INTO v_pres_id;
  SELECT estado_clave INTO v_clave FROM public.presupuestos WHERE id = v_pres_id;
  IF v_clave <> 'borrador' THEN RAISE EXCEPTION 'TEST 1 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT sincroniza';

  -- TEST 2: UPDATE registra cambio
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.presupuestos SET estado = 'enviado' WHERE id = v_pres_id;
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_tipo = 'presupuesto' AND entidad_id = v_pres_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 2 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE registra cambio';

  -- TEST 3: catálogo de transiciones
  IF NOT public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'enviado', 'confirmado_cliente') THEN
    RAISE EXCEPTION 'TEST 3.1 FALLÓ';
  END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'borrador', 'completado') THEN
    RAISE EXCEPTION 'TEST 3.2 FALLÓ';
  END IF;
  RAISE NOTICE 'TEST 3 OK: catálogo';

  -- TEST 4: 5 transiciones manuales desde 'enviado' (3, 4, 5, 6, 7 — la 8 es es_automatica)
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'presupuesto', 'enviado');
  IF v_count <> 5 THEN RAISE EXCEPTION 'TEST 4 FALLÓ: %', v_count; END IF;
  RAISE NOTICE 'TEST 4 OK: 5 acciones manuales desde enviado';

  -- TEST 5: clave inválida es rechazada
  BEGIN
    UPDATE public.presupuestos SET estado_clave = 'inexistente' WHERE id = v_pres_id;
    RAISE EXCEPTION 'TEST 5 FALLÓ';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%clave de estado inválida%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 5 OK: clave inválida rechazada';

  RAISE NOTICE 'TODOS LOS TESTS DEL PR 10 PASARON';
END $tests$;

ROLLBACK;
