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

// ─── Helper genérico ───

/**
 * Obtiene el color para cualquier clave de cualquier mapa.
 * Si no encuentra la clave, devuelve 'neutro' como fallback.
 */
export function obtenerColor(mapa: Record<string, ColorInsignia>, clave: string): ColorInsignia {
  return mapa[clave] ?? 'neutro'
}
