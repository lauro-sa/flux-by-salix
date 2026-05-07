-- =============================================================
-- Tests de la migración 049: estados configurables de órdenes
-- =============================================================
-- Cubre: INSERT, UPDATE registra cambio, alias esperando→en_espera,
-- catálogo, transiciones disponibles.
-- =============================================================

BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_orden_id uuid;
  v_count integer;
  v_clave text;
BEGIN
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 049', 'test-049-' || extract(epoch from now())::text);

  INSERT INTO public.ordenes_trabajo (empresa_id, numero, titulo, estado, creado_por)
  VALUES (v_empresa_id, 'OT-TEST-001', 'Trabajo Test', 'abierta', v_user_id)
  RETURNING id INTO v_orden_id;
  SELECT estado_clave INTO v_clave FROM public.ordenes_trabajo WHERE id = v_orden_id;
  IF v_clave <> 'abierta' THEN RAISE EXCEPTION 'TEST 1 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT sincroniza';

  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.ordenes_trabajo SET estado = 'en_progreso' WHERE id = v_orden_id;
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_tipo = 'orden' AND entidad_id = v_orden_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 2 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE registra cambio';

  UPDATE public.ordenes_trabajo SET estado = 'esperando' WHERE id = v_orden_id;
  SELECT estado_clave INTO v_clave FROM public.ordenes_trabajo WHERE id = v_orden_id;
  IF v_clave <> 'en_espera' THEN
    RAISE EXCEPTION 'TEST 3 FALLÓ: alias no se tradujo (clave=%)', v_clave;
  END IF;
  RAISE NOTICE 'TEST 3 OK: alias esperando→en_espera funciona';

  IF NOT public.validar_transicion_estado(v_empresa_id, 'orden', 'en_progreso', 'en_espera') THEN
    RAISE EXCEPTION 'TEST 4.1 FALLÓ';
  END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'orden', 'en_progreso', 'esperando') THEN
    RAISE EXCEPTION 'TEST 4.2 FALLÓ: catálogo NO debe aceptar la clave vieja';
  END IF;
  RAISE NOTICE 'TEST 4 OK: catálogo solo acepta en_espera';

  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'orden', 'en_progreso');
  IF v_count <> 3 THEN RAISE EXCEPTION 'TEST 5 FALLÓ: %', v_count; END IF;
  RAISE NOTICE 'TEST 5 OK: 3 acciones desde en_progreso';

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DEL PR 9 PASARON';
  RAISE NOTICE '═══════════════════════════════════════════════';
END $tests$;

ROLLBACK;
