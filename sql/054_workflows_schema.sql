-- =============================================================
-- Migración 054: Schema base del motor de workflows (PR 13, fase 1)
-- =============================================================
-- Inicia la Fase 2 del refactor de estados configurables: motor de
-- automatizaciones / workflows. Esta migración crea ÚNICAMENTE el
-- schema de datos sobre el que después se construye el dispatcher
-- (PR 14), el worker (PR 15), las variables/contexto (PR 16), los
-- triggers de tiempo (PR 17) y los endpoints CRUD (PR 18). El editor
-- visual y la UI quedan diferidos a PR 19+ (decisión del usuario).
--
-- Componentes:
--   1) Tabla `flujos`              — definiciones de cada workflow
--                                    configurado por la empresa
--                                    (disparador + condiciones +
--                                    acciones, todo en jsonb).
--   2) Tabla `ejecuciones_flujo`   — log por cada ejecución concreta
--                                    de un flujo. Estado de la máquina
--                                    + timeline + dedupe.
--   3) Tabla `acciones_pendientes` — cola de acciones diferidas (delays
--                                    explícitos, programaciones futuras,
--                                    reintentos). El worker (PR 15) la
--                                    consume.
--
-- Decisiones de diseño aplicadas (ver docs/PLAN_AUTOMATIZACIONES.md):
--   - Multi-tenant con `empresa_id` y RLS usando `empresa_actual()`,
--     idéntico al resto del sistema (las 9 entidades migradas en PR 1-11.5
--     y `cambios_estado` / `transiciones_estado` del PR 1).
--   - El catálogo de tipos de disparador y de tipos de acción NO se
--     materializa en SQL (ni con CHECK ni con tabla separada). Vive en
--     TypeScript (`src/tipos/workflow.ts` en PR 14/15) y se valida en
--     runtime contra el jsonb. Mantiene flexibilidad mientras la lista
--     se sigue cerrando.
--   - `disparado_por` se persiste como `text` con formato discriminado
--     (`cambios_estado:<uuid>`, `cron:<expr>`, `manual:<user-id>`,
--     `webhook:<url>`), no como FK. Una FK lo amarraría a un único origen
--     y rompería los demás casos de uso del motor.
--   - REPLICA IDENTITY FULL en las 3 tablas: el dispatcher (PR 14) y el
--     worker (PR 15) se conectan vía Supabase Realtime / LISTEN-NOTIFY a
--     INSERT/UPDATE de estas tablas. Mismo patrón que `cambios_estado`.
--   - Sin CHECK en `estado` de ejecuciones / acciones_pendientes: se
--     valida en runtime (coherente con `cambios_estado.origen`).
-- =============================================================


-- =============================================================
-- 1) Tabla `flujos`
-- =============================================================
-- Cada row define un workflow configurado por la empresa.
-- - El `disparador` es jsonb: { tipo, configuracion }.
-- - Las `condiciones` y `acciones` son arrays jsonb con el shape que
--   definirá el motor en TS (ver §4.3 y §4.4 del plan).
-- - `nodos_json` guarda la representación visual del editor React
--   Flow para reconstruir el canvas. Se mantiene separado del
--   modelo lógico para que el motor no dependa de la UI.
-- - `activo` arranca en false: un flujo recién creado no dispara
--   hasta que el admin lo activa explícitamente. Evita ejecuciones
--   accidentales mientras se diseña.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.flujos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  nombre text NOT NULL,
  descripcion text,

  -- Apagar sin borrar. Default false para que recién creado no
  -- dispare hasta que el admin confirme.
  activo boolean NOT NULL DEFAULT false,

  -- Definición del disparador. Shape esperado:
  --   { "tipo": "entidad.estado_cambio",
  --     "configuracion": { "entidad_tipo": "presupuesto", "hasta_clave": "aceptado" } }
  -- El catálogo de tipos válidos vive en TS (PR 14). Se valida en
  -- runtime, no acá.
  disparador jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Filtros adicionales después de que el disparador hace match.
  -- Array de objetos { campo, operador, valor } con anidamiento Y/O.
  -- Ver §4.3 del plan.
  condiciones jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Lista ordenada de acciones a ejecutar. Cada item:
  --   { "tipo": "enviar_whatsapp_plantilla", "parametros": { ... } }
  -- El catálogo de tipos vive en TS (PR 15).
  acciones jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Representación visual del editor React Flow (nodos + edges).
  -- Se serializa tal cual viene del editor. El motor NO lee esto
  -- para ejecutar — usa `disparador` / `condiciones` / `acciones`.
  nodos_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Auditoría.
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- El dispatcher (PR 14) consulta los flujos activos de la empresa al
-- recibir un evento. Filtro parcial WHERE activo descarta los
-- desactivados sin penalizar el índice.
CREATE INDEX IF NOT EXISTS flujos_activos_idx
  ON public.flujos (empresa_id)
  WHERE activo = true;

-- Listado en la UI de configuración (PR 19+): orden por última edición.
CREATE INDEX IF NOT EXISTS flujos_listado_idx
  ON public.flujos (empresa_id, actualizado_en DESC);

-- Realtime: el dispatcher escucha cambios en flujos para refrescar
-- caché de definiciones activas sin reiniciar.
ALTER TABLE public.flujos REPLICA IDENTITY FULL;

-- RLS multi-tenant --
ALTER TABLE public.flujos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flujos_select" ON public.flujos
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "flujos_insert" ON public.flujos
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "flujos_update" ON public.flujos
  FOR UPDATE USING (empresa_id = empresa_actual());

CREATE POLICY "flujos_delete" ON public.flujos
  FOR DELETE USING (empresa_id = empresa_actual());


-- =============================================================
-- 2) Tabla `ejecuciones_flujo`
-- =============================================================
-- Una row por cada ejecución concreta de un flujo. El dispatcher
-- (PR 14) crea la row al disparar el flujo; el worker (PR 15) la
-- avanza paso a paso.
--
-- Estados internos del motor (validados en TS, no por CHECK SQL):
--   'pendiente'  — creada, todavía no empezó.
--   'corriendo'  — al menos una acción se ejecutó.
--   'esperando'  — pausada por una acción `esperar` o `esperar_evento`.
--   'completado' — todas las acciones terminaron OK.
--   'fallado'    — una acción falló y el flujo no permite seguir.
--   'cancelado'  — el admin la canceló manualmente.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.ejecuciones_flujo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  flujo_id uuid NOT NULL REFERENCES public.flujos(id) ON DELETE CASCADE,

  estado text NOT NULL DEFAULT 'pendiente',

  -- Origen del disparo, como string discriminado por prefijo:
  --   'cambios_estado:<uuid>' — disparado por un INSERT en cambios_estado
  --   'cron:<expr>'           — disparado por trigger de tiempo (PR 17)
  --   'manual:<user-uuid>'    — corrida manual desde la UI / sandbox
  --   'webhook:<url>'         — disparado por webhook entrante
  -- No es FK porque ningún tipo único de origen serviría a todos los
  -- casos de uso. La consistencia se valida en TS al crear la ejecución.
  disparado_por text,

  -- Snapshot al inicio: entidad disparadora + actor + datos de empresa
  -- + variables iniciales. Ver §4.5 del plan.
  contexto_inicial jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timeline paso a paso. Array append-only de objetos:
  --   { "paso": 1, "tipo": "enviar_whatsapp_plantilla", "estado": "ok",
  --     "inicio_en": "...", "fin_en": "...", "resultado": { ... } }
  log jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps de la ejecución. inicio_en se setea cuando arranca
  -- realmente el primer paso (puede haber gap entre creado_en e
  -- inicio_en si el dispatcher encola y el worker tarda).
  inicio_en timestamptz,
  fin_en timestamptz,

  -- Para flujos con `esperar` / `esperar_evento`: cuándo retomar.
  -- El worker barre las ejecuciones cuyo proximo_paso_en <= now().
  proximo_paso_en timestamptz,

  -- Reintentos por fallo transitorio (red, rate limit, etc.).
  intentos integer NOT NULL DEFAULT 0,

  -- Idempotencia: el dispatcher calcula esta clave determinísticamente
  -- para que dos disparos por el mismo evento no creen dos ejecuciones.
  -- Convención sugerida: 'flujo:<flujo_id>:evento:<cambios_estado_id>'.
  clave_idempotencia text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- Historial de un flujo puntual (lo que muestra la UI de detalle).
CREATE INDEX IF NOT EXISTS ejecuciones_flujo_por_flujo_idx
  ON public.ejecuciones_flujo (empresa_id, flujo_id, creado_en DESC);

-- Cola de trabajo del worker: las que están corriendo o esperando un
-- siguiente paso programado. Filtro parcial mantiene el índice chico
-- aunque las ejecuciones completadas crezcan ilimitadamente.
CREATE INDEX IF NOT EXISTS ejecuciones_flujo_pendientes_idx
  ON public.ejecuciones_flujo (proximo_paso_en)
  WHERE estado IN ('pendiente', 'corriendo', 'esperando');

-- Idempotencia: dos disparos con la misma clave_idempotencia no pueden
-- coexistir (el segundo INSERT falla con violación de unicidad y el
-- dispatcher ignora). Filtro parcial evita conflictos cuando es NULL
-- (ej: corridas manuales desde la UI sin clave).
CREATE UNIQUE INDEX IF NOT EXISTS ejecuciones_flujo_idempotencia_idx
  ON public.ejecuciones_flujo (flujo_id, clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

-- Realtime: la UI muestra el estado de las ejecuciones en vivo.
ALTER TABLE public.ejecuciones_flujo REPLICA IDENTITY FULL;

-- RLS multi-tenant --
ALTER TABLE public.ejecuciones_flujo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ejecuciones_flujo_select" ON public.ejecuciones_flujo
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "ejecuciones_flujo_insert" ON public.ejecuciones_flujo
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "ejecuciones_flujo_update" ON public.ejecuciones_flujo
  FOR UPDATE USING (empresa_id = empresa_actual());

-- Sin policy de DELETE: las ejecuciones son auditables y no se borran
-- desde la app. El admin de plataforma puede limpiarlas con
-- service_role si hace falta una purga histórica.


-- =============================================================
-- 3) Tabla `acciones_pendientes`
-- =============================================================
-- Cola de acciones diferidas. Cuando una acción de un flujo tiene
-- delay (`esperar 3d` antes del recordatorio) o es agendada (cron),
-- el worker la encola acá en lugar de ejecutarla en el momento.
--
-- Otro worker barre la cola buscando rows con `ejecutar_en <= now()`
-- y `estado = 'pendiente'`, las marca como `ejecutando`, ejecuta la
-- acción, y guarda el resultado.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.acciones_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ejecucion_id uuid NOT NULL REFERENCES public.ejecuciones_flujo(id) ON DELETE CASCADE,

  -- Tipo de acción del catálogo TS de PR 15 (enviar_whatsapp_plantilla,
  -- crear_actividad, cambiar_estado_entidad, etc.). Validado en runtime.
  tipo_accion text NOT NULL,

  -- Parámetros de la acción, ya resueltos contra el contexto al
  -- momento de encolar (variables interpoladas, IDs derivados, etc.).
  -- Esto evita que un cambio en la entidad disparadora altere lo que
  -- se ejecuta cuando llegue el momento.
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Cuándo ejecutar. Default now() para ejecución inmediata; valores
  -- futuros para delays explícitos.
  ejecutar_en timestamptz NOT NULL DEFAULT now(),

  -- Estados internos:
  --   'pendiente'  — esperando que llegue ejecutar_en.
  --   'ejecutando' — el worker la tomó (lock optimista por UPDATE).
  --   'ok'         — completada con éxito.
  --   'fallo'      — falló y agotó reintentos.
  --   'cancelada'  — la ejecución padre se canceló.
  estado text NOT NULL DEFAULT 'pendiente',

  -- Resultado de la ejecución (id del mensaje enviado, id de la
  -- actividad creada, error stack, etc.). Para auditar y reintentar.
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,

  intentos integer NOT NULL DEFAULT 0,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices --
-- Cola de trabajo: el worker busca las pendientes cuyo momento ya
-- llegó, en orden cronológico. Filtro parcial mantiene el índice
-- chico aunque las completadas crezcan ilimitadamente.
CREATE INDEX IF NOT EXISTS acciones_pendientes_cola_idx
  ON public.acciones_pendientes (ejecutar_en)
  WHERE estado = 'pendiente';

-- Lookup por ejecución para reconstruir el timeline en la UI o para
-- cancelar todas las acciones pendientes cuando se cancela un flujo.
CREATE INDEX IF NOT EXISTS acciones_pendientes_por_ejecucion_idx
  ON public.acciones_pendientes (ejecucion_id);

-- Realtime: la UI muestra acciones agendadas y permite cancelarlas.
ALTER TABLE public.acciones_pendientes REPLICA IDENTITY FULL;

-- RLS multi-tenant --
ALTER TABLE public.acciones_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acciones_pendientes_select" ON public.acciones_pendientes
  FOR SELECT USING (empresa_id = empresa_actual());

CREATE POLICY "acciones_pendientes_insert" ON public.acciones_pendientes
  FOR INSERT WITH CHECK (empresa_id = empresa_actual());

CREATE POLICY "acciones_pendientes_update" ON public.acciones_pendientes
  FOR UPDATE USING (empresa_id = empresa_actual());

-- Sin policy de DELETE: idem ejecuciones_flujo. Auditables.


-- =============================================================
-- 4) Trigger: actualizar `actualizado_en` automáticamente
-- =============================================================
-- Reusa el patrón ya establecido en transiciones_estado (PR 1).
-- =============================================================
CREATE OR REPLACE FUNCTION public.tr_workflows_actualizar_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flujos_actualizar_timestamp ON public.flujos;
CREATE TRIGGER flujos_actualizar_timestamp
  BEFORE UPDATE ON public.flujos
  FOR EACH ROW EXECUTE FUNCTION public.tr_workflows_actualizar_timestamp();

DROP TRIGGER IF EXISTS acciones_pendientes_actualizar_timestamp ON public.acciones_pendientes;
CREATE TRIGGER acciones_pendientes_actualizar_timestamp
  BEFORE UPDATE ON public.acciones_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.tr_workflows_actualizar_timestamp();


-- =============================================================
-- 5) Comentarios de documentación
-- =============================================================
COMMENT ON TABLE public.flujos IS
  'Definiciones de workflows / automatizaciones por empresa. disparador + condiciones + acciones en jsonb. El catálogo de tipos válidos vive en TS y se valida en runtime.';

COMMENT ON COLUMN public.flujos.activo IS
  'Si está apagado, el dispatcher lo ignora. Default false al crear: el admin lo activa explícitamente cuando termina de configurarlo.';

COMMENT ON COLUMN public.flujos.disparador IS
  'jsonb { tipo, configuracion }. Tipos: entidad.estado_cambio | entidad.creada | entidad.campo_cambia | actividad.completada | tiempo.cron | webhook.entrante | inbox.mensaje_recibido | inbox.conversacion_sin_respuesta. Catálogo en src/tipos/workflow.ts.';

COMMENT ON COLUMN public.flujos.condiciones IS
  'Array jsonb de filtros adicionales tras el match del disparador. Soporta operadores Y/O anidados y dot notation para campos relacionados.';

COMMENT ON COLUMN public.flujos.acciones IS
  'Array jsonb ordenado de acciones a ejecutar. Tipos: enviar_whatsapp_plantilla | enviar_correo_plantilla | crear_actividad | cambiar_estado_entidad | notificar_usuario | esperar | condicion_branch | etc. Catálogo en src/tipos/workflow.ts.';

COMMENT ON COLUMN public.flujos.nodos_json IS
  'Representación visual del editor React Flow (nodos + edges). El motor NO la lee para ejecutar — solo el editor la usa para reconstruir el canvas.';

COMMENT ON TABLE public.ejecuciones_flujo IS
  'Log de cada ejecución concreta de un flujo. El dispatcher (PR 14) la crea, el worker (PR 15) la avanza paso a paso. Estados: pendiente | corriendo | esperando | completado | fallado | cancelado.';

COMMENT ON COLUMN public.ejecuciones_flujo.disparado_por IS
  'String discriminado por prefijo: cambios_estado:<uuid> | cron:<expr> | manual:<user-uuid> | webhook:<url>. No es FK para soportar todos los orígenes.';

COMMENT ON COLUMN public.ejecuciones_flujo.contexto_inicial IS
  'Snapshot del contexto al disparar: entidad, actor, empresa, variables. Ver §4.5 del plan.';

COMMENT ON COLUMN public.ejecuciones_flujo.log IS
  'Array append-only de pasos ejecutados. Se enriquece a medida que el worker avanza la ejecución.';

COMMENT ON COLUMN public.ejecuciones_flujo.proximo_paso_en IS
  'Cuándo retomar la ejecución si está en estado esperando (acción esperar / esperar_evento). El worker barre las ejecuciones cuyo valor <= now().';

COMMENT ON COLUMN public.ejecuciones_flujo.clave_idempotencia IS
  'Clave determinística (ej: flujo:<id>:evento:<cambios_estado_id>) que impide duplicar ejecuciones por el mismo evento. NULL para corridas manuales desde sandbox.';

COMMENT ON TABLE public.acciones_pendientes IS
  'Cola de acciones diferidas (delays explícitos, programaciones, reintentos). El worker (PR 15) toma rows con ejecutar_en <= now() y estado = pendiente.';

COMMENT ON COLUMN public.acciones_pendientes.parametros IS
  'Parámetros ya resueltos contra el contexto al momento de encolar. Evita que cambios en la entidad disparadora alteren lo que se ejecuta cuando llegue el momento.';

COMMENT ON COLUMN public.acciones_pendientes.estado IS
  'Estados: pendiente | ejecutando | ok | fallo | cancelada. Validado en TS, no con CHECK SQL.';
