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
  AccionEnviarCorreoPlantilla,
  AccionEnviarRespuestaRapidaCorreo,
  AccionCrearActividad,
  AccionCompletarActividad,
  AccionCambiarEstadoEntidad,
  AccionNotificarUsuario,
  AccionEsperar,
  AccionCondicionBranch,
  AccionTerminarFlujo,
} from '@/tipos/workflow'
import {
  esAccionEnviarWhatsappPlantilla,
  esAccionEnviarCorreoPlantilla,
  esAccionEnviarRespuestaRapidaCorreo,
  esAccionCrearActividad,
  esAccionCompletarActividad,
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
import { registrarChatter } from '@/lib/chatter'
import { esEntidadRelacionable } from '@/tipos/actividades-relaciones'
import { insertarVinculosActividad } from '@/lib/actividades-relaciones-helpers'
import { evaluarCondicion } from './evaluar-condicion'
import { resolverPlantilla, type ContextoVariables } from './resolver-variables'
import {
  enviarCorreoGmail,
  generarMessageId,
  type OpcionesMensajeRFC2822,
} from '@/lib/gmail'
import { enviarCorreoSMTP } from '@/lib/correo-imap'
import type { ConfigIMAP } from '@/tipos/inbox'

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
  if (esAccionEnviarCorreoPlantilla(accion)) {
    return ejecutarEnviarCorreoPlantilla(accion, contexto, admin)
  }
  if (esAccionEnviarRespuestaRapidaCorreo(accion)) {
    return ejecutarEnviarRespuestaRapidaCorreo(accion, contexto, admin)
  }
  if (esAccionCrearActividad(accion)) {
    return ejecutarCrearActividad(accion, contexto, admin)
  }
  if (esAccionCompletarActividad(accion)) {
    return ejecutarCompletarActividad(accion, contexto, admin)
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
// 1.bis) enviar_correo_plantilla / enviar_respuesta_rapida_correo
// =============================================================
// Dos handlers casi gemelos: leen su registro (de plantillas_correo o
// respuestas_rapidas_correo), y delegan al helper compartido
// `enviarCorreoDesdeFlujo` que resuelve cuenta origen, destinatario,
// variables, threading, envío real y registro del mensaje saliente
// en `mensajes`.

async function ejecutarEnviarCorreoPlantilla(
  accion: AccionEnviarCorreoPlantilla,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  const { data: plantilla, error: errPlantilla } = await admin
    .from('plantillas_correo')
    .select('id, nombre, asunto, contenido, contenido_html, activo')
    .eq('id', accion.plantilla_id)
    .eq('empresa_id', contexto.empresa_id)
    .maybeSingle()

  if (errPlantilla) return errSupabase(errPlantilla, 'cargar plantilla de correo')
  if (!plantilla) {
    return {
      ok: false,
      error: {
        mensaje: `Plantilla de correo ${accion.plantilla_id} no encontrada para empresa ${contexto.empresa_id}`,
        transitorio: false,
        raw_class: 'PlantillaNoEncontrada',
      },
    }
  }
  if (!plantilla.activo) {
    return {
      ok: false,
      error: {
        mensaje: `Plantilla "${plantilla.nombre}" está inactiva`,
        transitorio: false,
        raw_class: 'PlantillaInactiva',
      },
    }
  }

  return enviarCorreoDesdeFlujo(
    {
      origen: 'plantilla',
      origenId: plantilla.id,
      nombreLegible: plantilla.nombre,
      asunto: plantilla.asunto,
      contenidoTexto: plantilla.contenido,
      contenidoHtml: plantilla.contenido_html,
    },
    accion.destinatario_override,
    contexto,
    admin,
  )
}

async function ejecutarEnviarRespuestaRapidaCorreo(
  accion: AccionEnviarRespuestaRapidaCorreo,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  const { data: rapida, error: errRapida } = await admin
    .from('respuestas_rapidas_correo')
    .select('id, nombre, asunto, contenido, contenido_html, activo')
    .eq('id', accion.respuesta_rapida_id)
    .eq('empresa_id', contexto.empresa_id)
    .maybeSingle()

  if (errRapida) return errSupabase(errRapida, 'cargar respuesta rápida de correo')
  if (!rapida) {
    return {
      ok: false,
      error: {
        mensaje: `Respuesta rápida ${accion.respuesta_rapida_id} no encontrada para empresa ${contexto.empresa_id}`,
        transitorio: false,
        raw_class: 'RespuestaRapidaNoEncontrada',
      },
    }
  }
  if (!rapida.activo) {
    return {
      ok: false,
      error: {
        mensaje: `Respuesta rápida "${rapida.nombre}" está inactiva`,
        transitorio: false,
        raw_class: 'RespuestaRapidaInactiva',
      },
    }
  }

  return enviarCorreoDesdeFlujo(
    {
      origen: 'respuesta_rapida',
      origenId: rapida.id,
      nombreLegible: rapida.nombre,
      asunto: rapida.asunto,
      contenidoTexto: rapida.contenido,
      contenidoHtml: rapida.contenido_html,
    },
    accion.destinatario_override,
    contexto,
    admin,
  )
}

interface RegistroCorreoOrigen {
  origen: 'plantilla' | 'respuesta_rapida'
  origenId: string
  nombreLegible: string
  asunto: string | null
  contenidoTexto: string | null
  contenidoHtml: string | null
}

/**
 * Núcleo compartido para enviar correo desde el motor de flujos.
 *
 * Resolución de destinatario:
 *   - Si `destinatarioOverride` viene → resolver `{{vars}}` y usarlo.
 *   - Sino: del contexto del mensaje disparador (`mensaje_disparador.correo_de`).
 *
 * Resolución de cuenta origen:
 *   - Del contexto del mensaje disparador (`mensaje_disparador.canal_id`).
 *   - Si no hay mensaje disparador y no se ofrece override, FALLA con
 *     `CuentaOrigenFaltante`. Hoy no exponemos override de cuenta; cuando
 *     se exponga (PR futuro), agregar campo `cuenta_origen_id?` a las
 *     acciones y resolver acá antes del fallback.
 *
 * Threading: si hay mensaje disparador, se inyectan In-Reply-To y
 * References para que el correo aparezca como respuesta del hilo.
 *
 * Registro: tras el envío, se inserta una fila en `mensajes` con
 * `es_entrante=false`, `metadata` con linaje del flujo, y el threading
 * apropiado para que la conversación del inbox muestre el envío.
 */
async function enviarCorreoDesdeFlujo(
  registro: RegistroCorreoOrigen,
  destinatarioOverride: string | undefined,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  const ctxVars = (contexto.contexto_inicial ?? {}) as ContextoVariables
  const mensajeDisparador = leerMensajeDisparador(contexto.contexto_inicial)

  // ─── Destinatario ──────────────────────────────────────────
  let destinatario: string | null = null
  if (destinatarioOverride && destinatarioOverride.trim() !== '') {
    try {
      destinatario = resolverPlantilla(destinatarioOverride, ctxVars).trim()
    } catch (e) {
      return {
        ok: false,
        error: {
          mensaje: `No se pudo resolver destinatario_override: ${e instanceof Error ? e.message : String(e)}`,
          transitorio: false,
          raw_class: 'DestinatarioOverrideInvalido',
        },
      }
    }
  } else if (mensajeDisparador?.correo_de) {
    destinatario = extraerEmail(mensajeDisparador.correo_de)
  }
  if (!destinatario) {
    return {
      ok: false,
      error: {
        mensaje:
          'No se pudo determinar destinatario: el flujo no viene de un mensaje entrante y no se configuró destinatario_override.',
        transitorio: false,
        raw_class: 'DestinatarioFaltante',
      },
    }
  }

  // ─── Cuenta origen ─────────────────────────────────────────
  const canalId = mensajeDisparador?.canal_id ?? null
  if (!canalId) {
    return {
      ok: false,
      error: {
        mensaje:
          'No se pudo determinar la cuenta de correo origen: el flujo no viene de un mensaje entrante.',
        transitorio: false,
        raw_class: 'CuentaOrigenFaltante',
      },
    }
  }

  const { data: canal, error: errCanal } = await admin
    .from('canales_correo')
    .select('id, nombre, proveedor, config_conexion, estado_conexion')
    .eq('id', canalId)
    .eq('empresa_id', contexto.empresa_id)
    .maybeSingle()
  if (errCanal) return errSupabase(errCanal, 'cargar canal de correo')
  if (!canal) {
    return {
      ok: false,
      error: {
        mensaje: `Canal de correo ${canalId} no encontrado para empresa ${contexto.empresa_id}`,
        transitorio: false,
        raw_class: 'CanalNoEncontrado',
      },
    }
  }
  if (canal.estado_conexion !== 'conectado' && !contexto.dry_run) {
    return {
      ok: false,
      error: {
        mensaje: `Canal "${canal.nombre}" no está conectado (estado: ${canal.estado_conexion})`,
        transitorio: true, // puede haberse recuperado al próximo intento
        raw_class: 'CanalDesconectado',
      },
    }
  }

  // ─── Resolver variables en asunto/contenido ────────────────
  let asuntoResuelto: string
  let textoResuelto: string
  let htmlResuelto: string | null
  try {
    asuntoResuelto = resolverPlantilla(registro.asunto ?? '(Sin asunto)', ctxVars)
    textoResuelto = resolverPlantilla(registro.contenidoTexto ?? '', ctxVars)
    htmlResuelto = registro.contenidoHtml
      ? resolverPlantilla(registro.contenidoHtml, ctxVars)
      : null
  } catch (e) {
    return {
      ok: false,
      error: {
        mensaje: `Error resolviendo variables de la plantilla: ${e instanceof Error ? e.message : String(e)}`,
        transitorio: false,
        raw_class: e instanceof Error ? e.constructor.name : 'VariableError',
      },
    }
  }

  // ─── Threading ─────────────────────────────────────────────
  const inReplyTo = mensajeDisparador?.correo_message_id ?? undefined
  const refsPrevias = mensajeDisparador?.correo_references ?? []
  const references = inReplyTo
    ? [...refsPrevias, inReplyTo].filter((v, i, a) => a.indexOf(v) === i)
    : undefined

  // ─── Dry-run: no envía ni registra ─────────────────────────
  if (contexto.dry_run) {
    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: registro.origen === 'plantilla'
          ? 'enviar_correo_plantilla'
          : 'enviar_respuesta_rapida_correo',
        canal_id: canal.id,
        canal_nombre: canal.nombre,
        proveedor: canal.proveedor,
        destinatario,
        asunto: asuntoResuelto,
        texto: textoResuelto,
        html: htmlResuelto,
        in_reply_to: inReplyTo ?? null,
        references: references ?? null,
        origen: registro.origen,
        origen_id: registro.origenId,
        nombre_legible: registro.nombreLegible,
      },
    }
  }

  // ─── Determinar email remitente desde config_conexion ──────
  const cfg = canal.config_conexion as Record<string, unknown> | null
  let emailRemitente = ''
  if (canal.proveedor === 'gmail_oauth') {
    emailRemitente = typeof cfg?.email === 'string' ? cfg.email : ''
  } else if (canal.proveedor === 'imap') {
    emailRemitente = typeof cfg?.usuario === 'string' ? cfg.usuario : ''
  }
  if (!emailRemitente) {
    return {
      ok: false,
      error: {
        mensaje: `Canal "${canal.nombre}" no tiene email remitente configurado en config_conexion`,
        transitorio: false,
        raw_class: 'CredencialesIncompletas',
      },
    }
  }
  const de = `Automatización <${emailRemitente}>`

  // ─── Envío real ────────────────────────────────────────────
  const opciones: OpcionesMensajeRFC2822 = {
    de,
    para: [destinatario],
    asunto: asuntoResuelto || '(Sin asunto)',
    textoPlano: textoResuelto,
    html: htmlResuelto ?? undefined,
    inReplyTo,
    references,
  }

  let messageIdRfc5322: string
  let proveedorIdInfo: Record<string, unknown> = {}
  try {
    if (canal.proveedor === 'gmail_oauth') {
      const refreshToken = typeof cfg?.refresh_token === 'string' ? cfg.refresh_token : ''
      if (!refreshToken) {
        return {
          ok: false,
          error: {
            mensaje: `Canal Gmail "${canal.nombre}" sin refresh_token`,
            transitorio: false,
            raw_class: 'CredencialesIncompletas',
          },
        }
      }
      const respuesta = await enviarCorreoGmail(refreshToken, opciones, undefined)
      messageIdRfc5322 = respuesta.messageId
      proveedorIdInfo = { gmail_id: respuesta.id, gmail_thread_id: respuesta.threadId }
    } else if (canal.proveedor === 'imap') {
      const configImap = cfg as unknown as ConfigIMAP
      const respuesta = await enviarCorreoSMTP(configImap, {
        de,
        para: [destinatario],
        asunto: asuntoResuelto || '(Sin asunto)',
        textoPlano: textoResuelto,
        html: htmlResuelto ?? undefined,
        inReplyTo,
        references,
      })
      messageIdRfc5322 = respuesta.messageId || generarMessageId(extraerDominio(emailRemitente))
    } else {
      return {
        ok: false,
        error: {
          mensaje: `Proveedor de correo desconocido: ${canal.proveedor}`,
          transitorio: false,
          raw_class: 'ProveedorDesconocido',
        },
      }
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    const transitorio = /timeout|ECONN|ETIMEDOUT|fetch failed|ENOTFOUND|EAI_AGAIN|TLSV1/i.test(mensaje)
    return {
      ok: false,
      error: {
        mensaje,
        transitorio,
        raw_class: e instanceof Error ? e.constructor.name : 'EnvioCorreoError',
      },
    }
  }

  // ─── Registrar el mensaje saliente en `mensajes` ───────────
  // Si hay mensaje disparador, usamos su conversación. Si no, no podemos
  // registrar — quedaría suelto. Por ahora ese caso solo aparece cuando
  // un flujo cron envía un correo sin contexto de inbox; lo registramos
  // sin conversacion_id no se puede (NOT NULL). Decisión: log warning y
  // dejar sin registro (el correo igualmente se envió bien).
  if (mensajeDisparador?.conversacion_id) {
    const { error: errIns } = await admin
      .from('mensajes')
      .insert({
        empresa_id: contexto.empresa_id,
        conversacion_id: mensajeDisparador.conversacion_id,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_nombre: 'Automatización',
        tipo_contenido: htmlResuelto ? 'email_html' : 'email_text',
        texto: textoResuelto,
        html: htmlResuelto,
        correo_de: de,
        correo_para: [destinatario],
        correo_asunto: asuntoResuelto || '(Sin asunto)',
        correo_message_id: messageIdRfc5322,
        correo_in_reply_to: inReplyTo ?? null,
        correo_references: references ?? null,
        estado: 'entregado',
        metadata: {
          origen_flujo: true,
          flujo_id: contexto.flujo_id,
          ejecucion_id: contexto.ejecucion_id,
          origen: registro.origen,
          origen_id: registro.origenId,
          nombre_legible: registro.nombreLegible,
          ...proveedorIdInfo,
        },
      })
    if (errIns) {
      // El correo se envió OK pero no pudimos registrarlo. Loggeamos
      // como warn — no fallamos la acción para no provocar reintento
      // del envío real (esto duplicaría el correo en el destinatario).
      console.warn(
        JSON.stringify({
          nivel: 'warn',
          mensaje: 'envio_correo_registro_mensaje_fallo',
          flujo_id: contexto.flujo_id,
          ejecucion_id: contexto.ejecucion_id,
          conversacion_id: mensajeDisparador.conversacion_id,
          error_message: errIns.message,
          error_code: errIns.code ?? null,
        }),
      )
    }
  }

  return {
    ok: true,
    resultado: {
      destinatario,
      asunto: asuntoResuelto,
      proveedor: canal.proveedor,
      message_id: messageIdRfc5322,
      ...proveedorIdInfo,
    },
  }
}

interface MensajeDisparador {
  id: string
  conversacion_id: string | null
  canal_id: string | null
  correo_de: string | null
  correo_message_id: string | null
  correo_references: string[] | null
}

/**
 * Lee del `contexto_inicial` los campos del mensaje que disparó el flujo,
 * si el disparador fue `inbox.mensaje_recibido`. El dispatcher es el
 * responsable de poblar `contexto_inicial.mensaje_disparador` con esa
 * estructura. Para flujos disparados por cron u otra cosa, devuelve null.
 */
function leerMensajeDisparador(
  contextoInicial: Record<string, unknown> | undefined,
): MensajeDisparador | null {
  if (!contextoInicial) return null
  const md = contextoInicial.mensaje_disparador
  if (typeof md !== 'object' || md === null) return null
  const r = md as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  return {
    id: r.id,
    conversacion_id: typeof r.conversacion_id === 'string' ? r.conversacion_id : null,
    canal_id: typeof r.canal_id === 'string' ? r.canal_id : null,
    correo_de: typeof r.correo_de === 'string' ? r.correo_de : null,
    correo_message_id:
      typeof r.correo_message_id === 'string' ? r.correo_message_id : null,
    correo_references: Array.isArray(r.correo_references)
      ? (r.correo_references as unknown[]).filter(
          (s): s is string => typeof s === 'string',
        )
      : null,
  }
}

/** Extrae el email de un string tipo `"Juan Pérez" <juan@x.com>` o `juan@x.com`. */
function extraerEmail(s: string): string | null {
  const m = /<([^>]+)>/.exec(s)
  if (m) return m[1].trim()
  const t = s.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null
}

function extraerDominio(email: string): string {
  const i = email.indexOf('@')
  return i >= 0 ? email.slice(i + 1) : 'flux.app'
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
      // Marcamos creado_por como NULL: lo creó un workflow, no un
      // usuario humano. La columna nombre se mantiene legible.
      creado_por: null,
      creado_por_nombre: 'Automatización',
    })
    .select('id, titulo')
    .single()

  if (error) return errSupabase(error, 'insertar actividad')

  // Si la acción incluye contacto_id, registrarlo en actividades_relaciones
  // (reemplaza el legacy `vinculos`/`vinculo_ids`). Fetcheamos el nombre
  // para cachear `entidad_nombre`. Si el contacto no existe, omitimos sin
  // romper (es responsabilidad del autor del flujo dar un id válido).
  if (accion.contacto_id) {
    const { data: contacto } = await admin
      .from('contactos')
      .select('nombre, apellido')
      .eq('id', accion.contacto_id)
      .eq('empresa_id', contexto.empresa_id)
      .maybeSingle()
    if (contacto) {
      const nombre = `${contacto.nombre} ${contacto.apellido ?? ''}`.trim()
      await insertarVinculosActividad(
        admin,
        contexto.empresa_id,
        data.id,
        [{ tipo: 'contacto', id: accion.contacto_id, nombre }],
        null,
      )
    }
  }

  // Auto-enriquecimiento (sub-PR 20.2): si el flujo tiene entidad
  // disparadora (no es cron sin entidad), registramos la relación N:M
  // en `actividades_relaciones`. Esto reemplaza el legacy
  // `actividad_origen_id` (FK directa) y permite que `completar_actividad`
  // con `criterio.relacionada_a` resuelva el match en flujos cross-entidad
  // (ej: visita completada → crea actividad → al enviar presupuesto, esa
  // actividad se cierra porque está vinculada a la visita madre).
  //
  // Idempotencia por UNIQUE (empresa_id, actividad_id, entidad_tipo,
  // entidad_id) + ON CONFLICT DO NOTHING. Si el INSERT falla por otro
  // motivo, se loguea como warn pero NO rompe la cadena: el flujo ya
  // creó la actividad, perder la relación es degradación aceptable
  // versus abortar con la actividad huérfana.
  const entidadDisparadora = leerEntidadDisparadora(contexto.contexto_inicial)
  if (entidadDisparadora) {
    const { error: errRel } = await admin
      .from('actividades_relaciones')
      .upsert(
        {
          empresa_id: contexto.empresa_id,
          actividad_id: data.id,
          entidad_tipo: entidadDisparadora.tipo,
          entidad_id: entidadDisparadora.id,
          creado_por: null,
        },
        { onConflict: 'empresa_id,actividad_id,entidad_tipo,entidad_id', ignoreDuplicates: true },
      )
    if (errRel) {
      console.warn(
        JSON.stringify({
          nivel: 'warn',
          mensaje: 'auto_enriquecimiento_relacion_fallo',
          flujo_id: contexto.flujo_id,
          ejecucion_id: contexto.ejecucion_id,
          empresa_id: contexto.empresa_id,
          actividad_id: data.id,
          entidad_tipo: entidadDisparadora.tipo,
          entidad_id: entidadDisparadora.id,
          error_message: errRel.message,
          error_code: errRel.code ?? null,
        }),
      )
    }
  }

  return {
    ok: true,
    resultado: { actividad_id: data.id, titulo: data.titulo },
  }
}

/**
 * Devuelve la entidad disparadora del flujo si el contexto la trae con
 * tipo válido (`EntidadRelacionable`) e id string. Para flujos cron sin
 * entidad o con tipos no-relacionables (ej: nuevos tipos sin agregar a
 * `EntidadRelacionable` aún), devuelve null y el auto-enriquecimiento
 * se saltea silenciosamente.
 */
function leerEntidadDisparadora(
  contextoInicial: Record<string, unknown> | undefined,
): { tipo: string; id: string } | null {
  if (!contextoInicial) return null
  const ent = contextoInicial.entidad
  if (typeof ent !== 'object' || ent === null) return null
  const r = ent as Record<string, unknown>
  if (typeof r.tipo !== 'string' || typeof r.id !== 'string') return null
  if (!esEntidadRelacionable(r.tipo)) return null
  return { tipo: r.tipo, id: r.id }
}

// =============================================================
// 2.bis) completar_actividad (sub-PR 20.1)
// =============================================================
// Reemplazo del helper legacy `auto-completar-actividad.ts` y del campo
// `tipos_actividad.evento_auto_completar` (sub-PR 20.3 elimina ambos
// sembrando flujos del sistema equivalentes).
//
// El criterio define qué actividad(es) cerrar; el resolver de variables
// del orquestador (PR 16) ya resolvió `{{...}}` antes de llegar acá.
// Este handler es agnóstico de variables — solo lee strings literales
// y arma la query.

async function ejecutarCompletarActividad(
  accion: AccionCompletarActividad,
  contexto: ContextoEjecucion,
  admin: SupabaseClient,
): Promise<ResultadoAccion> {
  const c = accion.criterio
  const estadoClave = c.estado_clave ?? 'pendiente'
  const siMultiple = c.si_multiple
  const siNoEncuentra = c.si_no_encuentra ?? 'continuar'

  // Defensa runtime — el validador pre-publicar exige tipo_actividad_id
  // o relacionada_a, pero un flujo cargado desde BD legacy o editado
  // manualmente puede saltearlo. Sin filtro positivo se podrían cerrar
  // todas las actividades de la empresa.
  if (!c.tipo_actividad_id && !c.relacionada_a) {
    return {
      ok: false,
      error: {
        mensaje:
          'completar_actividad requiere al menos tipo_actividad_id o relacionada_a en el criterio.',
        transitorio: false,
        raw_class: 'CriterioInsuficiente',
      },
    }
  }

  // Resolución de `relacionada_a` (sub-PR 20.2): cargamos los
  // `actividad_id` vinculados a la entidad indicada, con filtro
  // explícito por `empresa_id` aunque RLS lo cubre — el motor corre
  // con service_role que bypaseamos RLS, así que el filtro tenant es
  // defensivo y no opcional. Si el resultado es vacío, ya sabemos que
  // no hay matches: short-circuit antes de la query a `actividades`.
  let idsRelacionados: string[] | null = null
  if (c.relacionada_a) {
    const { data: rels, error: errRel } = await admin
      .from('actividades_relaciones')
      .select('actividad_id')
      .eq('empresa_id', contexto.empresa_id)
      .eq('entidad_tipo', c.relacionada_a.entidad_tipo)
      .eq('entidad_id', c.relacionada_a.entidad_id)

    if (errRel) return errSupabase(errRel, 'buscar relaciones de actividad')

    idsRelacionados = ((rels ?? []) as Array<{ actividad_id: string }>).map(
      (r) => r.actividad_id,
    )

    if (idsRelacionados.length === 0) {
      // Sin relaciones registradas → nada para cerrar, respetamos
      // si_no_encuentra (default 'continuar' devuelve cantidad=0).
      if (siNoEncuentra === 'fallar') {
        return {
          ok: false,
          error: {
            mensaje:
              `completar_actividad: ninguna actividad vinculada a ${c.relacionada_a.entidad_tipo}/${c.relacionada_a.entidad_id}.`,
            transitorio: false,
            raw_class: 'NoEncontrada',
          },
        }
      }
      return {
        ok: true,
        resultado: { cantidad: 0, actividades_completadas: [] },
      }
    }
  }

  // Si el criterio filtra por contacto_id, pre-query a
  // actividades_relaciones para resolver los actividad_ids vinculados a
  // ese contacto (reemplaza el legacy `.contains('vinculo_ids', ...)`).
  let idsContacto: string[] | null = null
  if (c.contacto_id) {
    const { data: relsContacto, error: errRelsContacto } = await admin
      .from('actividades_relaciones')
      .select('actividad_id')
      .eq('empresa_id', contexto.empresa_id)
      .eq('entidad_tipo', 'contacto')
      .eq('entidad_id', c.contacto_id)
    if (errRelsContacto) return errSupabase(errRelsContacto, 'resolver actividades por contacto')
    idsContacto = ((relsContacto ?? []) as Array<{ actividad_id: string }>).map((r) => r.actividad_id)
    if (idsContacto.length === 0) {
      // Sin actividades vinculadas a ese contacto: same fallback que matches=0
      if (siNoEncuentra === 'fallar') {
        return {
          ok: false,
          error: {
            mensaje: 'completar_actividad: ninguna actividad coincide con el criterio.',
            transitorio: false,
            raw_class: 'NoEncontrada',
          },
        }
      }
      return { ok: true, resultado: { cantidad: 0, actividades_completadas: [] } }
    }
  }

  // Construir query de búsqueda. limit = 2 cuando si_multiple ≠ 'todas'
  // para detectar el caso "hay más de uno" sin traer toda la tabla.
  let q = admin
    .from('actividades')
    .select('id, titulo, tipo_id, asignados_ids, creado_en')
    .eq('empresa_id', contexto.empresa_id)
    .eq('estado_clave', estadoClave)

  if (c.tipo_actividad_id) q = q.eq('tipo_id', c.tipo_actividad_id)
  if (c.asignado_id) q = q.contains('asignados_ids', [c.asignado_id])
  if (idsContacto !== null) q = q.in('id', idsContacto)
  // Restricción cross-entidad: solo actividades vinculadas a la entidad
  // del criterio.relacionada_a. Combina con tipo_actividad_id si ambos
  // vienen — más restrictivos = mejor especificidad.
  if (idsRelacionados !== null) q = q.in('id', idsRelacionados)

  if (siMultiple === 'todas') {
    q = q.order('creado_en', { ascending: true })
  } else {
    const ascending = siMultiple !== 'mas_reciente'
    q = q.order('creado_en', { ascending }).limit(2)
  }

  const { data, error } = await q
  if (error) return errSupabase(error, 'buscar actividades por criterio')

  const matches = (data ?? []) as Array<{
    id: string
    titulo: string
    tipo_id: string
    asignados_ids: string[] | null
    creado_en: string
  }>

  if (matches.length === 0) {
    if (siNoEncuentra === 'fallar') {
      return {
        ok: false,
        error: {
          mensaje: 'completar_actividad: ninguna actividad coincide con el criterio.',
          transitorio: false,
          raw_class: 'NoEncontrada',
        },
      }
    }
    // Idempotencia: re-ejecuciones legítimas sobre flujo ya completado
    // caen acá y devuelven cantidad=0 sin ruido en logs.
    return {
      ok: true,
      resultado: {
        cantidad: 0,
        actividades_completadas: [],
      },
    }
  }

  if (siMultiple === 'fallar' && matches.length > 1) {
    return {
      ok: false,
      error: {
        mensaje:
          'completar_actividad: el criterio coincide con más de una actividad y si_multiple=fallar.',
        transitorio: false,
        raw_class: 'MultiplesMatches',
      },
    }
  }

  const aCerrar = siMultiple === 'todas' ? matches : matches.slice(0, 1)

  // Dry-run: NO mutar BD. Devolvemos el set que se HABRÍA cerrado con
  // metadata legible (D6 caveat: no solo IDs — incluir título, tipo
  // legible, asignados nombrados y creado_en para que la consola
  // Sandbox muestre algo útil).
  if (contexto.dry_run) {
    const tipoIds = Array.from(new Set(aCerrar.map((a) => a.tipo_id)))
    const { data: tipos } = await admin
      .from('tipos_actividad')
      .select('id, etiqueta, clave')
      .in('id', tipoIds)
      .eq('empresa_id', contexto.empresa_id)
    const tipoMap = new Map(
      ((tipos ?? []) as Array<{ id: string; etiqueta: string | null; clave: string }>).map(
        (t) => [t.id, t.etiqueta ?? t.clave],
      ),
    )

    const asignadoIds = Array.from(
      new Set(aCerrar.flatMap((a) => a.asignados_ids ?? [])),
    )
    let asignadoMap = new Map<string, string>()
    if (asignadoIds.length > 0) {
      const { data: usuarios } = await admin
        .from('usuarios')
        .select('id, nombre_completo')
        .in('id', asignadoIds)
        .eq('empresa_id', contexto.empresa_id)
      asignadoMap = new Map(
        ((usuarios ?? []) as Array<{ id: string; nombre_completo: string | null }>).map(
          (u) => [u.id, u.nombre_completo ?? u.id],
        ),
      )
    }

    return {
      ok: true,
      resultado: {
        simulado: true,
        accion_simulada: 'completar_actividad',
        criterio_resuelto: {
          tipo_actividad_id: c.tipo_actividad_id ?? null,
          contacto_id: c.contacto_id ?? null,
          asignado_id: c.asignado_id ?? null,
          estado_clave: estadoClave,
          relacionada_a: c.relacionada_a ?? null,
          si_multiple: siMultiple,
          si_no_encuentra: siNoEncuentra,
        },
        cantidad: aCerrar.length,
        actividades_que_cerraria: aCerrar.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          tipo_actividad_etiqueta: tipoMap.get(a.tipo_id) ?? null,
          asignado_nombres: (a.asignados_ids ?? []).map(
            (id) => asignadoMap.get(id) ?? id,
          ),
          creado_en: a.creado_en,
        })),
      },
    }
  }

  // Path real: cargar estado 'completada' (cualquier estado en el grupo
  // 'completado'), nombre del flujo (para chatter) y aplicar update +
  // chatter. Mismo patrón que el helper legacy `autoCompletarActividad`.
  const { data: estadoCompletada, error: errEstado } = await admin
    .from('estados_actividad')
    .select('id, clave')
    .eq('empresa_id', contexto.empresa_id)
    .eq('grupo', 'completado')
    .limit(1)
    .maybeSingle()

  if (errEstado) return errSupabase(errEstado, 'cargar estado completada')
  if (!estadoCompletada) {
    return {
      ok: false,
      error: {
        mensaje: 'Estado del grupo "completado" no sembrado para actividades en la empresa.',
        transitorio: false,
        raw_class: 'EstadoNoEncontrado',
      },
    }
  }

  const { data: flujo } = await admin
    .from('flujos')
    .select('nombre')
    .eq('id', contexto.flujo_id)
    .eq('empresa_id', contexto.empresa_id)
    .maybeSingle()
  const nombreFlujo = ((flujo as { nombre?: string } | null)?.nombre ?? '—')

  const ahora = new Date().toISOString()
  const idsCerrar = aCerrar.map((a) => a.id)

  // Update bulk en una sola query — el trigger BEFORE UPDATE de
  // actividades captura el estado anterior y dispara cambios_estado por
  // cada fila modificada.
  const { error: errUpdate } = await admin
    .from('actividades')
    .update({
      estado_id: estadoCompletada.id,
      estado_clave: estadoCompletada.clave,
      fecha_completada: ahora,
      editado_por: null,
      editado_por_nombre: 'Automatización',
      actualizado_en: ahora,
    })
    .eq('empresa_id', contexto.empresa_id)
    .in('id', idsCerrar)

  if (errUpdate) return errSupabase(errUpdate, 'completar actividades')

  // Chatter por actividad cerrada (D5 caveat: incluir motivo si llega).
  const mensajeChatter = accion.motivo
    ? `Completada por flujo «${nombreFlujo}». Motivo: «${accion.motivo}»`
    : `Completada por flujo «${nombreFlujo}»`

  await Promise.all(
    idsCerrar.map((id) =>
      registrarChatter({
        empresaId: contexto.empresa_id,
        entidadTipo: 'actividad',
        entidadId: id,
        contenido: mensajeChatter,
        autorId: null,
        autorNombre: 'Automatización',
        metadata: {
          accion: 'actividad_completada',
          detalles: {
            origen: 'flujo',
            flujo_id: contexto.flujo_id,
            ejecucion_id: contexto.ejecucion_id,
            motivo: accion.motivo ?? null,
          },
        },
      }),
    ),
  )

  return {
    ok: true,
    resultado: {
      cantidad: aCerrar.length,
      actividades_completadas: idsCerrar,
    },
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
