-- =============================================================
-- Migración 044: Infraestructura genérica de estados y transiciones
-- =============================================================
-- Esta migración crea la base sobre la que se apoyan todas las
-- entidades con estado en Flux (presupuestos, órdenes, visitas,
-- conversaciones, asistencias, cuotas, actividades, etc.) y deja
-- preparado el terreno para el módulo futuro de workflows /
-- automatizaciones.
--
-- Componentes:
--   1) Tabla `cambios_estado`        — auditoría unificada de cambios
--                                      de estado de cualquier entidad.
--                                      Fuente única de eventos para
--                                      el motor de workflows.
--   2) Tabla `transiciones_estado`   — catálogo de transiciones
--                                      válidas por entidad. Se usa
--                                      para validar y para generar
--                                      el catálogo de triggers que
--                                      el editor de workflows expone.
--   3) Funciones SQL genéricas       — `registrar_cambio_estado()`
--                                      y `validar_transicion_estado()`
--                                      que cualquier entidad invoca
--                                      desde sus propios triggers.
--
-- Convenciones de claves de estado:
--   - snake_case técnico en BD (ej: 'en_almuerzo', 'en_espera').
--   - Verbo en participio o estado descriptivo. Nunca gerundios
--     sueltos ni sustantivos puros.
--
-- Convenciones de grupo (semántica para workflows):
--   - 'inicial'    — estado inicial al crear (ej: borrador, abierta).
--   - 'activo'     — entidad en uso normal.
--   - 'espera'     — bloqueada esperando algo externo.
--   - 'completado' — terminó exitosamente.
--   - 'cancelado'  — se canceló o rechazó.
--   - 'error'      — terminó con error o se auto-cerró por fallo.
--
-- Esta migración NO toca ninguna entidad existente. Se construye
-- aditivamente. Las migraciones siguientes (045+) van a conectar
-- cada entidad una por una a esta infraestructura.
-- =============================================================


-- =============================================================
-- 1) Tabla `cambios_estado`
-- =============================================================
-- Cada vez que una entidad cambia de estado se registra un row en
-- esta tabla. Es la fuente de eventos que el motor de workflows va
-- a consumir cuando se construya. También sirve como historial /
-- timeline visible al usuario.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.cambios_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Identificación de la entidad que cambió.
  -- entidad_tipo es el discriminador genérico ('presupuesto', 'orden',
  -- 'visita', 'conversacion', 'asistencia', 'cuota', 'actividad', ...).
  -- Se mantiene como text (no enum) para que agregar entidades nuevas
  -- no requiera migrar este enum.
  entidad_tipo text NOT NULL,
  entidad_id uuid NOT NULL,

  -- Cambio: clave del estado antes y después.
  -- estado_anterior es NULL cuando es la creación inicial (no había
  -- estado previo). En cambios subsiguientes, ambos están presentes.
  estado_anterior text,
  estado_nuevo text NOT NULL,

  -- Snapshot del grupo (semántica) en el momento del cambio.
  -- Se persiste para que reportes históricos no dependan del estado
  -- actual de la tabla `estados_<entidad>` (que puede mutar).
  grupo_anterior text,
  grupo_nuevo text,

  -- Origen del cambio. Le permite al usuario y a workflows distinguir
  -- entre acciones manuales y automáticas.
  --   'manual'    — usuario lo cambió desde la UI.
  --   'sistema'   — disparado por lógica interna (auto-transición).
  --   'workflow'  — disparado por una automatización configurada.
  --   'api'       — invocado desde una API externa.
  --   'webhook'   — proveniente de webhook entrante (Meta, etc).
  --   'cron'      — job programado (vencimientos, recordatorios).
  origen text NOT NULL DEFAULT 'manual',

  -- Quién hizo el cambio. NULL si fue sistema/workflow/cron sin
  -- usuario asociado. Snapshot del nombre para que el historial
  -- sea legible aunque el usuario sea borrado.
  usuario_id uuid,
  usuario_nombre text,

  -- Motivo opcional del cambio. Útil para transiciones que requieren
  -- justificación (cancelaciones, rechazos, reprogramaciones).
  motivo text,

  -- Metadatos flexibles para que workflows guarden información extra
  -- (ej: regla_id, flujo_id, condiciones evaluadas, etc.).
  metadatos jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Snapshot de campos relevantes de la entidad al momento del cambio.
  -- Permite que reportes históricos no dependan del estado actual de
  -- la entidad (que puede ser editada o eliminada).
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,

  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- Historial completo de una entidad puntual (lo que muestra el chatter).
CREATE INDEX IF NOT EXISTS cambios_estado_entidad_idx
  ON public.cambios_estado (empresa_id, entidad_tipo, entidad_id, creado_en DESC);

-- Feed por tipo de entidad (ej: "todos los cambios de presupuestos hoy").
CREATE INDEX IF NOT EXISTS cambios_estado_tipo_idx
  ON public.cambios_estado (empresa_id, entidad_tipo, creado_en DESC);

-- Feed por estado destino (clave para workflows: "los que pasaron a aceptado").
CREATE INDEX IF NOT EXISTS cambios_estado_estado_nuevo_idx
  ON public.cambios_estado (empresa_id, entidad_tipo, estado_nuevo, creado_en DESC);

-- Auditar lo que viene de workflows vs manual.
CREATE INDEX IF NOT EXISTS cambios_estado_origen_idx
  ON public.cambios_estado (empresa_id, origen, creado_en DESC);

-- Para Realtime / CDC. Permite que el motor de workflows escuche los
-- INSERTs de esta tabla y dispare flujos automáticamente.
ALTER TABLE public.cambios_estado REPLICA IDENTITY FULL;

-- RLS multi-tenant --
ALTER TABLE public.cambios_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cambios_estado_select" ON public.cambios_estado
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "cambios_estado_insert" ON public.cambios_estado
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

-- Los cambios de estado son inmutables: no se pueden editar ni eliminar
-- desde la app. Si hace falta corregir uno, se hace con un nuevo
-- registro que documente la corrección. Esto preserva la auditoría.
-- (Solo SECURITY DEFINER puede tocarlos, lo cual está restringido.)


-- =============================================================
-- 2) Tabla `transiciones_estado`
-- =============================================================
-- Define qué transiciones son legales para cada tipo de entidad.
-- Se siembran transiciones del sistema (empresa_id IS NULL) y cada
-- empresa puede agregar las suyas. La validación API y el catálogo
-- de triggers de workflows leen de acá.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.transiciones_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- empresa_id NULL = transición del sistema (válida para todas las
  -- empresas). empresa_id presente = transición personalizada.
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,

  entidad_tipo text NOT NULL,

  -- desde_clave NULL = "transición desde cualquier estado".
  -- Útil para transiciones de tipo "Cancelar" que se permiten desde
  -- múltiples estados, o para definir el estado inicial al crear.
  desde_clave text,
  hasta_clave text NOT NULL,

  -- Etiqueta amigable de la transición ("Enviar presupuesto",
  -- "Aceptar", "Cancelar", "Marcar como completada").
  etiqueta text,
  descripcion text,

  -- Si la transición la dispara el sistema sin intervención del
  -- usuario (ej: vencimiento por fecha, auto-completar, etc.).
  es_automatica boolean NOT NULL DEFAULT false,

  -- Si requiere que el usuario ingrese un motivo obligatorio.
  -- Útil para cancelaciones / rechazos / reprogramaciones.
  requiere_motivo boolean NOT NULL DEFAULT false,

  -- Si requiere confirmación explícita del usuario antes de aplicarse.
  requiere_confirmacion boolean NOT NULL DEFAULT false,

  -- Condiciones declarativas opcionales (futuro). Array de objetos
  -- {campo, operador, valor} que el motor puede evaluar antes de
  -- permitir la transición. Por ahora se deja vacío.
  condiciones jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Orden de aparición en la UI (al mostrar acciones disponibles).
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- Lookup rápido al validar una transición específica.
CREATE INDEX IF NOT EXISTS transiciones_estado_lookup_idx
  ON public.transiciones_estado (entidad_tipo, desde_clave, hasta_clave)
  WHERE activo = true;

-- Lookup por empresa para listar transiciones disponibles.
CREATE INDEX IF NOT EXISTS transiciones_estado_empresa_idx
  ON public.transiciones_estado (empresa_id, entidad_tipo)
  WHERE activo = true;

-- Constraint de unicidad: por empresa+entidad+desde+hasta no puede
-- haber más de una. Usamos COALESCE para tratar NULLs como valores
-- comparables (PostgreSQL los considera distintos por defecto).
CREATE UNIQUE INDEX IF NOT EXISTS transiciones_estado_unique_idx
  ON public.transiciones_estado (
    COALESCE(empresa_id::text, '__sistema__'),
    entidad_tipo,
    COALESCE(desde_clave, '__cualquiera__'),
    hasta_clave
  );

-- RLS multi-tenant --
ALTER TABLE public.transiciones_estado ENABLE ROW LEVEL SECURITY;

-- SELECT: la empresa ve sus propias + las del sistema (empresa_id IS NULL).
CREATE POLICY "transiciones_estado_select" ON public.transiciones_estado
  FOR SELECT USING (
    empresa_id IS NULL OR empresa_id = empresa_actual()
  );

-- INSERT/UPDATE/DELETE: solo las propias (las del sistema se gestionan
-- por seed/migraciones, no por la app).
CREATE POLICY "transiciones_estado_insert" ON public.transiciones_estado
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "transiciones_estado_update" ON public.transiciones_estado
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "transiciones_estado_delete" ON public.transiciones_estado
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 3) Función `registrar_cambio_estado`
-- =============================================================
-- Inserta un row en `cambios_estado`. Diseñada para ser llamada
-- desde los triggers de cada entidad cuando detectan un cambio
-- en su columna de estado.
--
-- SECURITY DEFINER: salta RLS para que pueda escribir desde
-- triggers internos. Valida manualmente el empresa_id.
--
-- Devuelve el id del registro creado.
-- =============================================================
CREATE OR REPLACE FUNCTION public.registrar_cambio_estado(
  p_empresa_id uuid,
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_estado_anterior text,
  p_estado_nuevo text,
  p_grupo_anterior text DEFAULT NULL,
  p_grupo_nuevo text DEFAULT NULL,
  p_origen text DEFAULT 'manual',
  p_usuario_id uuid DEFAULT NULL,
  p_usuario_nombre text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_metadatos jsonb DEFAULT '{}'::jsonb,
  p_contexto jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validaciones mínimas: empresa, tipo, entidad y estado nuevo son obligatorios.
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'registrar_cambio_estado: empresa_id es obligatorio';
  END IF;
  IF p_entidad_tipo IS NULL OR length(trim(p_entidad_tipo)) = 0 THEN
    RAISE EXCEPTION 'registrar_cambio_estado: entidad_tipo es obligatorio';
  END IF;
  IF p_entidad_id IS NULL THEN
    RAISE EXCEPTION 'registrar_cambio_estado: entidad_id es obligatorio';
  END IF;
  IF p_estado_nuevo IS NULL OR length(trim(p_estado_nuevo)) = 0 THEN
    RAISE EXCEPTION 'registrar_cambio_estado: estado_nuevo es obligatorio';
  END IF;

  -- No-op si el estado no cambió realmente (evita ruido en historial).
  IF p_estado_anterior IS NOT DISTINCT FROM p_estado_nuevo THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.cambios_estado (
    empresa_id,
    entidad_tipo,
    entidad_id,
    estado_anterior,
    estado_nuevo,
    grupo_anterior,
    grupo_nuevo,
    origen,
    usuario_id,
    usuario_nombre,
    motivo,
    metadatos,
    contexto
  ) VALUES (
    p_empresa_id,
    p_entidad_tipo,
    p_entidad_id,
    p_estado_anterior,
    p_estado_nuevo,
    p_grupo_anterior,
    p_grupo_nuevo,
    COALESCE(p_origen, 'manual'),
    p_usuario_id,
    p_usuario_nombre,
    p_motivo,
    COALESCE(p_metadatos, '{}'::jsonb),
    COALESCE(p_contexto, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- =============================================================
-- 4) Función `validar_transicion_estado`
-- =============================================================
-- Verifica si una transición es legal según el catálogo
-- `transiciones_estado`. Considera tanto las del sistema (empresa_id
-- IS NULL) como las propias de la empresa.
--
-- La validación pasa si existe al menos una row activa cuyo
-- desde_clave coincida con el estado actual O sea NULL ("desde
-- cualquier estado").
-- =============================================================
CREATE OR REPLACE FUNCTION public.validar_transicion_estado(
  p_empresa_id uuid,
  p_entidad_tipo text,
  p_desde_clave text,
  p_hasta_clave text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe boolean;
BEGIN
  IF p_entidad_tipo IS NULL OR p_hasta_clave IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.transiciones_estado
    WHERE entidad_tipo = p_entidad_tipo
      AND hasta_clave = p_hasta_clave
      AND (desde_clave = p_desde_clave OR desde_clave IS NULL)
      AND (empresa_id = p_empresa_id OR empresa_id IS NULL)
      AND activo = true
  ) INTO v_existe;

  RETURN COALESCE(v_existe, false);
END;
$$;


-- =============================================================
-- 5) Función `obtener_transiciones_disponibles`
-- =============================================================
-- Dado un estado actual, devuelve las transiciones disponibles
-- desde ese estado. Útil para que la UI sepa qué acciones mostrar.
-- =============================================================
CREATE OR REPLACE FUNCTION public.obtener_transiciones_disponibles(
  p_empresa_id uuid,
  p_entidad_tipo text,
  p_desde_clave text
)
RETURNS TABLE (
  id uuid,
  hasta_clave text,
  etiqueta text,
  descripcion text,
  es_automatica boolean,
  requiere_motivo boolean,
  requiere_confirmacion boolean,
  orden integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.hasta_clave,
    t.etiqueta,
    t.descripcion,
    t.es_automatica,
    t.requiere_motivo,
    t.requiere_confirmacion,
    t.orden
  FROM public.transiciones_estado t
  WHERE t.entidad_tipo = p_entidad_tipo
    AND (t.desde_clave = p_desde_clave OR t.desde_clave IS NULL)
    AND (t.empresa_id = p_empresa_id OR t.empresa_id IS NULL)
    AND t.activo = true
    AND t.es_automatica = false
  ORDER BY t.orden ASC, t.etiqueta ASC;
$$;


-- =============================================================
-- 6) Trigger: actualizar `actualizado_en` en transiciones_estado
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_transiciones_estado_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transiciones_estado_actualizar_timestamp ON public.transiciones_estado;
CREATE TRIGGER transiciones_estado_actualizar_timestamp
  BEFORE UPDATE ON public.transiciones_estado
  FOR EACH ROW EXECUTE FUNCTION public.tr_transiciones_estado_actualizar_timestamp();


-- =============================================================
-- 7) Permisos de ejecución
-- =============================================================
-- Por default, las funciones se crean con EXECUTE para PUBLIC, lo que
-- en Supabase las hace callables por anon vía /rest/v1/rpc/*. Como
-- las nuestras son SECURITY DEFINER, hay que revocar PUBLIC y
-- conceder explícitamente solo a los roles que las necesitan.
-- =============================================================

-- registrar_cambio_estado: uso INTERNO únicamente. La invocan los
-- triggers de cada entidad cuando detectan un cambio de estado, y
-- esos triggers ya corren como propietario. NO se expone a roles
-- de aplicación: ningún caller externo debería poder fabricar
-- registros de auditoría manualmente.
REVOKE EXECUTE ON FUNCTION public.registrar_cambio_estado(
  uuid, text, uuid, text, text, text, text, text, uuid, text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

-- validar_transicion_estado: la app autenticada la usa antes de
-- aplicar un cambio de estado para verificar que la transición es
-- legal. Solo authenticated.
REVOKE EXECUTE ON FUNCTION public.validar_transicion_estado(
  uuid, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_transicion_estado(
  uuid, text, text, text
) TO authenticated, service_role;

-- obtener_transiciones_disponibles: la app autenticada la usa para
-- mostrar las acciones contextuales disponibles para una entidad.
-- Solo authenticated.
REVOKE EXECUTE ON FUNCTION public.obtener_transiciones_disponibles(
  uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_transiciones_disponibles(
  uuid, text, text
) TO authenticated, service_role;


-- =============================================================
-- Comentarios de documentación en las tablas y funciones.
-- =============================================================
COMMENT ON TABLE public.cambios_estado IS
  'Auditoría unificada de cambios de estado de cualquier entidad de Flux. Fuente única de eventos para el motor de workflows futuro.';

COMMENT ON COLUMN public.cambios_estado.entidad_tipo IS
  'Discriminador genérico: presupuesto | orden | visita | conversacion | asistencia | cuota | actividad | etc.';

COMMENT ON COLUMN public.cambios_estado.origen IS
  'Quién originó el cambio: manual | sistema | workflow | api | webhook | cron';

COMMENT ON COLUMN public.cambios_estado.grupo_nuevo IS
  'Snapshot del grupo (inicial | activo | espera | completado | cancelado | error) al momento del cambio';

COMMENT ON TABLE public.transiciones_estado IS
  'Catálogo de transiciones de estado válidas por entidad. Sirve para validación API y catálogo de triggers de workflows. empresa_id NULL = transición del sistema.';

COMMENT ON COLUMN public.transiciones_estado.desde_clave IS
  'Estado de origen de la transición. NULL = desde cualquier estado.';

COMMENT ON FUNCTION public.registrar_cambio_estado IS
  'Inserta un row en cambios_estado. Usado desde triggers de cada entidad. SECURITY DEFINER para saltar RLS desde triggers internos.';

COMMENT ON FUNCTION public.validar_transicion_estado IS
  'Verifica si una transición es legal según transiciones_estado. Considera transiciones del sistema (empresa_id IS NULL) y propias.';

COMMENT ON FUNCTION public.obtener_transiciones_disponibles IS
  'Devuelve las transiciones manuales disponibles desde un estado actual. Usado por la UI para mostrar acciones contextuales.';
