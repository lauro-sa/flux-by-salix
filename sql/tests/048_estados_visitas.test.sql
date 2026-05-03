-- =============================================================
-- Tests de la migración 048: estados configurables de visitas
-- =============================================================
-- Cómo correrlo:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f sql/tests/048_estados_visitas.test.sql
--
-- Cubre:
--   - INSERT con estado legacy sincroniza estado_clave + estado_id
--   - UPDATE de estado registra cambio (origen=sistema sin auth)
--   - Snapshot de grupos (inicial→activo)
--   - UPDATE de estado_clave sincroniza estado legacy
--   - validar_transicion_estado contra catálogo
--   - obtener_transiciones_disponibles devuelve 3 desde 'programada'
--   - clave inválida es rechazada
-- =============================================================

BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_tipo_contacto_id uuid;
  v_contacto_id uuid;
  v_visita_id uuid;
  v_count integer;
  v_clave text;
  v_origen text;
BEGIN
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 048', 'test-048-' || extract(epoch from now())::text);
  INSERT INTO public.tipos_contacto (empresa_id, clave, etiqueta)
  VALUES (v_empresa_id, 'cliente_test', 'Cliente test')
  RETURNING id INTO v_tipo_contacto_id;
  INSERT INTO public.contactos (empresa_id, tipo_contacto_id, nombre, creado_por)
  VALUES (v_empresa_id, v_tipo_contacto_id, 'Cliente Test', v_user_id)
  RETURNING id INTO v_contacto_id;

  -- TEST 1
  INSERT INTO public.visitas (empresa_id, contacto_id, contacto_nombre, estado, fecha_programada, creado_por)
  VALUES (v_empresa_id, v_contacto_id, 'Cliente Test', 'programada', now(), v_user_id)
  RETURNING id INTO v_visita_id;
  SELECT estado_clave INTO v_clave FROM public.visitas WHERE id = v_visita_id;
  IF v_clave <> 'programada' THEN RAISE EXCEPTION 'TEST 1 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT sincroniza';

  -- TEST 2
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.visitas SET estado = 'en_camino' WHERE id = v_visita_id;
  SELECT count(*), max(origen) INTO v_count, v_origen FROM public.cambios_estado
  WHERE empresa_id = v_empresa_id AND entidad_tipo = 'visita';
  IF v_count <> 1 OR v_origen <> 'sistema' THEN RAISE EXCEPTION 'TEST 2 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE registra cambio';

  -- TEST 3
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_visita_id AND grupo_anterior = 'inicial' AND grupo_nuevo = 'activo';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 3 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 3 OK: grupos snapshoteados (inicial→activo)';

  -- TEST 4
  UPDATE public.visitas SET estado_clave = 'en_sitio' WHERE id = v_visita_id;
  SELECT estado INTO v_clave FROM public.visitas WHERE id = v_visita_id;
  IF v_clave <> 'en_sitio' THEN RAISE EXCEPTION 'TEST 4 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 4 OK: bidireccional estado_clave→estado';

  -- TEST 5
  IF NOT public.validar_transicion_estado(v_empresa_id, 'visita', 'programada', 'en_camino') THEN
    RAISE EXCEPTION 'TEST 5.1 FALLÓ'; END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'visita', 'programada', 'completada') THEN
    RAISE EXCEPTION 'TEST 5.2 FALLÓ: programada→completada NO debió validar'; END IF;
  RAISE NOTICE 'TEST 5 OK: catálogo de transiciones';

  -- TEST 6
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'visita', 'programada');
  IF v_count <> 3 THEN RAISE EXCEPTION 'TEST 6 FALLÓ: %', v_count; END IF;
  RAISE NOTICE 'TEST 6 OK: 3 acciones disponibles desde programada';

  -- TEST 7
  BEGIN
    UPDATE public.visitas SET estado_clave = 'inexistente' WHERE id = v_visita_id;
    RAISE EXCEPTION 'TEST 7 FALLÓ';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%clave de estado inválida%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 7 OK: clave inválida rechazada';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DEL PR 8 (VISITAS) PASARON';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $tests$;

ROLLBACK;
