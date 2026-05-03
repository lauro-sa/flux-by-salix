/**
 * Tipos del sistema de órdenes de trabajo de Flux.
 * Se usa en: listado, detalle, generación desde presupuesto, integración actividades.
 */

// ─── Estados de la orden de trabajo ───

// Renombre histórico (PR 9): la clave 'esperando' pasó a 'en_espera' para
// alineación con la convención del sistema (frase preposicional, no gerundio).
// El trigger BEFORE INSERT/UPDATE en BD traduce 'esperando' a 'en_espera' por
// compatibilidad si llegara a colarse.
export type EstadoOrdenTrabajo =
  | 'abierta'
  | 'en_progreso'
  | 'en_espera'
  | 'completada'
  | 'cancelada'

export type PrioridadOrdenTrabajo = 'baja' | 'media' | 'alta' | 'urgente'

export const ETIQUETAS_ESTADO_OT: Record<EstadoOrdenTrabajo, string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export const ETIQUETAS_PRIORIDAD_OT: Record<PrioridadOrdenTrabajo, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
}

// Colores para badges de estado
export const COLORES_ESTADO_OT: Record<EstadoOrdenTrabajo, { fondo: string; texto: string }> = {
  abierta: { fondo: 'bg-insignia-info-fondo', texto: 'text-insignia-info-texto' },
  en_progreso: { fondo: 'bg-texto-marca/15', texto: 'text-texto-marca' },
  en_espera: { fondo: 'bg-insignia-advertencia-fondo', texto: 'text-insignia-advertencia-texto' },
  completada: { fondo: 'bg-insignia-exito-fondo', texto: 'text-insignia-exito-texto' },
  cancelada: { fondo: 'bg-insignia-peligro-fondo', texto: 'text-insignia-peligro-texto' },
}

// Colores para badges de prioridad
export const COLORES_PRIORIDAD_OT: Record<PrioridadOrdenTrabajo, { fondo: string; texto: string }> = {
  baja: { fondo: 'bg-white/[0.06]', texto: 'text-texto-terciario' },
  media: { fondo: 'bg-insignia-info-fondo', texto: 'text-insignia-info-texto' },
  alta: { fondo: 'bg-insignia-advertencia-fondo', texto: 'text-insignia-advertencia-texto' },
  urgente: { fondo: 'bg-insignia-peligro-fondo', texto: 'text-insignia-peligro-texto' },
}

// Flujo progresivo (happy path)
export const FLUJO_ESTADO_OT: EstadoOrdenTrabajo[] = [
  'abierta', 'en_progreso', 'en_espera', 'completada',
]

// Estados terminales
export const ESTADOS_TERMINALES_OT: EstadoOrdenTrabajo[] = ['cancelada']

// Transiciones válidas desde cada estado
export const TRANSICIONES_ESTADO_OT: Record<EstadoOrdenTrabajo, EstadoOrdenTrabajo[]> = {
  abierta: ['en_progreso', 'cancelada'],
  en_progreso: ['en_espera', 'completada', 'cancelada'],
  en_espera: ['en_progreso', 'cancelada'],
  completada: ['en_progreso'], // reabrir
  cancelada: ['abierta'], // reactivar
}

// ─── Tipos de línea (operativa, sin descuento) ───

export type TipoLineaOT = 'producto' | 'seccion' | 'nota'

// ─── Interfaces ───

export interface OrdenTrabajo {
  id: string
  empresa_id: string
  numero: string
  estado: EstadoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  titulo: string
  descripcion: string | null
  notas: string | null

  // Contacto operativo
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  contacto_correo: string | null
  contacto_direccion: string | null
  contacto_whatsapp: string | null

  // Presupuesto origen
  presupuesto_id: string | null
  presupuesto_numero: string | null

  // Dirigido a (atención) — para avisos de llegada
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_telefono: string | null
  atencion_correo: string | null

  // Publicación (borrador vs visible para asignados)
  publicada: boolean

  // Responsable legacy (cabecilla denormalizado para queries rápidas)
  asignado_a: string | null
  asignado_nombre: string | null

  // Fechas
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  fecha_fin_real: string | null

  // Auditoría
  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string

  // Soft delete
  en_papelera: boolean
  papelera_en: string | null
}

export interface LineaOrdenTrabajo {
  id: string
  orden_trabajo_id: string
  empresa_id: string
  tipo_linea: TipoLineaOT
  orden: number
  codigo_producto: string | null
  descripcion: string | null
  descripcion_detalle: string | null
  cantidad: string
  unidad: string | null
  creado_en: string
}

export interface HistorialOrdenTrabajo {
  id: string
  orden_trabajo_id: string
  empresa_id: string
  estado: EstadoOrdenTrabajo
  usuario_id: string
  usuario_nombre: string | null
  fecha: string
  notas: string | null
}

// ─── Asignados a la OT ───

export interface AsignadoOrdenTrabajo {
  id: string
  orden_trabajo_id: string
  empresa_id: string
  usuario_id: string
  usuario_nombre: string
  es_cabecilla: boolean
  creado_en: string
}

export interface OrdenTrabajoConDetalle extends OrdenTrabajo {
  lineas: LineaOrdenTrabajo[]
  historial: HistorialOrdenTrabajo[]
  asignados: AsignadoOrdenTrabajo[]
  progreso: {
    total_actividades: number
    completadas: number
    porcentaje: number
  }
}
