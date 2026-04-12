/**
 * Matriz de colores semánticos por entidad.
 * Centraliza qué color de insignia usa cada tipo, estado, prioridad y canal.
 * Importar desde: import { COLORES } from '@/lib/colores_entidad'
 *
 * Los valores corresponden a tokens de insignia definidos en tokens.css:
 * exito, peligro, advertencia, info, primario, neutro, rosa, cyan, violeta, naranja
 */

import type { ColorInsignia } from '@/componentes/ui/Insignia'

// ─── Colores por defecto ───

/** Color marca Índigo de Flux — fallback cuando la empresa no tiene color_marca configurado */
export const COLOR_MARCA_DEFECTO = '#5b5bd6'

/** Color gris neutro — fallback para etiquetas sin color asignado */
export const COLOR_ETIQUETA_DEFECTO = '#6b7280'

// ─── Tipos de contacto ───

export const COLOR_TIPO_CONTACTO: Record<string, ColorInsignia> = {
  persona:   'primario',
  empresa:   'info',
  edificio:  'cyan',          // verdecito/turquesa
  proveedor: 'naranja',
  lead:      'advertencia',   // ámbar — oportunidad por cerrar
  equipo:    'exito',
}

// ─── Prioridades ───

export const COLOR_PRIORIDAD: Record<string, ColorInsignia> = {
  baja:    'neutro',
  normal:  'info',
  alta:    'naranja',
  urgente: 'peligro',
}

// ─── Estados de actividad ───

export const COLOR_ESTADO_ACTIVIDAD: Record<string, ColorInsignia> = {
  pendiente:  'advertencia',
  completada: 'exito',
  vencida:    'peligro',
  cancelada:  'neutro',
}

// ─── Estados de visita ───

export const COLOR_ESTADO_VISITA: Record<string, ColorInsignia> = {
  programada:  'info',
  en_camino:   'advertencia',
  en_sitio:    'naranja',
  completada:  'exito',
  cancelada:   'neutro',
}

// ─── Estados de documento ───

export const COLOR_ESTADO_DOCUMENTO: Record<string, ColorInsignia> = {
  borrador:            'neutro',
  enviado:             'violeta',
  confirmado_cliente:  'info',
  orden_venta:         'exito',
  confirmado:          'info',
  aceptado:            'exito',
  rechazado:           'peligro',
  pagado:              'exito',
  vencido:             'naranja',
  cancelado:           'neutro',
  archivado:           'neutro',
}

// ─── Estados de orden de trabajo ───

export const COLOR_ESTADO_ORDEN: Record<string, ColorInsignia> = {
  borrador_ot:  'neutro',
  programada:   'info',
  en_ejecucion: 'advertencia',
  completada_ot: 'exito',
}

// ─── Etapas de pipeline (default) ───

export const COLOR_ETAPA_PIPELINE: Record<string, ColorInsignia> = {
  nuevo:               'neutro',
  interesado:          'advertencia',
  visita_programada:   'info',
  presupuesto_enviado: 'violeta',
  cliente_activo:      'exito',
  cerrado:             'peligro',
}

// ─── Estados de asistencia ───

export const COLOR_ESTADO_ASISTENCIA: Record<string, ColorInsignia> = {
  activo:       'exito',
  almuerzo:     'advertencia',
  particular:   'cyan',
  cerrado:      'neutro',
  auto_cerrado: 'naranja',
}

// ─── Tipos de jornada ───

export const COLOR_TIPO_JORNADA: Record<string, ColorInsignia> = {
  normal:    'exito',
  tardanza:  'advertencia',
  ausencia:  'peligro',
}

// ─── Canales de comunicación ───

export const COLOR_CANAL: Record<string, ColorInsignia> = {
  whatsapp: 'exito',
  correo:   'info',
  interno:  'violeta',
}

// ─── Estados de evento de calendario ───

export const COLOR_ESTADO_EVENTO: Record<string, ColorInsignia> = {
  confirmado: 'exito',
  tentativo:  'advertencia',
  cancelado:  'neutro',
}

// ─── Tipos de producto/servicio ───

export const COLOR_TIPO_PRODUCTO: Record<string, ColorInsignia> = {
  producto: 'info',
  servicio: 'exito',
}

// ─── Paletas hex para defaults/seeds ───

/** Colores hex para etiquetas predefinidas de inbox */
export const COLORES_ETIQUETA_INBOX: Record<string, string> = {
  consulta:     '#3b82f6',
  venta:        '#22c55e',
  soporte:      '#f59e0b',
  reclamo:      '#ef4444',
  presupuesto:  '#8b5cf6',
  postventa:    '#06b6d4',
  urgente:      '#dc2626',
  seguimiento:  '#64748b',
  info:         '#0ea5e9',
  agendamiento: '#a855f7',
}

/** Colores hex para estados de actividad */
export const COLORES_HEX_ESTADO_ACTIVIDAD: Record<string, string> = {
  pendiente:  '#f5a623',
  completada: '#46a758',
  vencida:    '#e5484d',
  en_curso:   '#3b82f6',
}

/** Color hex por defecto para tipos de actividad */
export const COLOR_TIPO_ACTIVIDAD_DEFECTO = '#5b5bd6'

/** Colores hex para notificaciones server-side (se guardan en BD) */
export const COLOR_NOTIFICACION = {
  info: '#3b82f6',
  exito: '#46a758',
  peligro: '#e5484d',
  advertencia: '#f59e0b',
  marca: '#5b5bd6',
  cyan: '#0ea5e9',
  violeta: '#6e56cf',
} as const

// ─── Paletas hex para selectores de color (pickers) ───

/** Paleta de colores para estados de actividad (config) */
export const PALETA_COLORES_ESTADO: string[] = [
  '#f5a623', '#e5484d', '#46a758', '#3b82f6',
  '#8e4ec6', '#889096', '#0f766e', '#ec4899',
]

/** Paleta de colores para tipos de actividad (config) */
export const PALETA_COLORES_TIPO_ACTIVIDAD: { color: string; nombre: string }[] = [
  { color: '#e5484d', nombre: 'Rojo' },
  { color: '#f5a623', nombre: 'Naranja' },
  { color: '#e5a84c', nombre: 'Ámbar' },
  { color: '#46a758', nombre: 'Verde' },
  { color: '#0f766e', nombre: 'Esmeralda' },
  { color: '#7c93c4', nombre: 'Azul claro' },
  { color: '#3b82f6', nombre: 'Azul' },
  { color: '#8e4ec6', nombre: 'Violeta' },
  { color: '#5b5bd6', nombre: 'Índigo' },
  { color: '#ec4899', nombre: 'Rosa' },
  { color: '#889096', nombre: 'Gris' },
  { color: '#1e3a5f', nombre: 'Navy' },
]

/** Paleta de colores para sectores del organigrama (config) */
export const PALETA_COLORES_SECTOR: string[] = [
  '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#737373', '#1e3a5f', '#9f1239', '#15803d',
]

/** Paleta de colores para etiquetas de inbox (config) */
export const PALETA_COLORES_ETIQUETA: string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#6b7280', '#0ea5e9', '#14b8a6',
]

// ─── Helper genérico ───

/**
 * Obtiene el color para cualquier clave de cualquier mapa.
 * Si no encuentra la clave, devuelve 'neutro' como fallback.
 */
export function obtenerColor(mapa: Record<string, ColorInsignia>, clave: string): ColorInsignia {
  return mapa[clave] ?? 'neutro'
}
