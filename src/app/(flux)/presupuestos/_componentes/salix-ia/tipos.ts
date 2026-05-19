/**
 * Tipos compartidos del panel Salix IA.
 *
 * Centralizamos acá las interfaces que cruzan varios sub-componentes
 * (estados del panel, modos del asistente, línea propuesta, sugerencia
 * del catálogo, etc.) para evitar duplicación y mantener una única
 * fuente de verdad sobre la forma de los datos.
 */

/** Estados del panel completo. El header los refleja con el PuntoEstado. */
export type EstadoPanel = 'vacio' | 'analizando' | 'resultados' | 'error'

/** Modos del asistente — define el prompt y el shape de la respuesta. */
export type ModoAsistente = 'redactar' | 'crear' | 'desglosar'

/** Compat con el backend actual que usa los nombres legacy. */
export const modoABackend: Record<ModoAsistente, 'simple' | 'paquete' | 'detallado'> = {
  redactar: 'simple',
  crear: 'paquete',
  desglosar: 'detallado',
}
export const backendAModo: Record<'simple' | 'paquete' | 'detallado', ModoAsistente> = {
  simple: 'redactar',
  paquete: 'crear',
  detallado: 'desglosar',
}

/** Una línea propuesta por la IA, lista para mostrar en TarjetaPropuestaSalix. */
export interface LineaPropuestaIA {
  /** ID del producto en el catálogo. null si la línea es nueva (a crear). */
  producto_id: string | null
  codigo: string
  referencia_interna: string | null
  nombre: string
  descripcion_venta: string
  unidad: string
  impuesto_id: string | null
  /** true si el servicio no existe todavía en el catálogo. */
  es_nuevo: boolean
  categoria_sugerida: string | null
  /** Estado de la propuesta en la UI (no viene del backend). */
  estado?: 'pendiente' | 'aceptada' | 'rechazada'
  /** Si el usuario editó la descripción de la línea. */
  descripcion_editada?: string
  /** Si el usuario quiere crear el servicio en el catálogo al confirmar. */
  crear_servicio?: boolean
}

/** Una sugerencia del catálogo para reemplazar una línea nueva. */
export interface SugerenciaIA {
  producto_id: string | null
  codigo: string
  referencia_interna: string | null
  nombre: string
  descripcion_venta: string
  unidad: string
  impuesto_id: string | null
  /** Por qué el matcher cree que podría coincidir. */
  razon: string
  /** Índice (0-based) de la línea propuesta a la que aplica. */
  para_linea: number
}

/** Pasos de la checklist durante el análisis. */
export type PasoChecklist = 'identificar' | 'matchear' | 'similares'

export interface EstadoPaso {
  paso: PasoChecklist
  etiqueta: string
  estado: 'pendiente' | 'activo' | 'hecho'
}
