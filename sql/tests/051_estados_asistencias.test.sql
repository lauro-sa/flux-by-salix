-- Tests de la migración 051: estados configurables de asistencias.
BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_miembro_id uuid;
  v_asistencia_id uuid;
  v_count integer;
  v_clave text;
BEGIN
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 051', 'test-051-' || extract(epoch from now())::text);

  INSERT INTO public.miembros (empresa_id, rol, activo)
  VALUES (v_empresa_id, 'colaborador', true)
  RETURNING id INTO v_miembro_id;

  -- TEST 1
  INSERT INTO public.asistencias (empresa_id, miembro_id, fecha, estado, hora_entrada)
  VALUES (v_empresa_id, v_miembro_id, current_date, 'activo', now())
  RETURNING id INTO v_asistencia_id;
  SELECT estado_clave INTO v_clave FROM public.asistencias WHERE id = v_asistencia_id;
  IF v_clave <> 'activo' THEN RAISE EXCEPTION 'TEST 1 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 1 OK: INSERT sincroniza';

  -- TEST 2: alias 'almuerzo' se traduce a 'en_almuerzo'
  UPDATE public.asistencias SET estado = 'almuerzo' WHERE id = v_asistencia_id;
  SELECT estado_clave INTO v_clave FROM public.asistencias WHERE id = v_asistencia_id;
  IF v_clave <> 'en_almuerzo' THEN RAISE EXCEPTION 'TEST 2 FALLÓ: %', v_clave; END IF;
  RAISE NOTICE 'TEST 2 OK: alias almuerzo→en_almuerzo';

  -- TEST 3: alias 'particular' se traduce
  UPDATE public.asistencias SET estado = 'activo' WHERE id = v_asistencia_id;
  UPDATE public.asistencias SET estado = 'particular' WHERE id = v_asistencia_id;
  SELECT estado_clave INTO v_clave FROM public.asistencias WHERE id = v_asistencia_id;
  IF v_clave <> 'en_particular' THEN RAISE EXCEPTION 'TEST 3 FALLÓ: %', v_clave; END IF;
  RAISE NOTICE 'TEST 3 OK: alias particular→en_particular';

  -- TEST 4: registra cambios
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.asistencias SET estado = 'cerrado' WHERE id = v_asistencia_id;
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE empresa_id = v_empresa_id AND entidad_tipo = 'asistencia';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 4 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 4 OK: UPDATE registra cambio';

  -- TEST 5: catálogo solo acepta los nuevos
  IF NOT public.validar_transicion_estado(v_empresa_id, 'asistencia', 'activo', 'en_almuerzo') THEN
    RAISE EXCEPTION 'TEST 5.1 FALLÓ';
  END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'asistencia', 'activo', 'almuerzo') THEN
    RAISE EXCEPTION 'TEST 5.2 FALLÓ: catálogo no debe aceptar la clave vieja';
  END IF;
  RAISE NOTICE 'TEST 5 OK: catálogo solo acepta en_almuerzo/en_particular';

  RAISE NOTICE 'TODOS LOS TESTS DEL PR 11 PASARON';
END $tests$;

ROLLBACK;
