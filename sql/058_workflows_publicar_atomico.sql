-- =============================================================
-- Migración 058: Función atómica publicar_borrador_flujo (PR 18.2)
-- =============================================================
-- Operaciones que en TS requerirían SELECT + UPDATE separados —
-- abriendo una ventana de race entre el read del borrador y la
-- escritura sobre las columnas publicadas — se concentran acá en
-- un único UPDATE con guarda. Atrapa dos endpoints del PR 18.2:
--
--   POST /api/flujos/[id]/publicar         → activar = false
--   POST /api/flujos/[id]/activar (rama
--   "activar con borrador presente",
--   decisión B.1 del plan de scope)        → activar = true
--
-- Diseño:
--
--   1) UPDATE incondicional sobre las 4 columnas publicadas usando
--      `borrador_jsonb->'<campo>'`. COALESCE para que un borrador
--      mal formado (sin alguna sub-clave) no destruya la versión
--      publicada — preserva el campo previo en lugar de poner null.
--
--   2) Filtro `borrador_jsonb IS NOT NULL` en el WHERE. Si la fila
--      ya no tiene borrador (alguien lo descartó entre el SELECT
--      y este UPDATE), el RETURNING vuelve vacío y el endpoint
--      sirve un 409 con el estado actual en vez de pisar nada.
--
--   3) Filtro explícito `empresa_id = p_empresa_id`. Aunque la
--      función corre con SECURITY DEFINER (necesario porque el
--      caller es el cliente service_role del endpoint), la
--      pertenencia multi-tenant se valida acá adentro como segunda
--      línea de defensa. RLS de la tabla NO se evalúa en SECURITY
--      DEFINER, así que esto es la garantía real.
--
--   4) Cuando `p_activar = true`, el mismo UPDATE setea
--      `estado = 'activo'`. Operación "publicar + activar" cae
--      bajo una sola transacción atómica de Postgres — no hay
--      forma de quedar publicado sin activar (o vice versa) por
--      un fallo intermedio.
--
--   5) Auditoría queda en TS. La función NO inserta en
--      `auditoria_flujos`: el endpoint conoce el motivo, el
--      nombre del usuario y el bloque previo a publicar, y los
--      pasa a la tabla con un INSERT separado (mismo patrón que
--      el resto de los endpoints del PR 18). Mantenerlo así
--      evita acoplar el shape de auditoría al SQL.
-- =============================================================

CREATE OR REPLACE FUNCTION public.publicar_borrador_flujo(
  p_flujo_id uuid,
  p_empresa_id uuid,
  p_editado_por uuid,
  p_editado_por_nombre text,
  p_activar boolean
)
RETURNS public.flujos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flujo public.flujos;
BEGIN
  UPDATE public.flujos
  SET disparador  = COALESCE(borrador_jsonb->'disparador',  disparador),
      condiciones = COALESCE(borrador_jsonb->'condiciones', condiciones),
      acciones    = COALESCE(borrador_jsonb->'acciones',    acciones),
      nodos_json  = COALESCE(borrador_jsonb->'nodos_json',  nodos_json),
      borrador_jsonb = NULL,
      estado = CASE WHEN p_activar THEN 'activo' ELSE estado END,
      editado_por = p_editado_por,
      editado_por_nombre = p_editado_por_nombre
  WHERE id = p_flujo_id
    AND empresa_id = p_empresa_id      -- guarda multi-tenant manual
    AND borrador_jsonb IS NOT NULL     -- guarda atomicidad: nada que publicar
  RETURNING * INTO v_flujo;

  -- Si no matcheó nada (no existe / otra empresa / sin borrador),
  -- devolvemos NULL. El caller diferencia los 3 casos haciendo
  -- un SELECT posterior (existe? es de mi empresa? tiene borrador?).
  RETURN v_flujo;
END;
$$;

-- Permisos: la función bypassea RLS por ser SECURITY DEFINER, así
-- que el GRANT define el surface al que se puede llamar. authenticated
-- queda incluido para que un día (cuando haya endpoint cliente que
-- use sesión directa) funcione sin migrarse; service_role es el que
-- usa el clienteAdmin de los endpoints actuales.
REVOKE ALL ON FUNCTION public.publicar_borrador_flujo(uuid, uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publicar_borrador_flujo(uuid, uuid, uuid, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.publicar_borrador_flujo(uuid, uuid, uuid, text, boolean) IS
  'PR 18.2 — UPDATE atómico que mueve borrador_jsonb a las columnas publicadas y opcionalmente activa el flujo. Compactar publicar y publicar+activar en una sola transacción cierra la ventana de race entre SELECT y UPDATE. Auditoría queda en el endpoint, no acá.';
