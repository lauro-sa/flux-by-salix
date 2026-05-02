-- =============================================================
-- Tests de la migración 046: estados configurables de conversaciones
-- =============================================================
-- Cómo correrlo:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f sql/tests/046_estados_conversaciones.test.sql
--
-- Cubre:
--   - INSERT con estado legacy sincroniza estado_clave + resuelve estado_id
--   - UPDATE de estado dispara cambio en cambios_estado con origen=sistema
--     (sin auth.uid → sistema; con auth.uid → manual, no testeable acá)
--   - Snapshot de grupo (activo→espera)
--   - UPDATE de estado_clave nuevo sincroniza estado legacy
--   - validar_transicion_estado contra el catálogo de conversaciones
--   - obtener_transiciones_disponibles desde 'abierta' devuelve 3 acciones
--   - Clave inválida es rechazada
--   - Motivo se persiste cuando se invoca registrar_cambio_estado directo
--   - 4 estados de sistema sembrados correctamente
-- =============================================================

BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := '00000000-0000-0000-0000-00000000a046';
  v_canal_id uuid := gen_random_uuid();
  v_conv_id uuid;
  v_count integer;
  v_estado_id uuid;
  v_estado_anterior_id uuid;
  v_estado_clave text;
  v_estado_legacy text;
  v_origen text;
BEGIN
  -- Limpieza previa
  DELETE FROM public.conversaciones WHERE empresa_id = v_empresa_id;
  DELETE FROM public.empresas WHERE id = v_empresa_id;

  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 046', 'test-046-' || extract(epoch from now())::text);

  -- TEST 1
  INSERT INTO public.conversaciones (empresa_id, canal_id, tipo_canal, estado, prioridad)
  VALUES (v_empresa_id, v_canal_id, 'whatsapp', 'abierta', 'normal')
  RETURNING id INTO v_conv_id;

  SELECT estado_clave, estado_id INTO v_estado_clave, v_estado_id
  FROM public.conversaciones WHERE id = v_conv_id;
  IF v_estado_clave <> 'abierta' THEN RAISE EXCEPTION 'TEST 1.1 FALLÓ: %', v_estado_clave; END IF;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'TEST 1.2 FALLÓ: estado_id NULL'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT sincroniza estado_clave/estado_id';

  -- TEST 2
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.conversaciones SET estado = 'en_espera' WHERE id = v_conv_id;
  SELECT count(*), max(origen) INTO v_count, v_origen FROM public.cambios_estado
  WHERE empresa_id = v_empresa_id AND entidad_tipo = 'conversacion'
    AND estado_anterior = 'abierta' AND estado_nuevo = 'en_espera';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 2.1 FALLÓ: cambios=%', v_count; END IF;
  IF v_origen <> 'sistema' THEN RAISE EXCEPTION 'TEST 2.2 FALLÓ: origen=% (esperaba sistema)', v_origen; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE registra cambio (origen=sistema sin auth)';

  -- TEST 3
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_conv_id AND estado_nuevo = 'en_espera'
    AND grupo_anterior = 'activo' AND grupo_nuevo = 'espera';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 3 FALLÓ: %', v_count; END IF;
  RAISE NOTICE 'TEST 3 OK: grupos snapshoteados (activo→espera)';

  -- TEST 4
  UPDATE public.conversaciones SET estado_clave = 'resuelta' WHERE id = v_conv_id;
  SELECT estado, estado_clave INTO v_estado_legacy, v_estado_clave
  FROM public.conversaciones WHERE id = v_conv_id;
  IF v_estado_legacy <> 'resuelta' THEN RAISE EXCEPTION 'TEST 4.1 FALLÓ: legacy=%', v_estado_legacy; END IF;
  IF v_estado_clave <> 'resuelta' THEN RAISE EXCEPTION 'TEST 4.2 FALLÓ: clave=%', v_estado_clave; END IF;
  RAISE NOTICE 'TEST 4 OK: UPDATE estado_clave sincroniza estado legacy';

  -- TEST 5
  IF NOT public.validar_transicion_estado(v_empresa_id, 'conversacion', 'abierta', 'resuelta') THEN
    RAISE EXCEPTION 'TEST 5.1 FALLÓ';
  END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'conversacion', 'spam', 'resuelta') THEN
    RAISE EXCEPTION 'TEST 5.2 FALLÓ: spam→resuelta no debió validar';
  END IF;
  RAISE NOTICE 'TEST 5 OK: validar_transicion_estado funciona';

  -- TEST 6
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'conversacion', 'abierta');
  IF v_count <> 3 THEN RAISE EXCEPTION 'TEST 6 FALLÓ: esperaba 3, obtuvo %', v_count; END IF;
  RAISE NOTICE 'TEST 6 OK: 3 acciones disponibles desde "abierta"';

  -- TEST 7
  BEGIN
    UPDATE public.conversaciones SET estado_clave = 'inexistente' WHERE id = v_conv_id;
    RAISE EXCEPTION 'TEST 7 FALLÓ';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%clave de estado inválida%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 7 OK: clave inválida rechazada';

  -- TEST 8: motivo se propaga
  PERFORM public.registrar_cambio_estado(
    p_empresa_id => v_empresa_id,
    p_entidad_tipo => 'conversacion',
    p_entidad_id => v_conv_id,
    p_estado_anterior => 'resuelta',
    p_estado_nuevo => 'abierta',
    p_origen => 'manual',
    p_motivo => 'Reabrir por solicitud del cliente'
  );
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_conv_id AND motivo = 'Reabrir por solicitud del cliente';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 8 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 8 OK: motivo persistido en cambios_estado';

  -- TEST 9: 4 estados de sistema sembrados
  IF (SELECT count(*) FROM public.estados_conversacion WHERE empresa_id IS NULL) <> 4 THEN
    RAISE EXCEPTION 'TEST 9 FALLÓ: faltan estados de sistema';
  END IF;
  RAISE NOTICE 'TEST 9 OK: 4 estados de sistema sembrados';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DEL PR 3 (CONVERSACIONES) PASARON';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $tests$;

ROLLBACK;
