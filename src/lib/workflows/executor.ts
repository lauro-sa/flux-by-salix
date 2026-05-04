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
} from '@/tipos/workflow'
import {
  esAccionEnviarWhatsappPlantilla,
  esAccionCrearActividad,
  esAccionCambiarEstadoEntidad,
  esAccionNotificarUsuario,
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
// con datos de la entidad disparadora, actor, empresa, etc.
export interface ContextoEjecucion {
  empresa_id: string
  ejecucion_id: string
  flujo_id: string
}

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
  // Acciones del catálogo todavía no implementadas (sub-PR 15.2+).
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
  const { data, error } = await admin
    .from('notificaciones')
    .insert({
      empresa_id: contexto.empresa_id,
      usuario_id: accion.usuario_id,
      tipo: accion.notificacion_tipo ?? 'workflow',
      titulo: accion.titulo,
      cuerpo: accion.cuerpo ?? null,
      url: accion.url ?? null,
      referencia_tipo: 'ejecucion_flujo',
      referencia_id: contexto.ejecucion_id,
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
