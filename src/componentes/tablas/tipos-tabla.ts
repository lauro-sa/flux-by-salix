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
export type TipoVista = 'lista' | 'tarjetas' | 'matriz'

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
  /**
   * Si true, la columna siempre está visible aunque la configuración guardada
   * del usuario no la incluya. Usar para columnas críticas (ej: Nombre) que
   * no tiene sentido ocultar — protege contra preferencias corruptas o
   * migradas desde otro dispositivo con un set de columnas distinto.
   */
  obligatoria?: boolean
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
  /**
   * - 'pills': botones horizontales (mejor para 2-5 opciones cortas).
   * - 'seleccion': lista vertical, una sola opción.
   * - 'seleccion-compacto': botón compacto con popover (single-select, ideal cuando hay muchas opciones pero solo una se elige).
   * - 'multiple': lista vertical con checkboxes (mejor para <10 opciones).
   * - 'multiple-compacto': botón compacto con popover (mejor para 10+ opciones o etiquetas largas).
   * - 'fecha': selector de fecha.
   */
  tipo: 'seleccion' | 'seleccion-compacto' | 'multiple' | 'multiple-compacto' | 'fecha' | 'pills'
  valor: string | string[]
  onChange: (valor: string | string[]) => void
  opciones?: { valor: string; etiqueta: string }[]
  /** Valor por defecto: cuando el valor actual coincide, no se muestra badge de filtro activo */
  valorDefault?: string | string[]
  /** Descripción contextual mostrada en el PanelFiltrosAvanzado (panel central al seleccionar el filtro) */
  descripcion?: string
}

/**
 * Grupo de filtros — para organizar filtros en secciones temáticas dentro del panel expandido.
 * Cada grupo renderiza un subtítulo y agrupa sus filtros en flex-wrap.
 * Uso: pasar a TablaDinamica.gruposFiltros cuando hay muchos filtros y se necesita jerarquía visual.
 */
export interface GrupoFiltros {
  id: string
  etiqueta: string
  icono?: ReactNode
  /** IDs de filtros (FiltroTabla.id) a incluir en este grupo */
  filtros: string[]
}

/** Acción en lote */
export interface AccionLote {
  id: string
  /** Texto fijo o función según los IDs seleccionados (p. ej. Descartar vs Eliminar) */
  etiqueta: string | ((ids: Set<string>) => string)
  icono?: ReactNode
  onClick: (ids: Set<string>) => void
  peligro?: boolean
  /** No limpiar selección al ejecutar (útil para submenús como posponer) */
  noLimpiarSeleccion?: boolean
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
  /**
   * Agrupación visual de filtros en el panel expandido.
   * Si se pasa, reemplaza el layout "primeros 3 + resto" por secciones con subtítulo.
   * Los filtros que no aparecen en ningún grupo se muestran en un grupo final "Otros".
   */
  gruposFiltros?: GrupoFiltros[]

  /* Acciones en lote (el botón de acción principal va en el cabecero de la página, fuera de la tabla) */
  accionesLote?: AccionLote[]

  /* Eventos */
  onClickFila?: (fila: T) => void
  /** Callback cuando se selecciona una vista que no se maneja internamente (ej: 'matriz') */
  onVistaExterna?: (vista: TipoVista) => void
  /** Vista externa activa — se usa para resaltar el botón cuando la vista la maneja el padre */
  vistaExternaActiva?: TipoVista | null
  /** Oculta el switcher de vistas de la barra de herramientas — úsalo cuando los iconos se muevan a otro lugar (ej. hero de la vista matriz) */
  ocultarSwitcherVistas?: boolean
  /** Oculta la barra de herramientas completa (buscador, paginador, switcher, columnas) — útil en vistas custom que tienen su propia navegación (ej. matriz) */
  ocultarBarraHerramientas?: boolean
  /** Contenido custom que reemplaza la tabla (ej: vista matriz) */
  contenidoCustom?: ReactNode

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

  /** Elemento extra a la derecha de la barra de herramientas (ej: botón de config) */
  accionDerecha?: ReactNode

  /**
   * Agrupador de filas — función que recibe una fila y devuelve la clave del grupo al que pertenece.
   * Aplica tanto a vista tabla (header de grupo en una fila colSpan) como a vista tarjetas (sección).
   * Si se omite, no hay agrupación.
   */
  agrupador?: (fila: T) => string
  /** Etiqueta legible del grupo a partir de su clave (default: la clave directa). */
  etiquetaGrupo?: (clave: string) => string
  /**
   * Orden explícito de los grupos por clave. Las claves no listadas van al final
   * (ordenadas alfabéticamente entre sí). Si se omite, todo orden es alfabético.
   */
  ordenGrupos?: string[]
  /**
   * Clases Tailwind para el grid de la vista tarjetas. Permite que cada módulo
   * elija cuántas columnas usar por breakpoint según la densidad de su tarjeta.
   * Default: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
   * (Contactos usa 1 col en mobile porque la tarjeta lleva footer de acciones).
   */
  gridTarjetas?: string

  /**
   * Filas reordenables por drag-and-drop. Cuando está activo, se agrega una columna de handle
   * al inicio y el usuario puede arrastrar filas para reordenar. Solo aplica en la vista lista.
   * Incompatible con ordenamiento por columnas (se desactiva automáticamente).
   */
  filasReordenables?: boolean
  /** Callback al reordenar filas — recibe los IDs en el nuevo orden */
  onReordenarFilas?: (idsOrdenados: string[]) => void

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
export function formatearNumero(n: number, tipoDato?: TipoDato, locale = 'es-AR'): string {
  if (tipoDato === 'moneda') {
    return `$ ${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

/** Calcula un resumen sobre un arreglo de valores numéricos */
export function calcularResumen(valores: number[], tipo: TipoCalculo, tipoDato?: TipoDato, locale = 'es-AR'): string {
  if (valores.length === 0) return '—'
  switch (tipo) {
    case 'conteo': return formatearNumero(valores.length, undefined, locale)
    case 'suma': return formatearNumero(valores.reduce((a, b) => a + b, 0), tipoDato, locale)
    case 'promedio': return formatearNumero(valores.reduce((a, b) => a + b, 0) / valores.length, tipoDato, locale)
    case 'min': return formatearNumero(Math.min(...valores), tipoDato, locale)
    case 'max': return formatearNumero(Math.max(...valores), tipoDato, locale)
    default: return '—'
  }
}
