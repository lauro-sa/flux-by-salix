/**
 * Tipos del sistema genérico de estados y transiciones de Flux.
 *
 * Estos tipos modelan la infraestructura transversal de cambios de
 * estado, sobre la que se apoyan todas las entidades con estado del
 * sistema (presupuestos, órdenes, visitas, conversaciones, etc.) y
 * sobre la que se va a construir el motor futuro de workflows.
 *
 * Tablas relacionadas:
 *   - cambios_estado          → auditoría unificada de cambios.
 *   - transiciones_estado     → catálogo de transiciones válidas.
 *
 * Migración fuente: sql/044_estados_infraestructura.sql
 */

// ─── Discriminador de entidad ─────────────────────────────────
// Tipos de entidad que tienen estado en Flux. Cada vez que una
// entidad nueva se conecte a la infraestructura genérica, se agrega
// su clave acá. Usamos string literal union para que el typecheck
// detecte usos inválidos.

export type EntidadConEstado =
  | 'presupuesto'
  | 'orden'
  | 'visita'
  | 'conversacion'
  | 'asistencia'
  | 'cuota'
  | 'actividad'

export const ENTIDADES_CON_ESTADO: readonly EntidadConEstado[] = [
  'presupuesto',
  'orden',
  'visita',
  'conversacion',
  'asistencia',
  'cuota',
  'actividad',
] as const

export const ETIQUETAS_ENTIDAD: Record<EntidadConEstado, string> = {
  presupuesto: 'Presupuesto',
  orden: 'Orden de trabajo',
  visita: 'Visita',
  conversacion: 'Conversación',
  asistencia: 'Asistencia',
  cuota: 'Cuota',
  actividad: 'Actividad',
}

// ─── Grupo semántico ──────────────────────────────────────────
// Cada estado de cada entidad pertenece a un grupo. El grupo da
// significado transversal: workflows, reportes y UI razonan sobre
// grupos (no sobre claves específicas de cada entidad).

export type GrupoEstado =
  | 'inicial'      // estado inicial al crear (borrador, abierta, programada)
  | 'activo'       // entidad en uso normal
  | 'espera'       // bloqueada esperando algo externo
  | 'completado'   // terminó exitosamente
  | 'cancelado'    // se canceló o rechazó
  | 'error'        // terminó con error o se auto-cerró por fallo

export const GRUPOS_ESTADO: readonly GrupoEstado[] = [
  'inicial',
  'activo',
  'espera',
  'completado',
  'cancelado',
  'error',
] as const

export const ETIQUETAS_GRUPO: Record<GrupoEstado, string> = {
  inicial: 'Inicial',
  activo: 'Activo',
  espera: 'En espera',
  completado: 'Completado',
  cancelado: 'Cancelado',
  error: 'Error',
}

// Grupos que se consideran "terminales" (no permiten más transiciones
// salvo reactivación explícita). Útil para queries y validaciones.
export const GRUPOS_TERMINALES: readonly GrupoEstado[] = [
  'completado',
  'cancelado',
  'error',
] as const

// ─── Origen del cambio ────────────────────────────────────────
// Identifica quién o qué disparó el cambio. Imprescindible para
// auditoría y para que workflows puedan filtrar por origen
// (ej: "solo disparar este flujo si el cambio fue manual").

export type OrigenCambioEstado =
  | 'manual'       // usuario lo cambió desde la UI
  | 'sistema'      // disparado por lógica interna
  | 'workflow'     // disparado por una automatización configurada
  | 'api'          // invocado desde una API externa
  | 'webhook'      // proveniente de webhook entrante (Meta, etc)
  | 'cron'         // job programado

export const ORIGENES_CAMBIO_ESTADO: readonly OrigenCambioEstado[] = [
  'manual',
  'sistema',
  'workflow',
  'api',
  'webhook',
  'cron',
] as const

export const ETIQUETAS_ORIGEN: Record<OrigenCambioEstado, string> = {
  manual: 'Manual',
  sistema: 'Sistema',
  workflow: 'Automatización',
  api: 'API',
  webhook: 'Webhook',
  cron: 'Tarea programada',
}

// ─── Filas de las tablas ──────────────────────────────────────

export interface CambioEstado {
  id: string
  empresa_id: string

  entidad_tipo: EntidadConEstado
  entidad_id: string

  estado_anterior: string | null
  estado_nuevo: string

  grupo_anterior: GrupoEstado | null
  grupo_nuevo: GrupoEstado | null

  origen: OrigenCambioEstado

  usuario_id: string | null
  usuario_nombre: string | null

  motivo: string | null

  metadatos: Record<string, unknown>
  contexto: Record<string, unknown>

  creado_en: string
}

export interface TransicionEstado {
  id: string
  // empresa_id NULL = transición del sistema (válida para todas).
  empresa_id: string | null

  entidad_tipo: EntidadConEstado

  // desde_clave NULL = desde cualquier estado.
  desde_clave: string | null
  hasta_clave: string

  etiqueta: string | null
  descripcion: string | null

  es_automatica: boolean
  requiere_motivo: boolean
  requiere_confirmacion: boolean

  condiciones: TransicionCondicion[]

  orden: number
  activo: boolean

  creado_en: string
  actualizado_en: string
}

// Condición declarativa para transiciones. Por ahora se deja como
// estructura abierta pero tipada. El motor de workflows futuro va a
// definir el set completo de operadores.
export interface TransicionCondicion {
  campo: string
  operador: 'igual' | 'distinto' | 'mayor' | 'menor' | 'contiene' | 'existe' | 'no_existe'
  valor: string | number | boolean | null
}

// ─── Inputs para invocar funciones SQL desde TypeScript ───────

// Coincide con la firma de `registrar_cambio_estado(...)` en SQL.
// Los triggers de cada entidad lo invocan internamente, pero también
// se puede llamar desde código de aplicación cuando una transición
// ocurre por una vía que no pasa por un UPDATE directo.
export interface RegistrarCambioEstadoInput {
  empresa_id: string
  entidad_tipo: EntidadConEstado
  entidad_id: string
  estado_anterior: string | null
  estado_nuevo: string
  grupo_anterior?: GrupoEstado | null
  grupo_nuevo?: GrupoEstado | null
  origen?: OrigenCambioEstado
  usuario_id?: string | null
  usuario_nombre?: string | null
  motivo?: string | null
  metadatos?: Record<string, unknown>
  contexto?: Record<string, unknown>
}

// Resultado de obtener_transiciones_disponibles(...).
export interface TransicionDisponible {
  id: string
  hasta_clave: string
  etiqueta: string | null
  descripcion: string | null
  es_automatica: boolean
  requiere_motivo: boolean
  requiere_confirmacion: boolean
  orden: number
}

// ─── Type guards ──────────────────────────────────────────────

export function esEntidadConEstado(valor: unknown): valor is EntidadConEstado {
  return typeof valor === 'string' && (ENTIDADES_CON_ESTADO as readonly string[]).includes(valor)
}

export function esGrupoEstado(valor: unknown): valor is GrupoEstado {
  return typeof valor === 'string' && (GRUPOS_ESTADO as readonly string[]).includes(valor)
}

export function esOrigenCambioEstado(valor: unknown): valor is OrigenCambioEstado {
  return typeof valor === 'string' && (ORIGENES_CAMBIO_ESTADO as readonly string[]).includes(valor)
}

export function esGrupoTerminal(grupo: GrupoEstado | null): boolean {
  return grupo !== null && (GRUPOS_TERMINALES as readonly string[]).includes(grupo)
}
