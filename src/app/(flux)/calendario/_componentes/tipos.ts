/**
 * Tipos compartidos del módulo Calendario.
 * Se usan en: page.tsx, VistaCalendarioMes, ModalEvento, BarraHerramientas.
 */

export interface EventoCalendario {
  id: string
  titulo: string
  descripcion: string | null
  ubicacion: string | null
  tipo_id: string | null
  tipo_clave: string | null
  color: string | null
  fecha_inicio: string
  fecha_fin: string
  todo_el_dia: boolean
  recurrencia: unknown
  visibilidad: string
  asignados: { id: string; nombre: string }[]
  asignado_ids: string[]
  vinculos: { tipo: string; id: string; nombre: string }[]
  vinculo_ids: string[]
  actividad_id: string | null
  estado: string
  notas: string | null
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  /** Marcador interno para indicar que el usuario está ocupado */
  _es_ocupado?: boolean
  /** Marcador interno para feriados inyectados desde la tabla feriados */
  _es_feriado?: boolean
}

export interface TipoEventoCalendario {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  duracion_default: number
  todo_el_dia_default: boolean
  activo: boolean
}

/** Vistas disponibles del calendario (orden lógico: menor a mayor rango) */
export type VistaCalendario = 'dia' | 'semana' | 'quincenal' | 'mes' | 'anio' | 'agenda' | 'equipo'

/** Callback al hacer clic en un evento — incluye posición del clic para el popover */
export type OnClickEvento = (evento: EventoCalendario, posicion?: { x: number; y: number }) => void

/** Callback al crear evento desde selección de rango horario (arrastrar para seleccionar) */
export type OnCrearDesdeSeleccion = (fechaInicio: Date, fechaFin?: Date) => void
