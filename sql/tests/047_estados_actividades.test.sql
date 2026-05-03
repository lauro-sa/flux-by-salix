-- =============================================================
-- Tests de la migración 047: actividades conectadas al sistema genérico
-- =============================================================
-- Cómo correrlo:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f sql/tests/047_estados_actividades.test.sql
--
-- Cubre:
--   - INSERT de actividad
--   - UPDATE estado_clave dispara cambio en cambios_estado
--   - Snapshot de grupo (activo→completado)
--   - validar_transicion_estado contra catálogo del sistema
--   - obtener_transiciones_disponibles (excluye automáticas como 'vencida')
--   - UPDATE estado_id sincroniza estado_clave
--   - estado_anterior_id se captura en cada cambio
-- =============================================================

BEGIN;

DO $tests$
DECLARE
  v_empresa_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_tipo_id uuid;
  v_estado_pendiente_id uuid;
  v_estado_completada_id uuid;
  v_actividad_id uuid;
  v_count integer;
  v_clave text;
  v_ant uuid;
BEGIN
  INSERT INTO public.empresas (id, nombre, slug)
  VALUES (v_empresa_id, 'Empresa Test 047', 'test-047-' || extract(epoch from now())::text);

  -- Limpiar lo que el trigger de empresa pueda haber sembrado
  DELETE FROM public.estados_actividad WHERE empresa_id = v_empresa_id;
  DELETE FROM public.tipos_actividad WHERE empresa_id = v_empresa_id;

  INSERT INTO public.tipos_actividad (empresa_id, clave, etiqueta, es_predefinido)
  VALUES (v_empresa_id, 'tarea_test', 'Tarea Test', true)
  RETURNING id INTO v_tipo_id;

  INSERT INTO public.estados_actividad (empresa_id, clave, etiqueta, grupo, es_predefinido)
  VALUES (v_empresa_id, 'pendiente', 'Pendiente', 'activo', true)
  RETURNING id INTO v_estado_pendiente_id;

  INSERT INTO public.estados_actividad (empresa_id, clave, etiqueta, grupo, es_predefinido)
  VALUES (v_empresa_id, 'completada', 'Completada', 'completado', true)
  RETURNING id INTO v_estado_completada_id;

  INSERT INTO public.actividades (empresa_id, titulo, tipo_id, tipo_clave, estado_id, estado_clave, creado_por)
  VALUES (v_empresa_id, 'Llamar cliente', v_tipo_id, 'tarea_test', v_estado_pendiente_id, 'pendiente', v_user_id)
  RETURNING id INTO v_actividad_id;
  RAISE NOTICE 'TEST 1 OK: Actividad creada en pendiente';

  -- TEST 2: UPDATE estado_clave registra cambio
  DELETE FROM public.cambios_estado WHERE empresa_id = v_empresa_id;
  UPDATE public.actividades SET estado_clave = 'completada' WHERE id = v_actividad_id;
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE empresa_id = v_empresa_id AND entidad_tipo = 'actividad'
    AND estado_anterior = 'pendiente' AND estado_nuevo = 'completada';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 2 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 2 OK: UPDATE estado_clave registra cambio en cambios_estado';

  -- TEST 3: grupos snapshoteados
  SELECT count(*) INTO v_count FROM public.cambios_estado
  WHERE entidad_id = v_actividad_id AND grupo_anterior = 'activo' AND grupo_nuevo = 'completado';
  IF v_count <> 1 THEN RAISE EXCEPTION 'TEST 3 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 3 OK: grupos snapshoteados';

  -- TEST 4: catálogo de transiciones del sistema
  IF NOT public.validar_transicion_estado(v_empresa_id, 'actividad', 'pendiente', 'completada') THEN
    RAISE EXCEPTION 'TEST 4.1 FALLÓ: pendiente→completada debió validar';
  END IF;
  IF public.validar_transicion_estado(v_empresa_id, 'actividad', 'completada', 'cancelada') THEN
    RAISE EXCEPTION 'TEST 4.2 FALLÓ: completada→cancelada NO debió validar';
  END IF;
  RAISE NOTICE 'TEST 4 OK: catálogo de transiciones del sistema';

  -- TEST 5: obtener_transiciones_disponibles excluye automáticas
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'actividad', 'pendiente');
  IF v_count <> 2 THEN RAISE EXCEPTION 'TEST 5 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 5 OK: 2 transiciones manuales desde pendiente (vencida es automática y se excluye)';

  -- TEST 6: UPDATE estado_id sincroniza estado_clave
  UPDATE public.actividades SET estado_id = v_estado_pendiente_id WHERE id = v_actividad_id;
  SELECT estado_clave INTO v_clave FROM public.actividades WHERE id = v_actividad_id;
  IF v_clave <> 'pendiente' THEN RAISE EXCEPTION 'TEST 6 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 6 OK: UPDATE estado_id sincroniza estado_clave';

  -- TEST 7: estado_anterior_id capturado
  SELECT estado_anterior_id INTO v_ant FROM public.actividades WHERE id = v_actividad_id;
  IF v_ant <> v_estado_completada_id THEN RAISE EXCEPTION 'TEST 7 FALLÓ'; END IF;
  RAISE NOTICE 'TEST 7 OK: estado_anterior_id capturado';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DEL PR 7 PASARON';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $tests$;

ROLLBACK;
