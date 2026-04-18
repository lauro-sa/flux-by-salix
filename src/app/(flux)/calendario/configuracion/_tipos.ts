/**
 * Tipos compartidos de la configuración del calendario.
 */

export interface TipoEventoCalendario {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  duracion_default: number
  todo_el_dia_default: boolean
  orden: number
  activo: boolean
  es_predefinido: boolean
}
