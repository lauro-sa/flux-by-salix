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
import { ENTIDADES_CON_ESTADO } from '@/tipos/estados'

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
  | 'tiempo.relativo_a_campo'
  | 'webhook.entrante'
  | 'inbox.mensaje_recibido'
  | 'inbox.conversacion_sin_respuesta'

export const TIPOS_DISPARADOR: readonly TipoDisparador[] = [
  'entidad.estado_cambio',
  'entidad.creada',
  'entidad.campo_cambia',
  'actividad.completada',
  'tiempo.cron',
  'tiempo.relativo_a_campo',
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
    /**
     * Expresión cron estándar de 5 campos: minuto hora día_mes mes día_semana.
     * Operadores soportados: `*`, `*\/N`, `N-M`, `N,M,O`. Ej: `0 9 * * 1-5`
     * (9am de lunes a viernes), `*\/15 * * * *` (cada 15 minutos).
     */
    expresion: string
  }
}

/**
 * Disparador time-driven que escanea entidades cuyo `campo_fecha`
 * + `delta_dias` cae en el día actual (zona horaria de empresa).
 *
 * Casos típicos del plan §2:
 *   - cuotas que vencen en 3 días        (entidad_tipo: cuota,
 *                                          campo: fecha_vencimiento, delta: -3)
 *   - presupuestos enviados hace 7 días  (entidad_tipo: presupuesto,
 *                                          campo: actualizado_en,  delta: +7)
 *   - revisión post-instalación          (entidad_tipo: visita,
 *                                          campo: fecha_completada, delta: +7)
 *
 * El cron itera por cada entidad matching y crea una ejecución por
 * cada una. La idempotencia es por (flujo_id, entidad_id, día) para
 * que si el cron tick 60 veces el mismo día solo dispare una vez.
 */
export interface DisparadorTiempoRelativoACampo {
  tipo: 'tiempo.relativo_a_campo'
  configuracion: {
    entidad_tipo: EntidadConEstado
    /** Columna timestamptz/date de la tabla principal de la entidad. */
    campo_fecha: string
    /** Días relativos al campo. Negativo = antes, positivo = después. */
    delta_dias: number
    /** Hora del día (formato HH:MM) en zona horaria de empresa. Default '09:00'. */
    hora_local?: string
    /**
     * Tolerancia hacia atrás (en días) para no perder ventanas si el cron
     * estuvo caído. 0 = estricto (solo el día exacto). Default 0.
     */
    tolerancia_dias?: number
    /** Si presente, solo dispara si el estado_clave de la entidad está en la lista. */
    filtro_estado_clave?: string[]
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
  | DisparadorTiempoRelativoACampo
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
// Sub-PR 15.1: las 4 acciones implementadas tienen su shape
// específico modelado como discriminated union sobre `tipo`. Las
// demás del catálogo siguen siendo conocidas pero su shape específico
// se completa cuando se implementan (sub-PR 15.2 y siguientes).

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

// Flag común opcional: si la acción falla irrecuperablemente, ¿el
// flujo se detiene (default) o continúa con la siguiente acción?
// Útil para acciones complementarias que no deben romper la cadena
// (ej: un correo opcional cuyo fallo no impide la actividad principal).
interface AccionBase {
  /** Si está en true y la acción falla, el flujo continúa con la siguiente. Default false. */
  continuar_si_falla?: boolean
}

// ─── Acciones del sub-PR 15.1 (shape específico) ──────────────

export interface AccionEnviarWhatsappPlantilla extends AccionBase {
  tipo: 'enviar_whatsapp_plantilla'
  /** ID del canal de WhatsApp a usar (de canales_whatsapp). */
  canal_id: string
  /** Teléfono destino en formato E.164 sin '+' (ej: '5491134567890'). */
  telefono: string
  /** Nombre de la plantilla aprobada en Meta. */
  plantilla_nombre: string
  /** Código de idioma (ej: 'es_AR', 'es', 'en'). */
  idioma: string
  /**
   * Componentes de la plantilla con variables resueltas (header/body/buttons).
   * Estructura compatible con Meta Cloud API. Si la plantilla no tiene
   * variables, dejar vacío o undefined.
   */
  componentes?: Record<string, unknown>[]
}

export interface AccionCrearActividad extends AccionBase {
  tipo: 'crear_actividad'
  tipo_actividad_id: string
  titulo: string
  descripcion?: string
  /** Array de uuids de usuarios asignados. */
  asignados_ids?: string[]
  /** Vínculo opcional con un contacto (se agrega al array `vinculos`). */
  contacto_id?: string
  fecha_vencimiento?: string
  prioridad?: 'baja' | 'normal' | 'alta'
}

export interface AccionCambiarEstadoEntidad extends AccionBase {
  tipo: 'cambiar_estado_entidad'
  entidad_tipo: EntidadConEstado
  entidad_id: string
  hasta_clave: string
  motivo?: string
}

export interface AccionNotificarUsuario extends AccionBase {
  tipo: 'notificar_usuario'
  usuario_id: string
  titulo: string
  cuerpo?: string
  /** URL relativa para deep-linking desde la notificación. */
  url?: string
  /** Categoría de notificación (matchea `notificaciones.tipo` en BD). */
  notificacion_tipo?: string
}

// ─── Acciones de control de flujo (sub-PR 15.2) ───────────────

export interface AccionEsperar extends AccionBase {
  tipo: 'esperar'
  /**
   * Duración del delay en milisegundos. Mutuamente exclusivo con
   * `hasta_fecha`. Mínimo 1000 (1s), máximo 30 días.
   */
  duracion_ms?: number
  /**
   * Fecha absoluta (ISO 8601) hasta cuándo esperar. Mutuamente
   * exclusivo con `duracion_ms`. Útil para "esperar hasta el
   * próximo lunes a las 9".
   */
  hasta_fecha?: string
}

export interface AccionCondicionBranch extends AccionBase {
  tipo: 'condicion_branch'
  condicion: CondicionWorkflow
  /** Acciones a ejecutar si la condición evalúa true. */
  acciones_si: AccionWorkflow[]
  /** Acciones a ejecutar si la condición evalúa false. */
  acciones_no: AccionWorkflow[]
}

export interface AccionTerminarFlujo extends AccionBase {
  tipo: 'terminar_flujo'
  /** Motivo opcional para auditar por qué el flujo se cortó. */
  motivo?: string
}

// ─── Acciones del catálogo todavía no implementadas ───────────
// Forma genérica: { tipo, parametros }. Cada una tendrá su shape
// específico cuando se implemente (sub-PR 15.3+).
export interface AccionGenerica extends AccionBase {
  tipo: Exclude<
    TipoAccion,
    | 'enviar_whatsapp_plantilla'
    | 'crear_actividad'
    | 'cambiar_estado_entidad'
    | 'notificar_usuario'
    | 'esperar'
    | 'condicion_branch'
    | 'terminar_flujo'
  >
  parametros: Record<string, unknown>
}

export type AccionWorkflow =
  | AccionEnviarWhatsappPlantilla
  | AccionCrearActividad
  | AccionCambiarEstadoEntidad
  | AccionNotificarUsuario
  | AccionEsperar
  | AccionCondicionBranch
  | AccionTerminarFlujo
  | AccionGenerica

// Condiciones (filtros adicionales después del trigger O dentro de
// una acción condicion_branch). El evaluador en
// src/lib/workflows/evaluar-condicion.ts las resuelve contra el
// contexto de la ejecución.
//
// Discriminated union sobre la presencia de `condiciones` (compuesta)
// vs `campo` (hoja). Soporta anidamiento Y/O ilimitado en estructura,
// con guarda de profundidad runtime para evitar recursión maliciosa.

export type OperadorComparacion =
  | 'igual' | 'distinto'
  | 'mayor' | 'menor' | 'mayor_o_igual' | 'menor_o_igual'
  | 'contiene' | 'no_contiene'
  | 'existe' | 'no_existe'
  | 'en_lista' | 'no_en_lista'
  | 'entre'
  | 'dias_desde' | 'dias_hasta'

export interface CondicionHoja {
  /** Path al campo en el contexto. Soporta dot notation: `entidad.estado_nuevo`. */
  campo: string
  operador: OperadorComparacion
  /**
   * Valor a comparar. El tipo depende del operador:
   *   - igual/distinto/contiene/no_contiene: string | number | boolean
   *   - mayor/menor/...: number | Date-string
   *   - existe/no_existe: ignorado
   *   - en_lista/no_en_lista: array
   *   - entre: [min, max]
   *   - dias_desde/dias_hasta: number (cantidad de días)
   */
  valor?: unknown
}

export interface CondicionCompuesta {
  /** 'y' = AND lógico (todas verdaderas). 'o' = OR lógico (al menos una). */
  operador: 'y' | 'o'
  condiciones: CondicionWorkflow[]
}

export type CondicionWorkflow = CondicionHoja | CondicionCompuesta

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

// ─── Type guards de disparadores tiempo (PR 17) ───────────────

export function esDisparadorTiempoCron(d: unknown): d is DisparadorTiempoCron {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'tiempo.cron') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.expresion !== 'string' || c.expresion.length === 0) return false
  return true
}

export function esDisparadorTiempoRelativoACampo(
  d: unknown,
): d is DisparadorTiempoRelativoACampo {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'tiempo.relativo_a_campo') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.entidad_tipo !== 'string') return false
  if (!(ENTIDADES_CON_ESTADO as readonly string[]).includes(c.entidad_tipo)) return false
  if (typeof c.campo_fecha !== 'string' || c.campo_fecha.length === 0) return false
  if (typeof c.delta_dias !== 'number' || !Number.isInteger(c.delta_dias)) return false
  if (
    c.hora_local !== undefined &&
    (typeof c.hora_local !== 'string' || !/^\d{2}:\d{2}$/.test(c.hora_local))
  ) return false
  if (
    c.tolerancia_dias !== undefined &&
    (typeof c.tolerancia_dias !== 'number' || !Number.isInteger(c.tolerancia_dias) || c.tolerancia_dias < 0)
  ) return false
  if (
    c.filtro_estado_clave !== undefined &&
    (!Array.isArray(c.filtro_estado_clave) || !c.filtro_estado_clave.every((s) => typeof s === 'string'))
  ) return false
  return true
}

// ─── Type guards de acciones (sub-PR 15.1) ────────────────────
// El executor del worker usa estos guards para narrowing seguro al
// leer `flujo.acciones[]` (que viene como jsonb crudo de la BD).

function esStringNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function esAccionEnviarWhatsappPlantilla(
  a: unknown,
): a is AccionEnviarWhatsappPlantilla {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'enviar_whatsapp_plantilla') return false
  if (!esStringNoVacio(r.canal_id)) return false
  if (!esStringNoVacio(r.telefono)) return false
  if (!esStringNoVacio(r.plantilla_nombre)) return false
  if (!esStringNoVacio(r.idioma)) return false
  if (r.componentes !== undefined && !Array.isArray(r.componentes)) return false
  return true
}

export function esAccionCrearActividad(a: unknown): a is AccionCrearActividad {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'crear_actividad') return false
  if (!esStringNoVacio(r.tipo_actividad_id)) return false
  if (!esStringNoVacio(r.titulo)) return false
  if (r.descripcion !== undefined && typeof r.descripcion !== 'string') return false
  if (r.asignados_ids !== undefined && !Array.isArray(r.asignados_ids)) return false
  if (r.contacto_id !== undefined && typeof r.contacto_id !== 'string') return false
  return true
}

export function esAccionCambiarEstadoEntidad(
  a: unknown,
): a is AccionCambiarEstadoEntidad {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'cambiar_estado_entidad') return false
  if (typeof r.entidad_tipo !== 'string') return false
  if (!(ENTIDADES_CON_ESTADO as readonly string[]).includes(r.entidad_tipo)) return false
  if (!esStringNoVacio(r.entidad_id)) return false
  if (!esStringNoVacio(r.hasta_clave)) return false
  return true
}

export function esAccionNotificarUsuario(
  a: unknown,
): a is AccionNotificarUsuario {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'notificar_usuario') return false
  if (!esStringNoVacio(r.usuario_id)) return false
  if (!esStringNoVacio(r.titulo)) return false
  if (r.cuerpo !== undefined && typeof r.cuerpo !== 'string') return false
  return true
}

export function esAccionEsperar(a: unknown): a is AccionEsperar {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'esperar') return false
  // Exactamente uno de duracion_ms o hasta_fecha debe estar presente.
  const tieneDuracion = typeof r.duracion_ms === 'number' && r.duracion_ms > 0
  const tieneFecha = typeof r.hasta_fecha === 'string' && r.hasta_fecha.length > 0
  if (tieneDuracion === tieneFecha) return false // ambos true o ambos false → inválido
  if (tieneDuracion && (r.duracion_ms as number) < 1000) return false // mínimo 1s
  if (tieneDuracion && (r.duracion_ms as number) > 30 * 24 * 3600 * 1000) return false // máx 30d
  return true
}

export function esAccionCondicionBranch(
  a: unknown,
): a is AccionCondicionBranch {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'condicion_branch') return false
  if (!esCondicionWorkflow(r.condicion)) return false
  if (!Array.isArray(r.acciones_si)) return false
  if (!Array.isArray(r.acciones_no)) return false
  return true
}

export function esAccionTerminarFlujo(a: unknown): a is AccionTerminarFlujo {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'terminar_flujo') return false
  if (r.motivo !== undefined && typeof r.motivo !== 'string') return false
  return true
}

const OPERADORES_COMPARACION = new Set<string>([
  'igual', 'distinto',
  'mayor', 'menor', 'mayor_o_igual', 'menor_o_igual',
  'contiene', 'no_contiene',
  'existe', 'no_existe',
  'en_lista', 'no_en_lista',
  'entre',
  'dias_desde', 'dias_hasta',
])

/**
 * Valida una condición (hoja o compuesta). Recursivo para compuestas,
 * con tope de profundidad razonable. La profundidad efectiva de
 * ejecución se valida en `evaluar-condicion.ts` (3 niveles por defecto).
 */
export function esCondicionWorkflow(c: unknown, profundidad = 0): c is CondicionWorkflow {
  if (typeof c !== 'object' || c === null) return false
  if (profundidad > 10) return false // tope estructural duro
  const r = c as Record<string, unknown>
  // Compuesta: tiene `condiciones` array.
  if (Array.isArray(r.condiciones)) {
    if (r.operador !== 'y' && r.operador !== 'o') return false
    return r.condiciones.every((sub) => esCondicionWorkflow(sub, profundidad + 1))
  }
  // Hoja: tiene `campo` + `operador`.
  if (typeof r.campo !== 'string' || r.campo.length === 0) return false
  if (typeof r.operador !== 'string') return false
  if (!OPERADORES_COMPARACION.has(r.operador)) return false
  return true
}

/**
 * Valida la forma mínima de cualquier acción del catálogo: que sea
 * objeto, tenga `tipo` string conocido. NO valida el shape específico
 * de cada tipo — para eso están los guards individuales arriba.
 */
export function esAccionConocida(a: unknown): a is AccionWorkflow {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  return esTipoAccion(r.tipo)
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
