-- =============================================================
-- Tests de la migración 044: infraestructura de estados
-- =============================================================
-- Cómo correrlo (modo seguro, en transacción que se revierte):
--
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f sql/tests/044_estados_infraestructura.test.sql
--
-- El archivo ejecuta todos los tests dentro de una transacción y
-- al final hace ROLLBACK. Si algún test falla, RAISE EXCEPTION
-- aborta la transacción y deja la BD intacta.
-- =============================================================

BEGIN;

-- Empresa de prueba (los datos se borran al rollback).
INSERT INTO public.empresas (id, nombre, slug)
VALUES (
  '00000000-0000-0000-0000-00000000a044',
  'Empresa Test 044',
  'test-044-' || extract(epoch from now())::text
);

-- Variables compartidas entre tests.
DO $$
DECLARE
  v_empresa_id uuid := '00000000-0000-0000-0000-00000000a044';
  v_otra_empresa_id uuid := '00000000-0000-0000-0000-00000000b044';
  v_entidad_id uuid := gen_random_uuid();
  v_cambio_id uuid;
  v_count integer;
  v_existe boolean;
BEGIN

  -- ─── TEST 1: registrar_cambio_estado inserta correctamente ───
  v_cambio_id := public.registrar_cambio_estado(
    p_empresa_id      => v_empresa_id,
    p_entidad_tipo    => 'presupuesto',
    p_entidad_id      => v_entidad_id,
    p_estado_anterior => 'borrador',
    p_estado_nuevo    => 'enviado',
    p_grupo_anterior  => 'inicial',
    p_grupo_nuevo     => 'activo',
    p_origen          => 'manual'
  );

  IF v_cambio_id IS NULL THEN
    RAISE EXCEPTION 'TEST 1 FALLÓ: registrar_cambio_estado devolvió NULL en cambio válido';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cambios_estado
  WHERE id = v_cambio_id
    AND empresa_id = v_empresa_id
    AND entidad_tipo = 'presupuesto'
    AND entidad_id = v_entidad_id
    AND estado_anterior = 'borrador'
    AND estado_nuevo = 'enviado'
    AND origen = 'manual';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FALLÓ: el cambio no quedó persistido correctamente';
  END IF;

  RAISE NOTICE 'TEST 1 OK: registrar_cambio_estado inserta correctamente';

  -- ─── TEST 2: no-op cuando estado no cambió ───
  v_cambio_id := public.registrar_cambio_estado(
    p_empresa_id      => v_empresa_id,
    p_entidad_tipo    => 'presupuesto',
    p_entidad_id      => v_entidad_id,
    p_estado_anterior => 'enviado',
    p_estado_nuevo    => 'enviado'
  );

  IF v_cambio_id IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 2 FALLÓ: registrar_cambio_estado debió retornar NULL cuando no hay cambio real';
  END IF;

  RAISE NOTICE 'TEST 2 OK: no-op cuando estado no cambia';

  -- ─── TEST 3: validaciones de obligatoriedad ───
  BEGIN
    v_cambio_id := public.registrar_cambio_estado(
      p_empresa_id      => NULL,
      p_entidad_tipo    => 'presupuesto',
      p_entidad_id      => v_entidad_id,
      p_estado_anterior => 'borrador',
      p_estado_nuevo    => 'enviado'
    );
    RAISE EXCEPTION 'TEST 3 FALLÓ: debió fallar con empresa_id NULL';
  EXCEPTION WHEN raise_exception THEN
    -- esperado
    NULL;
  END;

  BEGIN
    v_cambio_id := public.registrar_cambio_estado(
      p_empresa_id      => v_empresa_id,
      p_entidad_tipo    => '',
      p_entidad_id      => v_entidad_id,
      p_estado_anterior => 'borrador',
      p_estado_nuevo    => 'enviado'
    );
    RAISE EXCEPTION 'TEST 3 FALLÓ: debió fallar con entidad_tipo vacío';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;

  BEGIN
    v_cambio_id := public.registrar_cambio_estado(
      p_empresa_id      => v_empresa_id,
      p_entidad_tipo    => 'presupuesto',
      p_entidad_id      => v_entidad_id,
      p_estado_anterior => 'borrador',
      p_estado_nuevo    => NULL
    );
    RAISE EXCEPTION 'TEST 3 FALLÓ: debió fallar con estado_nuevo NULL';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;

  RAISE NOTICE 'TEST 3 OK: validaciones de obligatoriedad funcionan';

  -- ─── TEST 4: estado_anterior NULL es válido (creación inicial) ───
  v_cambio_id := public.registrar_cambio_estado(
    p_empresa_id      => v_empresa_id,
    p_entidad_tipo    => 'orden',
    p_entidad_id      => gen_random_uuid(),
    p_estado_anterior => NULL,
    p_estado_nuevo    => 'abierta',
    p_grupo_nuevo     => 'inicial',
    p_origen          => 'sistema'
  );

  IF v_cambio_id IS NULL THEN
    RAISE EXCEPTION 'TEST 4 FALLÓ: debió permitir estado_anterior NULL en creación';
  END IF;

  RAISE NOTICE 'TEST 4 OK: estado_anterior NULL permitido en creación';

  -- ─── TEST 5: validar_transicion_estado con transición de sistema ───
  -- Insertamos transición de sistema (empresa_id NULL).
  INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta)
  VALUES (NULL, 'presupuesto', 'borrador', 'enviado', 'Enviar');

  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'borrador', 'enviado');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 5 FALLÓ: transición de sistema no validó';
  END IF;

  -- Otra empresa también ve la del sistema.
  v_existe := public.validar_transicion_estado(v_otra_empresa_id, 'presupuesto', 'borrador', 'enviado');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 5 FALLÓ: transición de sistema no es vista por otra empresa';
  END IF;

  RAISE NOTICE 'TEST 5 OK: transiciones de sistema validan correctamente';

  -- ─── TEST 6: transición desde "cualquier estado" (desde_clave NULL) ───
  INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, requiere_motivo)
  VALUES (NULL, 'presupuesto', NULL, 'cancelado', 'Cancelar', true);

  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'borrador', 'cancelado');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 6 FALLÓ: transición desde cualquier estado no validó (desde borrador)';
  END IF;

  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'enviado', 'cancelado');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 6 FALLÓ: transición desde cualquier estado no validó (desde enviado)';
  END IF;

  RAISE NOTICE 'TEST 6 OK: desde_clave NULL = transición desde cualquier estado';

  -- ─── TEST 7: transición inválida devuelve false ───
  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'enviado', 'borrador');
  IF v_existe THEN
    RAISE EXCEPTION 'TEST 7 FALLÓ: transición no registrada debió devolver false';
  END IF;

  v_existe := public.validar_transicion_estado(v_empresa_id, 'orden', 'abierta', 'completada');
  IF v_existe THEN
    RAISE EXCEPTION 'TEST 7 FALLÓ: transición de otro entidad_tipo no debió validar';
  END IF;

  RAISE NOTICE 'TEST 7 OK: transiciones inválidas devuelven false';

  -- ─── TEST 8: transición propia de empresa coexiste con la del sistema ───
  INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta)
  VALUES (v_empresa_id, 'presupuesto', 'enviado', 'aceptado', 'Aceptar (propia)');

  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'enviado', 'aceptado');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 8 FALLÓ: transición propia de empresa no validó';
  END IF;

  -- Otra empresa NO ve la transición propia de v_empresa_id.
  v_existe := public.validar_transicion_estado(v_otra_empresa_id, 'presupuesto', 'enviado', 'aceptado');
  IF v_existe THEN
    RAISE EXCEPTION 'TEST 8 FALLÓ: otra empresa no debió ver la transición propia ajena';
  END IF;

  RAISE NOTICE 'TEST 8 OK: transiciones propias de empresa son aisladas correctamente';

  -- ─── TEST 9: unicidad de transiciones (mismo empresa+entidad+desde+hasta) ───
  BEGIN
    INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave)
    VALUES (NULL, 'presupuesto', 'borrador', 'enviado');
    RAISE EXCEPTION 'TEST 9 FALLÓ: debió fallar por violación de unicidad';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- También con desde_clave NULL.
  BEGIN
    INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave)
    VALUES (NULL, 'presupuesto', NULL, 'cancelado');
    RAISE EXCEPTION 'TEST 9 FALLÓ: debió fallar por unicidad con NULLs (vía COALESCE)';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RAISE NOTICE 'TEST 9 OK: unicidad de transiciones funciona (incluso con NULLs)';

  -- ─── TEST 10: obtener_transiciones_disponibles ───
  -- Desde 'enviado' debería devolver: aceptado (propia) + cancelado (sistema, desde NULL).
  -- 'enviar' (borrador → enviado) no aparece porque desde_clave es 'borrador'.
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'presupuesto', 'enviado');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 10 FALLÓ: obtener_transiciones_disponibles devolvió % rows, se esperaban 2', v_count;
  END IF;

  RAISE NOTICE 'TEST 10 OK: obtener_transiciones_disponibles filtra correctamente';

  -- ─── TEST 11: transiciones automáticas excluidas de "disponibles" ───
  INSERT INTO public.transiciones_estado (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica)
  VALUES (NULL, 'presupuesto', 'enviado', 'vencido', 'Vencer', true);

  -- La automatica no debe aparecer en disponibles para usuario.
  SELECT count(*) INTO v_count
  FROM public.obtener_transiciones_disponibles(v_empresa_id, 'presupuesto', 'enviado');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 11 FALLÓ: transición automática no debió aparecer en disponibles (% rows)', v_count;
  END IF;

  -- Pero validar_transicion_estado igual la considera válida (workflows pueden invocarla).
  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'enviado', 'vencido');
  IF NOT v_existe THEN
    RAISE EXCEPTION 'TEST 11 FALLÓ: validar_transicion_estado debió aceptar la automática';
  END IF;

  RAISE NOTICE 'TEST 11 OK: transiciones automáticas se excluyen de disponibles para usuario';

  -- ─── TEST 12: validar_transicion_estado con args inválidos devuelve false ───
  v_existe := public.validar_transicion_estado(v_empresa_id, NULL, 'borrador', 'enviado');
  IF v_existe THEN
    RAISE EXCEPTION 'TEST 12 FALLÓ: entidad_tipo NULL debió devolver false';
  END IF;

  v_existe := public.validar_transicion_estado(v_empresa_id, 'presupuesto', 'borrador', NULL);
  IF v_existe THEN
    RAISE EXCEPTION 'TEST 12 FALLÓ: hasta_clave NULL debió devolver false';
  END IF;

  RAISE NOTICE 'TEST 12 OK: validar_transicion_estado tolera args inválidos';

  -- ─── TEST 13: CASCADE — borrar empresa elimina sus cambios_estado ───
  -- Verifica el ON DELETE CASCADE de cambios_estado.empresa_id.
  -- (No testeamos el trigger de actualizado_en porque now() devuelve el
  --  mismo timestamp en INSERT y UPDATE dentro de la misma transacción;
  --  ese trigger se valida en uso real, no acá.)
  DECLARE
    v_empresa_temporal uuid := gen_random_uuid();
    v_count_antes integer;
    v_count_despues integer;
  BEGIN
    INSERT INTO public.empresas (id, nombre, slug)
    VALUES (v_empresa_temporal, 'Empresa CASCADE Test', 'cascade-test-' || extract(epoch from now())::text);

    PERFORM public.registrar_cambio_estado(
      v_empresa_temporal, 'asistencia', gen_random_uuid(), NULL, 'activo',
      NULL, 'inicial', 'sistema'
    );

    SELECT count(*) INTO v_count_antes
    FROM public.cambios_estado WHERE empresa_id = v_empresa_temporal;
    IF v_count_antes <> 1 THEN
      RAISE EXCEPTION 'TEST 13 FALLÓ: setup no insertó el cambio (% rows)', v_count_antes;
    END IF;

    DELETE FROM public.empresas WHERE id = v_empresa_temporal;

    SELECT count(*) INTO v_count_despues
    FROM public.cambios_estado WHERE empresa_id = v_empresa_temporal;
    IF v_count_despues <> 0 THEN
      RAISE EXCEPTION 'TEST 13 FALLÓ: CASCADE no eliminó cambios_estado (% rows)', v_count_despues;
    END IF;

    RAISE NOTICE 'TEST 13 OK: CASCADE elimina cambios_estado al borrar empresa';
  END;

  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '  TODOS LOS TESTS DE 044 PASARON';
  RAISE NOTICE '════════════════════════════════════════════════════';

END $$;

ROLLBACK;
