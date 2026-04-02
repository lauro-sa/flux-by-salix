import type { ReactNode } from 'react'

/* ════════════════════════════════════════════
   Tipos de datos para TablaDinamica
   ════════════════════════════════════════════ */

/** Tipo de dato de la columna — usado para cálculos del resumen */
export type TipoDato = 'texto' | 'numero' | 'fecha' | 'moneda' | 'booleano'

/** Tipo de cálculo para el pie de tabla */
export type TipoCalculo = 'conteo' | 'suma' | 'promedio' | 'min' | 'max' | 'ninguno'

/** Dirección de ordenamiento */
export type DireccionOrden = 'asc' | 'desc'

/** Vistas disponibles */
export type TipoVista = 'lista' | 'tarjetas'

/** Configuración de una columna */
export interface ColumnaDinamica<T> {
  clave: string
  etiqueta: string
  ancho?: number
  anchoMinimo?: number
  render?: (fila: T) => ReactNode
  ordenable?: boolean
  tipo?: TipoDato
  obtenerValor?: (fila: T) => string | number | Date | boolean
  resumen?: TipoCalculo
  alineacion?: 'left' | 'center' | 'right'
  /** Icono para mostrar en el panel de configuración de columnas */
  icono?: ReactNode
  /** Grupo visual para el panel de configuración de columnas (ej: 'Identidad', 'Contacto', 'Fiscal') */
  grupo?: string
  /** Si true, esta columna genera un filtro automático en la barra de la tabla */
  filtrable?: boolean
  /** Tipo de filtro a generar: seleccion (default), multiple, fecha, o pills (botones horizontales) */
  tipoFiltro?: 'seleccion' | 'multiple' | 'fecha' | 'pills'
  /** Opciones del filtro (requerido para seleccion/multiple, ignorado en fecha) */
  opcionesFiltro?: { valor: string; etiqueta: string }[]
}

/** Estado visual de la tabla */
export interface OpcionesVisuales {
  mostrarDivisores: boolean
  filasAlternas: boolean
  bordesColumnas: boolean
}

/** Filtro reutilizable (compatible con BarraBusqueda) */
export interface FiltroTabla {
  id: string
  etiqueta: string
  icono?: ReactNode
  tipo: 'seleccion' | 'multiple' | 'fecha' | 'pills'
  valor: string | string[]
  onChange: (valor: string | string[]) => void
  opciones?: { valor: string; etiqueta: string }[]
}

/** Acción en lote */
export interface AccionLote {
  id: string
  /** Texto fijo o función según los IDs seleccionados (p. ej. Descartar vs Eliminar) */
  etiqueta: string | ((ids: Set<string>) => string)
  icono?: ReactNode
  onClick: (ids: Set<string>) => void
  peligro?: boolean
  /** Atajo de teclado a mostrar (ej: 'E', 'Del', '⌘D') */
  atajo?: string
  /** Grupo visual — acciones del mismo grupo se agrupan juntas con separadores entre grupos */
  grupo?: 'edicion' | 'organizacion' | 'exportar' | 'peligro'
}

/** Props principales del componente TablaDinamica */
export interface PropiedadesTablaDinamica<T> {
  /* Datos */
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  claveFila: (fila: T) => string
  totalRegistros?: number

  /* Vistas */
  vistas?: TipoVista[]
  vistaInicial?: TipoVista

  /* Tarjetas */
  renderTarjeta?: (fila: T) => ReactNode

  /* Paginación */
  registrosPorPagina?: number
  /** Página actual (para paginación server-side) */
  paginaExterna?: number
  /** Callback al cambiar página (para paginación server-side) */
  onCambiarPagina?: (pagina: number) => void

  /* Selección */
  seleccionables?: boolean

  /* Búsqueda */
  busqueda?: string
  onBusqueda?: (texto: string) => void
  placeholder?: string

  /* Filtros */
  filtros?: FiltroTabla[]
  onLimpiarFiltros?: () => void

  /* Acciones en lote (el botón de acción principal va en el cabecero de la página, fuera de la tabla) */
  accionesLote?: AccionLote[]

  /* Eventos */
  onClickFila?: (fila: T) => void

  /* Resumen / calculador */
  mostrarResumen?: boolean

  /* Estado vacío personalizado — se muestra cuando no hay datos */
  estadoVacio?: ReactNode

  /** ID del módulo para persistir config por usuario+dispositivo (ej: 'usuarios', 'contactos') */
  idModulo?: string

  /** Columnas visibles por defecto (claves). Si no se pasa, todas las columnas son visibles. */
  columnasVisiblesDefault?: string[]

  /** Chip de filtro activo — se muestra dentro de la barra de búsqueda */
  chipFiltro?: ReactNode

  /** Opciones de ordenamiento para el panel de filtros (etiqueta + clave + dirección) */
  opcionesOrden?: { etiqueta: string; clave: string; direccion: DireccionOrden }[]

  className?: string
}

/* ════════════════════════════════════════════
   Constantes
   ════════════════════════════════════════════ */

export const ANCHO_MINIMO_COLUMNA = 50
export const ANCHO_DEFAULT_COLUMNA = 150
export const REGISTROS_POR_PAGINA_DEFAULT = 50

/* ════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════ */

/** Obtiene el valor de una celda para ordenamiento/cálculo */
export function obtenerValorCelda<T>(fila: T, columna: ColumnaDinamica<T>): string | number | Date | boolean {
  if (columna.obtenerValor) return columna.obtenerValor(fila)
  const valor = (fila as Record<string, unknown>)[columna.clave]
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (valor instanceof Date) return valor
  return String(valor)
}

/** Compara dos valores para ordenamiento */
export function compararValores(a: unknown, b: unknown, direccion: DireccionOrden): number {
  const mul = direccion === 'asc' ? 1 : -1
  if (a === b) return 0
  if (a === '' || a === null || a === undefined) return 1
  if (b === '' || b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul
  if (a instanceof Date && b instanceof Date) return (a.getTime() - b.getTime()) * mul
  return String(a).localeCompare(String(b), 'es') * mul
}

/** Formatea un número para mostrar */
export function formatearNumero(n: number, tipoDato?: TipoDato): string {
  if (tipoDato === 'moneda') {
    return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

/** Calcula un resumen sobre un arreglo de valores numéricos */
export function calcularResumen(valores: number[], tipo: TipoCalculo, tipoDato?: TipoDato): string {
  if (valores.length === 0) return '—'
  switch (tipo) {
    case 'conteo': return formatearNumero(valores.length)
    case 'suma': return formatearNumero(valores.reduce((a, b) => a + b, 0), tipoDato)
    case 'promedio': return formatearNumero(valores.reduce((a, b) => a + b, 0) / valores.length, tipoDato)
    case 'min': return formatearNumero(Math.min(...valores), tipoDato)
    case 'max': return formatearNumero(Math.max(...valores), tipoDato)
    default: return '—'
  }
}
