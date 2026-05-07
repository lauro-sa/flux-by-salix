-- =============================================================
-- Migración 045: Estados configurables de cuotas (entidad piloto)
-- =============================================================
-- Conecta `presupuesto_cuotas` a la infraestructura genérica de
-- estados creada en 044. Es la primera entidad que se migra al
-- nuevo modelo, por lo que sirve como prueba del patrón.
--
-- Estrategia ADITIVA: la columna vieja `presupuesto_cuotas.estado`
-- se mantiene durante toda la transición. Las nuevas columnas
-- (`estado_id`, `estado_clave`, `estado_anterior_id`,
-- `estado_cambio_at`) se mantienen sincronizadas vía trigger en
-- ambas direcciones, así el código existente que escribe `estado`
-- sigue funcionando sin cambios y las nuevas lecturas pueden usar
-- las columnas modernas.
--
-- En el PR final de limpieza (futuro PR 9) se hará el drop de la
-- columna `estado`.
--
-- Particularidad de cuotas: todos los cambios de estado son
-- DERIVADOS automáticamente desde la función
-- `recalcular_estado_cuota`, no transiciones manuales. Por eso
-- todas las transiciones que se siembran tienen `es_automatica=true`
-- (no aparecen como acciones disponibles en la UI).
-- =============================================================


-- =============================================================
-- 1) Tabla `estados_cuota`
-- =============================================================
-- Sigue el patrón de `estados_actividad`: clave + etiqueta + grupo
-- + color + icono + orden + activo. La diferencia es que admite
-- empresa_id NULL para estados de sistema (visibles a todas las
-- empresas), igual que `transiciones_estado`.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.estados_cuota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- empresa_id NULL = estado del sistema (visible para todas).
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,

  clave text NOT NULL,
  etiqueta text NOT NULL,

  -- Grupo semántico (alineado con tipos.estados.GrupoEstado):
  -- inicial | activo | espera | completado | cancelado | error
  grupo text NOT NULL DEFAULT 'activo',

  icono text NOT NULL DEFAULT 'Circle',
  color text NOT NULL DEFAULT '#6b7280',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,

  -- Estados de sistema no se pueden eliminar/editar nombre desde la app.
  es_sistema boolean NOT NULL DEFAULT false,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Lookup rápido por (empresa, clave) — la app busca "el estado
-- pendiente para esta empresa" y prefiere el propio sobre el de sistema.
CREATE INDEX IF NOT EXISTS estados_cuota_empresa_idx
  ON public.estados_cuota (empresa_id, clave) WHERE activo = true;

-- Unicidad: por empresa+clave (con NULL = sistema) no puede haber dos.
CREATE UNIQUE INDEX IF NOT EXISTS estados_cuota_unique_idx
  ON public.estados_cuota (
    COALESCE(empresa_id::text, '__sistema__'),
    clave
  );

ALTER TABLE public.estados_cuota ENABLE ROW LEVEL SECURITY;

-- SELECT: la empresa ve sus propios + los del sistema.
CREATE POLICY "estados_cuota_select" ON public.estados_cuota
  FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual());

-- Modificar/borrar: solo los propios. Los del sistema se gestionan
-- por seed/migraciones, no desde la app.
CREATE POLICY "estados_cuota_insert" ON public.estados_cuota
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());
CREATE POLICY "estados_cuota_update" ON public.estados_cuota
  FOR UPDATE USING (empresa_id = empresa_actual() AND es_sistema = false);
CREATE POLICY "estados_cuota_delete" ON public.estados_cuota
  FOR DELETE USING (empresa_id = empresa_actual() AND es_sistema = false);


-- =============================================================
-- 2) Sembrar estados de sistema
-- =============================================================
-- Las cuotas tienen 3 estados, todos derivados automáticamente.
-- =============================================================
INSERT INTO public.estados_cuota (empresa_id, clave, etiqueta, grupo, icono, color, orden, es_sistema)
VALUES
  (NULL, 'pendiente', 'Pendiente',  'inicial',    'Circle',       '#6b7280', 1, true),
  (NULL, 'parcial',   'Parcial',    'activo',     'CircleDashed', '#d97706', 2, true),
  (NULL, 'cobrada',   'Cobrada',    'completado', 'CircleCheck',  '#16a34a', 3, true)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 3) Sembrar transiciones (todas automáticas — derivadas de pagos)
-- =============================================================
-- Documentamos las 6 transiciones posibles. Todas con
-- `es_automatica=true` porque el cambio lo dispara la función
-- recalcular_estado_cuota, no el usuario.
-- =============================================================
INSERT INTO public.transiciones_estado
  (empresa_id, entidad_tipo, desde_clave, hasta_clave, etiqueta, es_automatica, orden)
VALUES
  (NULL, 'cuota', 'pendiente', 'parcial',   'Pago parcial recibido',     true, 1),
  (NULL, 'cuota', 'pendiente', 'cobrada',   'Pago total recibido',       true, 2),
  (NULL, 'cuota', 'parcial',   'cobrada',   'Cuota completada',          true, 3),
  (NULL, 'cuota', 'parcial',   'pendiente', 'Pago revertido',            true, 4),
  (NULL, 'cuota', 'cobrada',   'parcial',   'Pago editado/eliminado',    true, 5),
  (NULL, 'cuota', 'cobrada',   'pendiente', 'Cobro revertido por completo', true, 6)
ON CONFLICT DO NOTHING;


-- =============================================================
-- 4) Nuevas columnas en `presupuesto_cuotas`
-- =============================================================
-- Todas nullable por ahora: el backfill las llena, después se
-- hacen NOT NULL en el cleanup final (PR 9).
-- =============================================================
ALTER TABLE public.presupuesto_cuotas
  ADD COLUMN IF NOT EXISTS estado_id          uuid REFERENCES public.estados_cuota(id),
  ADD COLUMN IF NOT EXISTS estado_clave       text,
  ADD COLUMN IF NOT EXISTS estado_anterior_id uuid REFERENCES public.estados_cuota(id),
  ADD COLUMN IF NOT EXISTS estado_cambio_at   timestamptz;

CREATE INDEX IF NOT EXISTS presupuesto_cuotas_estado_idx
  ON public.presupuesto_cuotas (empresa_id, estado_clave);


-- =============================================================
-- 5) Backfill — copiar `estado` viejo a las nuevas columnas
-- =============================================================
-- Mapea cada cuota existente al estado_id correspondiente y copia
-- la clave a `estado_clave`. Es idempotente (solo actualiza filas
-- donde estado_clave o estado_id están NULL).
-- =============================================================
UPDATE public.presupuesto_cuotas pc
SET
  estado_clave = pc.estado,
  estado_id = (
    SELECT ec.id FROM public.estados_cuota ec
    WHERE ec.clave = pc.estado AND ec.empresa_id IS NULL
    LIMIT 1
  ),
  estado_cambio_at = COALESCE(pc.fecha_cobro, now())
WHERE pc.estado_clave IS NULL OR pc.estado_id IS NULL;


-- =============================================================
-- 6) Función helper: resolver estado_id por clave
-- =============================================================
-- Lookup que prefiere el estado propio de la empresa por sobre el
-- del sistema. Usada por triggers y por código de aplicación.
-- =============================================================
CREATE OR REPLACE FUNCTION public.resolver_estado_cuota_id(
  p_empresa_id uuid,
  p_clave text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.estados_cuota
  WHERE clave = p_clave
    AND activo = true
    AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
  ORDER BY empresa_id NULLS LAST  -- prefiere el de empresa propia
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_estado_cuota_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_estado_cuota_id(uuid, text) TO authenticated, service_role;


-- =============================================================
-- 7) Trigger BEFORE INSERT OR UPDATE — sincronizar estado/estado_clave
-- =============================================================
-- Mantiene las dos columnas en sync (estado legacy ↔ estado_clave
-- nuevo) y deriva estado_id + estado_anterior_id + estado_cambio_at.
--
-- Reglas:
--  - Si solo cambió `estado` (código viejo): copiar a `estado_clave`.
--  - Si solo cambió `estado_clave` (código nuevo): copiar a `estado`.
--  - Si ambos cambiaron a valores distintos: prevalece `estado_clave`.
--  - estado_id se recalcula por lookup en estados_cuota.
--  - Si la clave cambió respecto al OLD: setear estado_anterior_id
--    y estado_cambio_at.
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_cuotas_sincronizar_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_clave text;
  v_id_resuelto uuid;
BEGIN
  -- Determinar la clave canónica a usar.
  IF TG_OP = 'INSERT' THEN
    -- Preferir estado_clave si vino, sino estado.
    v_clave := COALESCE(NEW.estado_clave, NEW.estado);
  ELSE
    -- UPDATE: si estado_clave cambió, ese es el nuevo valor.
    -- Si solo cambió estado, usar estado.
    IF NEW.estado_clave IS DISTINCT FROM OLD.estado_clave THEN
      v_clave := NEW.estado_clave;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_clave := NEW.estado;
    ELSE
      v_clave := COALESCE(NEW.estado_clave, NEW.estado);
    END IF;
  END IF;

  -- Sincronizar las dos columnas.
  NEW.estado_clave := v_clave;
  NEW.estado := v_clave;

  -- Resolver estado_id por lookup.
  v_id_resuelto := public.resolver_estado_cuota_id(NEW.empresa_id, v_clave);
  IF v_id_resuelto IS NULL THEN
    RAISE EXCEPTION 'tr_cuotas_sincronizar_estado: clave de estado inválida para cuota: %', v_clave;
  END IF;
  NEW.estado_id := v_id_resuelto;

  -- En UPDATE, si el estado_id cambió, registrar el cambio.
  IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
    NEW.estado_anterior_id := OLD.estado_id;
    NEW.estado_cambio_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cuotas_sincronizar_estado ON public.presupuesto_cuotas;
CREATE TRIGGER cuotas_sincronizar_estado
  BEFORE INSERT OR UPDATE ON public.presupuesto_cuotas
  FOR EACH ROW EXECUTE FUNCTION public.tr_cuotas_sincronizar_estado();


-- =============================================================
-- 8) Trigger AFTER UPDATE — registrar cambio en cambios_estado
-- =============================================================
-- Cuando cambia el estado_clave de una cuota, escribe un row en
-- la tabla genérica cambios_estado. Es el evento que el motor
-- futuro de workflows va a consumir.
--
-- Origen: 'sistema' porque las cuotas se actualizan derivadamente
-- desde la función recalcular_estado_cuota, no por edición directa
-- del usuario.
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_cuotas_registrar_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_grupo_anterior text;
  v_grupo_nuevo text;
  v_usuario_id uuid;
BEGIN
  -- No-op si la clave no cambió realmente.
  IF NEW.estado_clave IS NOT DISTINCT FROM OLD.estado_clave THEN
    RETURN NEW;
  END IF;

  -- Obtener grupos snapshot.
  SELECT grupo INTO v_grupo_anterior FROM public.estados_cuota WHERE id = OLD.estado_id;
  SELECT grupo INTO v_grupo_nuevo    FROM public.estados_cuota WHERE id = NEW.estado_id;

  -- Intentar capturar el usuario actual (puede ser NULL si lo dispara
  -- un job/cron/trigger interno).
  BEGIN
    v_usuario_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  PERFORM public.registrar_cambio_estado(
    p_empresa_id      => NEW.empresa_id,
    p_entidad_tipo    => 'cuota',
    p_entidad_id      => NEW.id,
    p_estado_anterior => OLD.estado_clave,
    p_estado_nuevo    => NEW.estado_clave,
    p_grupo_anterior  => v_grupo_anterior,
    p_grupo_nuevo     => v_grupo_nuevo,
    p_origen          => 'sistema',
    p_usuario_id      => v_usuario_id,
    p_metadatos       => jsonb_build_object(
      'presupuesto_id', NEW.presupuesto_id,
      'numero_cuota',   NEW.numero
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cuotas_registrar_cambio_estado ON public.presupuesto_cuotas;
CREATE TRIGGER cuotas_registrar_cambio_estado
  AFTER UPDATE ON public.presupuesto_cuotas
  FOR EACH ROW
  WHEN (OLD.estado_clave IS DISTINCT FROM NEW.estado_clave)
  EXECUTE FUNCTION public.tr_cuotas_registrar_cambio_estado();


-- =============================================================
-- 9) Trigger BEFORE INSERT/UPDATE de actualizado_en en estados_cuota
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_estados_cuota_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estados_cuota_actualizar_timestamp ON public.estados_cuota;
CREATE TRIGGER estados_cuota_actualizar_timestamp
  BEFORE UPDATE ON public.estados_cuota
  FOR EACH ROW EXECUTE FUNCTION public.tr_estados_cuota_actualizar_timestamp();


-- =============================================================
-- 10) Comentarios de documentación
-- =============================================================
COMMENT ON TABLE public.estados_cuota IS
  'Estados configurables de cuotas. empresa_id NULL = estado del sistema. Estados de sistema no editables desde la app.';

COMMENT ON COLUMN public.presupuesto_cuotas.estado_clave IS
  'Clave del estado actual (denormalizada de estados_cuota). Sincronizada automáticamente con estado (legacy) vía trigger durante la transición. Source of truth a futuro.';

COMMENT ON COLUMN public.presupuesto_cuotas.estado_id IS
  'FK a estados_cuota. Resuelto automáticamente vía trigger por lookup de estado_clave.';

COMMENT ON COLUMN public.presupuesto_cuotas.estado_anterior_id IS
  'FK al estado anterior, persistido por trigger cuando ocurre un cambio. Útil para reversas y reportes de transiciones.';

COMMENT ON FUNCTION public.resolver_estado_cuota_id IS
  'Lookup helper: resuelve estado_id a partir de la clave. Prefiere estado propio de empresa sobre el del sistema.';
