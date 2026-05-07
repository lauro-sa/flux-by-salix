/**
 * Executor de acciones del motor de workflows (sub-PR 15.1).
 *
 * Función pura `ejecutarAccion(accion, contexto, admin)`: recibe una
 * acción ya validada, el contexto de la ejecución y el cliente admin
 * de Supabase, y devuelve un resultado tipado. NO hace reintentos
 * (eso es responsabilidad del orquestador en `correr-ejecucion.ts`)
 * — solo intenta una vez y reporta éxito o error clasificado.
 *
 * Acciones soportadas en sub-PR 15.1 (4):
 *   - enviar_whatsapp_plantilla
 *   - crear_actividad
 *   - cambiar_estado_entidad
 *   - notificar_usuario
 *
 * Para cada acción, el executor:
 *   1. Valida shape específico con type guard.
 *   2. Reusa la lib existente del proyecto (sin duplicar lógica).
 *   3. Clasifica el error como transitorio o permanente para que el
 *      orquestador decida si reintenta.
 *
 * Clasificación de errores:
 *   - `transitorio: true`  → 5xx, 429 rate limit, network timeout.
 *                            El orquestador reintenta con backoff.
 *   - `transitorio: false` → 4xx semánticos (template no aprobado,
 *                            RLS bloqueado, contacto no existe, etc.).
 *                            El orquestador NO reintenta.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AccionWorkflow,
  AccionEnviarWhatsappPlantilla,
  AccionCrearActividad,
  AccionCambiarEstadoEntidad,
  AccionNotificarUsuario,
  AccionEsperar,
  AccionCondicionBranch,
  AccionTerminarFlujo,
} from '@/tipos/workflow'
import {
  esAccionEnviarWhatsappPlantilla,
  esAccionCrearActividad,
  esAccionCambiarEstadoEntidad,
  esAccionNotificarUsuario,
  esAccionEsperar,
  esAccionCondicionBranch,
  esAccionTerminarFlujo,
  esAccionConocida,
} from '@/tipos/workflow'
import {
  enviarPlantillaWhatsApp,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'
import {
  leerTokenAcceso,
  leerPhoneNumberId,
  leerWabaId,
  leerNumeroTelefono,
} from '@/lib/whatsapp/canal-credenciales'
import { aplicarTransicionEstado } from '@/lib/estados/aplicar-transicion'
import { evaluarCondicion } from './evaluar-condicion'

// =============================================================
// Contrato del resultado
// =============================================================

export type ResultadoAccion =
  | { ok: true; resultado: Record<string, unknown> }
  | {
      ok: false
      error: {
        mensaje: string
        /** Status HTTP si la acción invocó una API externa. */
        status?: number
        /**
         * true si el error parece transitorio y vale la pena reintentar.
         * false si es semántico (no se va a arreglar reintentando).
         */
        transitorio: boolean
        /** Clase del error si la conocemos (Error, MetaApiError, etc.). */
        raw_class?: string
      }
    }

// Contexto que el orquestador pasa al executor. PR 16 lo enriquece
// con datos de la entidad disparadora, actor, empresa, etc. — por
// ahora incluye `contexto_inicial` (jsonb del row de ejecuciones_flujo)
// que el evaluador de condiciones lee con dot notation.
export interface ContextoEjecucion {
  empresa_id: string
  ejecucion_id: string
  flujo_id: string
  /**
   * Snapshot del contexto al disparar (entidad, cambio, trigger).
   * Usado por `condicion_branch` para evaluar contra estos campos.
   */
  contexto_inicial?: Record<string, unknown>
  /**
   * Modo dry-run (sub-PR 19.5): cuando es `true`, los handlers con
   * side-effect externo (Meta WhatsApp, INSERT en BD, transición de
   * estado) cortocircuitan y devuelven un resultado `simulado`. El
   * control de flujo (esperar, condicion_branch, terminar_flujo)
   * sigue funcionando real — `condicion_branch` evalúa la condición
   * contra el contexto, `esperar` avanza sin bloquear el flujo,
   * `terminar_flujo` termina la ejecución.
   *
   * Garantía verificada por tests:
   *   - `enviarPlantillaWhatsApp` NO se invoca.
   *   - INSERT en `actividades`, `notificaciones`, `acciones_pendientes`
   *     NO se ejecuta.
   *   - `aplicarTransicionEstado` NO se invoca.
   *
   * Se hereda automáticamente a sub-acciones del `condicion_branch`
   * porque la recursión pasa el mismo objeto `contexto`.
   */
  dry_run?: boolean
}

// =============================================================
// Marcadores de control de flujo (sub-PR 15.2)
// =============================================================
// Las acciones de control devuelven `ok: true` con flags en el
// `resultado` que el orquestador detecta:
//   - esperando: true → marcar ejecución 'esperando', no avanzar
//   - terminar: true → marcar 'completado', no avanzar
//   - sub_pasos → log enriquecido del condicion_branch
// Mantener estos campos en `resultado` (jsonb genérico) evita inflar
// el tipo ResultadoAccion con shapes específicos por tipo.

export const MARCADOR_ESPERANDO = '__workflow_esperando__'
export const MARCADOR_TERMINAR = '__workflow_terminar__'

// =============================================================
// Punto de entrada — switch sobre el tipo de acción
// =============================================================

export async function ejecutarAccion(
  accion: AccionWorkflow,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  if (esAccionEnviarWhatsappPlantilla(accion)) {
    return ejecutarEnviarWhatsappPlantilla(accion, contexto, admin)
  }
  if (esAccionCrearActividad(accion)) {
    return ejecutarCrearActividad(accion, contexto, admin)
  }
  if (esAccionCambiarEstadoEntidad(accion)) {
    return ejecutarCambiarEstadoEntidad(accion, contexto, admin)
  }
  if (esAccionNotificarUsuario(accion)) {
    return ejecutarNotificarUsuario(accion, contexto, admin)
  }
  if (esAccionEsperar(accion)) {
    return ejecutarEsperar(accion, contexto, admin)
  }
  if (esAccionCondicionBranch(accion)) {
    return ejecutarCondicionBranch(accion, contexto, admin)
  }
  if (esAccionTerminarFlujo(accion)) {
    return ejecutarTerminarFlujo(accion)
  }
  // Acciones del catálogo todavía no implementadas (sub-PR 15.3+).
  // En dry-run, devolvemos un resultado simulado con `no_implementada: true`
  // para que la consola del editor (sub-PR 19.5) las muestre y dispare el
  // banner ámbar "estas acciones fallarán al activar". Sin flag, el path
  // original sigue rechazando como permanente.
  if (contexto.dry_run) {
    const tipo = (accion as { tipo: string }).tipo
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: tipo,
        no_implementada: true,
        payload: accion as unknown as Record<string, unknown>,
      },
    }
  }
  return {
    ok: false,
    error: {
      mensaje: `Acción tipo "${(accion as { tipo: string }).tipo}" no implementada todavía`,
      transitorio: false,
      raw_class: 'AccionNoImplementada',
    },
  }
}

// =============================================================
// 1) enviar_whatsapp_plantilla
// =============================================================

async function ejecutarEnviarWhatsappPlantilla(
  accion: AccionEnviarWhatsappPlantilla,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  // Dry-run (sub-PR 19.5): NO consultar canal, NO llamar a Meta. Devolvemos
  // el payload resuelto que se HABRÍA enviado para que la consola muestre
  // "se enviaría WhatsApp `<plantilla>` a +54 9 11..." sin tocar la red.
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'enviar_whatsapp_plantilla',
        canal_id: accion.canal_id,
        destinatario: accion.telefono,
        plantilla: accion.plantilla_nombre,
        idioma: accion.idioma,
        componentes: accion.componentes ?? null,
      },
    }
  }

  // Cargar credenciales del canal desde canales_whatsapp.
  const { data: canal, error: errCanal } = await admin
    .from('canales_whatsapp')
    .select('id, config_conexion, numero_telefono')
    .eq('id', accion.canal_id)
    .eq('empresa_id', contexto.empresa_id)
    .maybeSingle()

  if (errCanal) {
    return {
      ok: false,
      error: {
        mensaje: `Error cargando canal WhatsApp: ${errCanal.message}`,
        transitorio: false,
        raw_class: 'SupabaseError',
      },
    }
  }
  if (!canal) {
    return {
      ok: false,
      error: {
        mensaje: `Canal WhatsApp ${accion.canal_id} no encontrado para empresa ${contexto.empresa_id}`,
        transitorio: false,
        raw_class: 'CanalNoEncontrado',
      },
    }
  }

  const cred = (canal.config_conexion ?? {}) as Parameters<typeof leerTokenAcceso>[0]
  const tokenAcceso = leerTokenAcceso(cred)
  const phoneNumberId = leerPhoneNumberId(cred)
  const wabaId = leerWabaId(cred)
  const numeroTelefono = leerNumeroTelefono(cred) || (canal.numero_telefono ?? '')

  if (!tokenAcceso || !phoneNumberId || !wabaId) {
    return {
      ok: false,
      error: {
        mensaje: `Canal WhatsApp ${accion.canal_id} sin credenciales completas (faltan token/phone_number_id/waba_id)`,
        transitorio: false,
        raw_class: 'CredencialesIncompletas',
      },
    }
  }

  const config: ConfigCuentaWhatsApp = {
    phoneNumberId,
    wabaId,
    tokenAcceso,
    numeroTelefono,
  }

  // enviarPlantillaWhatsApp lanza `Error` con el JSON de Meta dentro
  // del mensaje cuando Meta devuelve no-OK. Parseamos el código de
  // error de Meta para clasificar transitorio/permanente.
  try {
    const respuesta = await enviarPlantillaWhatsApp(
      config,
      accion.telefono,
      accion.plantilla_nombre,
      accion.idioma,
      accion.componentes,
    )
    return {
      ok: true,
      resultado: {
        message_id: respuesta.messages?.[0]?.id ?? null,
        wa_id: respuesta.contacts?.[0]?.wa_id ?? null,
      },
    }
  } catch (e) {
    return clasificarErrorMetaApi(e)
  }
}

/**
 * Clasifica el error que lanza `enviarPlantillaWhatsApp`. El mensaje
 * tiene formato `Meta API error: {"error":{"code":N,"message":"..."}}`.
 * Códigos transitorios: 4 (rate limit), 80007 (cuotas), 130472 (rate
 * por usuario), 5xx HTTP. Permanentes: 100, 132xxx (template), 131xxx
 * (parámetros), 190 (token).
 */
function clasificarErrorMetaApi(e: unknown): ResultadoAccion {
  const mensaje = e instanceof Error ? e.message : String(e)
  const raw_class = e instanceof Error ? e.constructor.name : 'unknown'

  // Heurística para extraer el code de Meta del JSON embebido.
  let metaCode: number | undefined
  const m = mensaje.match(/"code"\s*:\s*(\d+)/)
  if (m) metaCode = parseInt(m[1], 10)

  // Códigos de Meta que indican fallo transitorio.
  const TRANSITORIOS_META = new Set([4, 80007, 130472, 368])
  const transitorio = metaCode !== undefined
    ? TRANSITORIOS_META.has(metaCode)
    : /timeout|ECONN|ETIMEDOUT|fetch failed/i.test(mensaje)

  return {
    ok: false,
    error: { mensaje, status: metaCode, transitorio, raw_class },
  }
}

// =============================================================
// 2) crear_actividad
// =============================================================
// Replica la lógica esencial del POST /api/actividades (insert
// directo con campos mínimos requeridos). NO chequea permisos del
// usuario (en workflow-action no hay usuario; el flujo ya fue
// autorizado al activarse).

async function ejecutarCrearActividad(
  accion: AccionCrearActividad,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  // Cargar tipo (para tipo_clave) y estado default (pendiente).
  const [{ data: tipo, error: errTipo }, { data: estadoDefault, error: errEstado }] =
    await Promise.all([
      admin
        .from('tipos_actividad')
        .select('clave, etiqueta')
        .eq('id', accion.tipo_actividad_id)
        .eq('empresa_id', contexto.empresa_id)
        .maybeSingle(),
      admin
        .from('estados_actividad')
        .select('id, clave')
        .eq('empresa_id', contexto.empresa_id)
        .eq('clave', 'pendiente')
        .maybeSingle(),
    ])

  if (errTipo) {
    return errSupabase(errTipo, 'cargar tipo de actividad')
  }
  if (!tipo) {
    return {
      ok: false,
      error: {
        mensaje: `Tipo de actividad ${accion.tipo_actividad_id} no encontrado`,
        transitorio: false,
        raw_class: 'TipoNoEncontrado',
      },
    }
  }
  if (errEstado) {
    return errSupabase(errEstado, 'cargar estado default de actividades')
  }
  if (!estadoDefault) {
    return {
      ok: false,
      error: {
        mensaje: 'Estado "pendiente" de actividad no sembrado en la empresa',
        transitorio: false,
        raw_class: 'EstadoNoEncontrado',
      },
    }
  }

  // Dry-run (sub-PR 19.5): NO insertar en `actividades`. Las lecturas de
  // `tipos_actividad` y `estados_actividad` arriba SÍ se hicieron — son
  // read-only y nos sirven para enriquecer el log de la consola con la
  // etiqueta legible del tipo. La validación "tipo existe / estado
  // pendiente sembrado" se ejecuta igual que el path real, así el dry-run
  // detecta esos errores semánticos en seco.
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'crear_actividad',
        tipo_actividad_id: accion.tipo_actividad_id,
        tipo_etiqueta: tipo.etiqueta ?? tipo.clave,
        titulo: accion.titulo,
        descripcion: accion.descripcion ?? null,
        prioridad: accion.prioridad ?? 'normal',
        fecha_vencimiento: accion.fecha_vencimiento ?? null,
        asignados_ids: accion.asignados_ids ?? [],
        contacto_id: accion.contacto_id ?? null,
      },
    }
  }

  const vinculos = accion.contacto_id
    ? [{ tipo: 'contacto', id: accion.contacto_id }]
    : []
  const vinculo_ids = accion.contacto_id ? [accion.contacto_id] : []

  const { data, error } = await admin
    .from('actividades')
    .insert({
      empresa_id: contexto.empresa_id,
      titulo: accion.titulo,
      descripcion: accion.descripcion ?? null,
      tipo_id: accion.tipo_actividad_id,
      tipo_clave: tipo.clave,
      estado_id: estadoDefault.id,
      estado_clave: estadoDefault.clave,
      prioridad: accion.prioridad ?? 'normal',
      fecha_vencimiento: accion.fecha_vencimiento ?? null,
      asignados: [],
      asignados_ids: accion.asignados_ids ?? [],
      checklist: [],
      vinculos,
      vinculo_ids,
      // Marcamos creado_por como NULL: lo creó un workflow, no un
      // usuario humano. La columna nombre se mantiene legible.
      creado_por: null,
      creado_por_nombre: 'Automatización',
    })
    .select('id, titulo')
    .single()

  if (error) return errSupabase(error, 'insertar actividad')

  return {
    ok: true,
    resultado: { actividad_id: data.id, titulo: data.titulo },
  }
}

// =============================================================
// 3) cambiar_estado_entidad
// =============================================================

async function ejecutarCambiarEstadoEntidad(
  accion: AccionCambiarEstadoEntidad,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  // Dry-run (sub-PR 19.5): NO aplicar la transición. Devolvemos el
  // estado destino esperado para que la consola muestre "cambiaría
  // <entidad> a <estado>". El path real valida transiciones; el dry-run
  // las omite (acotación consciente: validar requiere leer la matriz de
  // transiciones permitidas y depende de fixtures de empresa que en
  // sandbox pueden no estar a la mano).
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'cambiar_estado_entidad',
        entidad_tipo: accion.entidad_tipo,
        entidad_id: accion.entidad_id,
        estado_nuevo: accion.hasta_clave,
        motivo: accion.motivo ?? null,
      },
    }
  }
  const r = await aplicarTransicionEstado({
    admin,
    empresaId: contexto.empresa_id,
    entidadTipo: accion.entidad_tipo,
    entidadId: accion.entidad_id,
    hastaClave: accion.hasta_clave,
    motivo: accion.motivo,
    origen: 'workflow',
  })

  if (r.ok) {
    return {
      ok: true,
      resultado: {
        estado_anterior: r.estadoAnterior,
        estado_nuevo: r.estadoNuevo,
        no_op: r.noOp ?? false,
      },
    }
  }

  // Errores de transición son semánticos (transición inválida, motivo
  // requerido) — no se arreglan con reintento.
  return {
    ok: false,
    error: {
      mensaje: r.error,
      transitorio: false,
      raw_class: r.transicionInvalida
        ? 'TransicionInvalida'
        : r.motivoRequerido
          ? 'MotivoRequerido'
          : 'CambioEstadoFallo',
    },
  }
}

// =============================================================
// 4) notificar_usuario
// =============================================================
// NO usa la lib `crearNotificacion` directamente porque esa función
// instancia su propio cliente admin via getRequestContext (depende
// del runtime Next). El executor recibe un `admin` ya construido y
// hace el INSERT directo a la tabla notificaciones.

async function ejecutarNotificarUsuario(
  accion: AccionNotificarUsuario,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  // Dry-run (sub-PR 19.5): NO insertar en `notificaciones`. Devolvemos el
  // payload completo para que la consola muestre "notificaría a <usuario>".
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'notificar_usuario',
        usuario_id: accion.usuario_id,
        titulo: accion.titulo,
        cuerpo: accion.cuerpo ?? null,
        url: accion.url ?? null,
        notificacion_tipo: accion.notificacion_tipo ?? 'workflow',
      },
    }
  }
  // referencia_tipo y referencia_id se dejan en NULL para evitar
  // colisiones con el índice `notificaciones_dedup_no_leida_idx` que
  // bloquea múltiples notificaciones no leídas para el mismo
  // (empresa_id, usuario_id, referencia_tipo, referencia_id). Ese
  // dedup tiene sentido para casos típicos (no spamear con la misma
  // notif) pero NO para workflows que generan N notificaciones para
  // un mismo usuario apuntando a la misma ejecución (caso real
  // detectado en E2E del sub-PR 15.2: flujo con 2 notificar_usuario
  // separados por esperar(60s)).
  //
  // La trazabilidad inversa "qué workflow generó esta notif" se
  // pierde a nivel columna pero se mantiene a nivel `tipo` (default
  // 'workflow') y opcionalmente en `cuerpo`. Si en el futuro hace
  // falta linkear notif → ejecucion, una opción es agregar un
  // campo metadatos jsonb a notificaciones (PR aparte).
  const { data, error } = await admin
    .from('notificaciones')
    .insert({
      empresa_id: contexto.empresa_id,
      usuario_id: accion.usuario_id,
      tipo: accion.notificacion_tipo ?? 'workflow',
      titulo: accion.titulo,
      cuerpo: accion.cuerpo ?? null,
      url: accion.url ?? null,
      leida: false,
    })
    .select('id')
    .single()

  if (error) return errSupabase(error, 'insertar notificación')

  return {
    ok: true,
    resultado: { notificacion_id: data.id },
  }
}

// =============================================================
// 5) esperar (sub-PR 15.2)
// =============================================================
// Inserta una fila en `acciones_pendientes` con `ejecutar_en` en el
// futuro. Devuelve un resultado con marcador MARCADOR_ESPERANDO que
// el orquestador detecta para marcar la ejecución como 'esperando'
// y no avanzar al siguiente paso.
//
// Cuando llegue el momento, el cron `/api/workflows/barrer-pendientes`
// dispara fire-and-forget al endpoint del worker, que reanuda la
// ejecución desde donde quedó (lee el log para saber el paso).

async function ejecutarEsperar(
  accion: AccionEsperar,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  // Calcular ejecutar_en: duracion_ms o hasta_fecha (mutuamente
  // exclusivos según el type guard).
  let ejecutarEn: Date
  if (typeof accion.duracion_ms === 'number') {
    ejecutarEn = new Date(Date.now() + accion.duracion_ms)
  } else if (typeof accion.hasta_fecha === 'string') {
    ejecutarEn = new Date(accion.hasta_fecha)
    if (Number.isNaN(ejecutarEn.getTime())) {
      return {
        ok: false,
        error: {
          mensaje: `Fecha inválida en accion.esperar.hasta_fecha: "${accion.hasta_fecha}"`,
          transitorio: false,
          raw_class: 'FechaInvalida',
        },
      }
    }
  } else {
    return {
      ok: false,
      error: {
        mensaje: 'Acción esperar requiere duracion_ms o hasta_fecha',
        transitorio: false,
        raw_class: 'EsperarSinTiempo',
      },
    }
  }

  // Dry-run (sub-PR 19.5): NO insertar en `acciones_pendientes` y, crítico,
  // NO devolver MARCADOR_ESPERANDO. El orquestador del dry-run avanza al
  // siguiente paso de inmediato; el log queda con "esperaría 60.000 ms
  // hasta <fecha>" pero el flujo continúa synchronously hasta el final.
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'esperar',
        esperaria_ms: accion.duracion_ms ?? null,
        esperaria_hasta: ejecutarEn.toISOString(),
      },
    }
  }

  const { data, error } = await admin
    .from('acciones_pendientes')
    .insert({
      empresa_id: contexto.empresa_id,
      ejecucion_id: contexto.ejecucion_id,
      tipo_accion: 'esperar',
      parametros: {
        duracion_ms: accion.duracion_ms ?? null,
        hasta_fecha: accion.hasta_fecha ?? null,
      },
      ejecutar_en: ejecutarEn.toISOString(),
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (error) return errSupabase(error, 'agendar acción esperar')

  return {
    ok: true,
    resultado: {
      [MARCADOR_ESPERANDO]: true,
      accion_pendiente_id: data.id,
      ejecutar_en: ejecutarEn.toISOString(),
    },
  }
}

// =============================================================
// 6) condicion_branch (sub-PR 15.2)
// =============================================================
// Evalúa la condición contra el contexto_inicial de la ejecución y
// ejecuta las sub-acciones de la rama matching en serie. Las
// sub-acciones se ejecutan dentro del mismo paso del log padre
// (campo `sub_pasos`), no como pasos separados al nivel del flujo.
//
// Limitación de scope sub-PR 15.2: las sub-acciones NO pueden ser
// `esperar` ni `condicion_branch` anidados (sería complicado
// reanudar). Solo acciones síncronas: las 4 originales + terminar_flujo.
// Se valida en runtime: si una sub-acción retorna esperando o anidada,
// se rechaza.

async function ejecutarCondicionBranch(
  accion: AccionCondicionBranch,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  const ctxParaEval = contexto.contexto_inicial ?? {}
  const condicionVerdadera = evaluarCondicion(accion.condicion, ctxParaEval)
  const sub = condicionVerdadera ? accion.acciones_si : accion.acciones_no

  const subPasos: Array<Record<string, unknown>> = []
  let terminarPropagado = false

  for (let i = 0; i < sub.length; i++) {
    const subAccion = sub[i] as unknown
    if (!esAccionConocida(subAccion)) {
      subPasos.push({
        sub_paso: i + 1,
        tipo: 'desconocido',
        estado: 'fallado',
        error: { mensaje: 'Sub-acción con shape inválido', raw_class: 'AccionInvalida' },
      })
      return {
        ok: false,
        error: {
          mensaje: 'Sub-acción del condicion_branch inválida',
          transitorio: false,
          raw_class: 'SubAccionInvalida',
        },
      }
    }
    // Bloqueo de scope: esperar y condicion_branch anidados no soportados.
    if (esAccionEsperar(subAccion) || esAccionCondicionBranch(subAccion)) {
      return {
        ok: false,
        error: {
          mensaje: 'sub-PR 15.2: esperar/condicion_branch anidados no soportados dentro de un branch (subir al nivel padre)',
          transitorio: false,
          raw_class: 'AnidamientoNoSoportado',
        },
      }
    }

    const inicio = Date.now()
    const r = await ejecutarAccion(subAccion, contexto, admin)
    const duracion = Date.now() - inicio

    if (r.ok) {
      // Si la sub-acción es terminar_flujo, propagamos al padre.
      if (r.resultado[MARCADOR_TERMINAR] === true) {
        subPasos.push({
          sub_paso: i + 1,
          tipo: subAccion.tipo,
          estado: 'ok',
          duracion_ms: duracion,
          terminar: true,
        })
        terminarPropagado = true
        break
      }
      subPasos.push({
        sub_paso: i + 1,
        tipo: subAccion.tipo,
        estado: 'ok',
        duracion_ms: duracion,
        respuesta: r.resultado,
      })
    } else {
      const continuarSiFalla = (subAccion as { continuar_si_falla?: boolean }).continuar_si_falla === true
      subPasos.push({
        sub_paso: i + 1,
        tipo: subAccion.tipo,
        estado: 'fallado',
        duracion_ms: duracion,
        error: {
          mensaje: r.error.mensaje,
          status: r.error.status,
          raw_class: r.error.raw_class,
        },
        continuo_pese_a_fallo: continuarSiFalla || undefined,
      })
      if (!continuarSiFalla) {
        // Sub-acción crítica falló. Reportamos al padre como falla
        // del branch entero. El orquestador maneja según
        // continuar_si_falla del propio branch.
        return {
          ok: false,
          error: {
            mensaje: `Sub-acción ${i + 1} del condicion_branch (${subAccion.tipo}) falló: ${r.error.mensaje}`,
            transitorio: r.error.transitorio,
            raw_class: r.error.raw_class,
          },
        }
      }
    }
  }

  return {
    ok: true,
    resultado: {
      rama_ejecutada: condicionVerdadera ? 'si' : 'no',
      sub_pasos: subPasos,
      ...(terminarPropagado ? { [MARCADOR_TERMINAR]: true } : {}),
    },
  }
}

// =============================================================
// 7) terminar_flujo (sub-PR 15.2)
// =============================================================
// Devuelve un resultado con MARCADOR_TERMINAR. El orquestador detecta
// el flag y rompe el loop, marcando la ejecución como 'completado'
// sin procesar los pasos siguientes.

function ejecutarTerminarFlujo(
  accion: AccionTerminarFlujo,
): ResultadoAccion {
  return {
    ok: true,
    resultado: {
      [MARCADOR_TERMINAR]: true,
      motivo: accion.motivo ?? null,
    },
  }
}

// =============================================================
// Helpers internos
// =============================================================

function errSupabase(
  err: { message: string; code?: string },
  contexto: string,
): ResultadoAccion {
  // RLS / FK / not_null / etc. → permanente (no se arregla reintentando).
  // Connection / timeout → transitorio.
  const transitorio = /timeout|ECONN|ETIMEDOUT|connection/i.test(err.message)
  return {
    ok: false,
    error: {
      mensaje: `Error al ${contexto}: ${err.message}`,
      transitorio,
      raw_class: err.code ? `pg:${err.code}` : 'SupabaseError',
    },
  }
}
