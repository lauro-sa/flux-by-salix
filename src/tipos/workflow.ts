/**
 * Tipos del motor de workflows / automatizaciones de Flux.
 *
 * Modela las definiciones de flujos, ejecuciones y acciones diferidas
 * sobre las que opera el dispatcher (PR 14) y el worker (PR 15+). El
 * catálogo de tipos de disparador y de tipos de acción se mantiene
 * acá como única fuente de verdad — el SQL no los materializa con
 * CHECK constraints (decisión del PR 13).
 *
 * Tablas relacionadas:
 *   - flujos               → definiciones por empresa.
 *   - ejecuciones_flujo    → log por ejecución concreta.
 *   - acciones_pendientes  → cola de acciones diferidas.
 *
 * Migración fuente: sql/054_workflows_schema.sql
 */

import type {
  CambioEstado,
  EntidadConEstado,
} from '@/tipos/estados'

// =============================================================
// Catálogo de tipos de disparador
// =============================================================
// Cada flujo se dispara por exactamente un trigger de la lista. La
// configuración específica varía por tipo y se modela como
// discriminated union sobre el campo `tipo`.

export type TipoDisparador =
  | 'entidad.estado_cambio'
  | 'entidad.creada'
  | 'entidad.campo_cambia'
  | 'actividad.completada'
  | 'tiempo.cron'
  | 'webhook.entrante'
  | 'inbox.mensaje_recibido'
  | 'inbox.conversacion_sin_respuesta'

export const TIPOS_DISPARADOR: readonly TipoDisparador[] = [
  'entidad.estado_cambio',
  'entidad.creada',
  'entidad.campo_cambia',
  'actividad.completada',
  'tiempo.cron',
  'webhook.entrante',
  'inbox.mensaje_recibido',
  'inbox.conversacion_sin_respuesta',
] as const

// El único trigger que el PR 14 procesa. Los demás se implementan en
// sus PRs respectivos (cron en PR 17, webhook entrante en PR 18+, etc.).
export interface DisparadorEntidadEstadoCambio {
  tipo: 'entidad.estado_cambio'
  configuracion: {
    /** Tipo de entidad cuyo cambio dispara el flujo. */
    entidad_tipo: EntidadConEstado
    /** Estado destino que dispara. */
    hasta_clave: string
    /**
     * Estado de origen requerido. Si es null/undefined, dispara desde
     * cualquier estado anterior.
     */
    desde_clave?: string | null
  }
}

export interface DisparadorEntidadCreada {
  tipo: 'entidad.creada'
  configuracion: {
    entidad_tipo: EntidadConEstado
  }
}

export interface DisparadorEntidadCampoCambia {
  tipo: 'entidad.campo_cambia'
  configuracion: {
    entidad_tipo: EntidadConEstado
    campo: string
    valor?: string | number | boolean | null
  }
}

export interface DisparadorActividadCompletada {
  tipo: 'actividad.completada'
  configuracion: {
    /** Si está presente, solo dispara para actividades de ese tipo. */
    tipo_clave?: string
  }
}

export interface DisparadorTiempoCron {
  tipo: 'tiempo.cron'
  configuracion: {
    /** Expresión cron estándar (5 campos). */
    expresion: string
    /** Scope opcional: filtra qué entidades evaluar. */
    scope?: {
      entidad_tipo?: EntidadConEstado
      condicion?: unknown
    }
  }
}

export interface DisparadorWebhookEntrante {
  tipo: 'webhook.entrante'
  configuracion: {
    /** Slug que identifica al webhook en la URL pública. */
    slug: string
  }
}

export interface DisparadorInboxMensajeRecibido {
  tipo: 'inbox.mensaje_recibido'
  configuracion: {
    canal_id?: string
    filtros?: Record<string, unknown>
  }
}

export interface DisparadorInboxConversacionSinRespuesta {
  tipo: 'inbox.conversacion_sin_respuesta'
  configuracion: {
    /** Tiempo en minutos sin respuesta. */
    minutos_sin_respuesta: number
    canal_id?: string
  }
}

export type DisparadorWorkflow =
  | DisparadorEntidadEstadoCambio
  | DisparadorEntidadCreada
  | DisparadorEntidadCampoCambia
  | DisparadorActividadCompletada
  | DisparadorTiempoCron
  | DisparadorWebhookEntrante
  | DisparadorInboxMensajeRecibido
  | DisparadorInboxConversacionSinRespuesta

// =============================================================
// Catálogo de tipos de acción
// =============================================================
// Las acciones las consume el worker (PR 15+). El dispatcher (PR 14)
// no las procesa — solo crea la ejecución y deja al worker que
// resuelva la lista.
//
// Para PR 14 modelamos solo la forma genérica { tipo, parametros }.
// Cada tipo de acción tendrá su discriminated union específica
// cuando se implemente en su PR.

export type TipoAccion =
  | 'enviar_whatsapp_plantilla'
  | 'enviar_whatsapp_texto'
  | 'enviar_correo_plantilla'
  | 'enviar_correo_texto'
  | 'crear_actividad'
  | 'cambiar_estado_entidad'
  | 'asignar_usuario'
  | 'agregar_etiqueta'
  | 'quitar_etiqueta'
  | 'notificar_usuario'
  | 'notificar_grupo'
  | 'crear_orden_trabajo'
  | 'crear_visita'
  | 'webhook_saliente'
  | 'esperar'
  | 'esperar_evento'
  | 'condicion_branch'
  | 'terminar_flujo'

export const TIPOS_ACCION: readonly TipoAccion[] = [
  'enviar_whatsapp_plantilla',
  'enviar_whatsapp_texto',
  'enviar_correo_plantilla',
  'enviar_correo_texto',
  'crear_actividad',
  'cambiar_estado_entidad',
  'asignar_usuario',
  'agregar_etiqueta',
  'quitar_etiqueta',
  'notificar_usuario',
  'notificar_grupo',
  'crear_orden_trabajo',
  'crear_visita',
  'webhook_saliente',
  'esperar',
  'esperar_evento',
  'condicion_branch',
  'terminar_flujo',
] as const

export interface AccionWorkflow {
  tipo: TipoAccion
  parametros: Record<string, unknown>
}

// Condiciones (filtros adicionales después del trigger). El motor del
// PR 16 las evalúa contra el contexto de la ejecución.
export interface CondicionWorkflow {
  campo: string
  operador:
    | 'igual' | 'distinto'
    | 'mayor' | 'menor' | 'mayor_o_igual' | 'menor_o_igual'
    | 'contiene' | 'no_contiene'
    | 'existe' | 'no_existe'
    | 'en_lista' | 'no_en_lista'
    | 'entre'
    | 'dias_desde' | 'dias_hasta'
  valor?: unknown
}

// =============================================================
// Estados de la máquina interna del motor
// =============================================================

export type EstadoEjecucion =
  | 'pendiente'
  | 'corriendo'
  | 'esperando'
  | 'completado'
  | 'fallado'
  | 'cancelado'

export const ESTADOS_EJECUCION: readonly EstadoEjecucion[] = [
  'pendiente', 'corriendo', 'esperando', 'completado', 'fallado', 'cancelado',
] as const

export type EstadoAccion =
  | 'pendiente'
  | 'ejecutando'
  | 'ok'
  | 'fallo'
  | 'cancelada'

export const ESTADOS_ACCION: readonly EstadoAccion[] = [
  'pendiente', 'ejecutando', 'ok', 'fallo', 'cancelada',
] as const

// =============================================================
// Filas de las tablas
// =============================================================
// jsonb columns se tipan como `unknown` deliberadamente: los
// consumidores deben validar la forma con type guards antes de
// usar los campos. Es la línea de defensa contra datos rotos por
// versiones viejas o ediciones manuales en BD.

export interface Flujo {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  disparador: unknown
  condiciones: unknown
  acciones: unknown
  nodos_json: unknown
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

export interface EjecucionFlujo {
  id: string
  empresa_id: string
  flujo_id: string
  estado: EstadoEjecucion
  disparado_por: string | null
  contexto_inicial: unknown
  log: unknown
  inicio_en: string | null
  fin_en: string | null
  proximo_paso_en: string | null
  intentos: number
  clave_idempotencia: string | null
  creado_en: string
}

export interface AccionPendiente {
  id: string
  empresa_id: string
  ejecucion_id: string
  tipo_accion: TipoAccion
  parametros: unknown
  ejecutar_en: string
  estado: EstadoAccion
  resultado: unknown
  intentos: number
  creado_en: string
  actualizado_en: string
}

// =============================================================
// Origen del disparo (formato discriminado de `disparado_por`)
// =============================================================
// La columna ejecuciones_flujo.disparado_por es un text con prefijo:
//   cambios_estado:<uuid> | cron:<expr> | manual:<user-id> | webhook:<url>
// Estos helpers serializan/parsean ese formato sin riesgo de errores
// de string concat dispersos por el código.

export type OrigenDisparador =
  | { tipo: 'cambios_estado'; cambios_estado_id: string }
  | { tipo: 'cron'; expresion: string }
  | { tipo: 'manual'; usuario_id: string }
  | { tipo: 'webhook'; url: string }

export function serializarDisparadoPor(o: OrigenDisparador): string {
  switch (o.tipo) {
    case 'cambios_estado': return `cambios_estado:${o.cambios_estado_id}`
    case 'cron': return `cron:${o.expresion}`
    case 'manual': return `manual:${o.usuario_id}`
    case 'webhook': return `webhook:${o.url}`
  }
}

export function parsearDisparadoPor(s: string | null): OrigenDisparador | null {
  if (!s) return null
  const idx = s.indexOf(':')
  if (idx === -1) return null
  const prefijo = s.slice(0, idx)
  const valor = s.slice(idx + 1)
  switch (prefijo) {
    case 'cambios_estado': return { tipo: 'cambios_estado', cambios_estado_id: valor }
    case 'cron': return { tipo: 'cron', expresion: valor }
    case 'manual': return { tipo: 'manual', usuario_id: valor }
    case 'webhook': return { tipo: 'webhook', url: valor }
    default: return null
  }
}

// =============================================================
// Clave de idempotencia
// =============================================================
// El UNIQUE parcial sobre (flujo_id, clave_idempotencia) en
// ejecuciones_flujo garantiza que dos disparos por el mismo evento
// no creen dos ejecuciones. Convención del PR 13: el dispatcher
// arma la clave determinísticamente desde flujo_id + cambios_estado_id.

export function armarClaveIdempotencia(
  flujoId: string,
  cambiosEstadoId: string,
): string {
  return `flujo:${flujoId}:evento:${cambiosEstadoId}`
}

// =============================================================
// Webhook payload de Database Webhooks de Supabase
// =============================================================
// Supabase Database Webhooks postean un body con esta forma exacta
// cuando se configura un trigger ON INSERT sobre una tabla. El
// dispatcher (PR 14) recibe esto en su Edge Function.
//
// Documentación oficial:
//   https://supabase.com/docs/guides/database/webhooks

export interface WebhookPayloadCambiosEstado {
  type: 'INSERT'
  table: 'cambios_estado'
  schema: 'public'
  record: CambioEstado
  old_record: null
}

// =============================================================
// Type guards
// =============================================================

export function esTipoDisparador(v: unknown): v is TipoDisparador {
  return typeof v === 'string' && (TIPOS_DISPARADOR as readonly string[]).includes(v)
}

export function esTipoAccion(v: unknown): v is TipoAccion {
  return typeof v === 'string' && (TIPOS_ACCION as readonly string[]).includes(v)
}

export function esEstadoEjecucion(v: unknown): v is EstadoEjecucion {
  return typeof v === 'string' && (ESTADOS_EJECUCION as readonly string[]).includes(v)
}

/**
 * Valida que un objeto tenga la forma de DisparadorEntidadEstadoCambio.
 * Se usa en el dispatcher para narrowing seguro del jsonb crudo de la
 * tabla `flujos`. Si vuelve true, los campos son seguros de leer.
 */
export function esDisparadorEntidadEstadoCambio(
  d: unknown,
): d is DisparadorEntidadEstadoCambio {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'entidad.estado_cambio') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.entidad_tipo !== 'string') return false
  if (typeof c.hasta_clave !== 'string') return false
  if (
    c.desde_clave !== undefined &&
    c.desde_clave !== null &&
    typeof c.desde_clave !== 'string'
  ) {
    return false
  }
  return true
}

/**
 * Valida que un body desconocido sea un webhook payload de Supabase
 * para INSERT en public.cambios_estado. Es el primer chequeo que hace
 * la Edge Function antes de procesar — si falla, devuelve 400.
 *
 * Verifica solo los campos que el dispatcher necesita para hacer match
 * (id, empresa_id, entidad_tipo, entidad_id, estado_nuevo). Los demás
 * pasan por validación implícita al usarlos.
 */
export function esWebhookPayloadCambiosEstado(
  p: unknown,
): p is WebhookPayloadCambiosEstado {
  if (typeof p !== 'object' || p === null) return false
  const r = p as Record<string, unknown>
  if (r.type !== 'INSERT') return false
  if (r.table !== 'cambios_estado') return false
  if (r.schema !== 'public') return false
  if (typeof r.record !== 'object' || r.record === null) return false
  const rec = r.record as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.empresa_id !== 'string' || rec.empresa_id.length === 0) return false
  if (typeof rec.entidad_tipo !== 'string' || rec.entidad_tipo.length === 0) return false
  if (typeof rec.entidad_id !== 'string' || rec.entidad_id.length === 0) return false
  if (typeof rec.estado_nuevo !== 'string' || rec.estado_nuevo.length === 0) return false
  // estado_anterior puede ser null (creación) o string.
  if (rec.estado_anterior !== null && typeof rec.estado_anterior !== 'string') return false
  return true
}
