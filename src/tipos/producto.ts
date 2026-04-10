/**
 * Tipos del sistema de productos y servicios de Flux.
 * Se usa en: listado, modal de edición, líneas de presupuesto, configuración.
 */

// ─── Tipo de producto ───

export type TipoProducto = 'producto' | 'servicio'

export const ETIQUETAS_TIPO_PRODUCTO: Record<TipoProducto, string> = {
  producto: 'Producto',
  servicio: 'Servicio',
}

// ─── Unidades de medida por defecto ───

export const UNIDADES_MEDIDA_DEFAULT = [
  { id: 'unidad', label: 'Unidad', abreviatura: 'un' },
  { id: 'hora', label: 'Hora', abreviatura: 'hs' },
  { id: 'servicio', label: 'Servicio', abreviatura: 'srv' },
  { id: 'metro', label: 'Metro', abreviatura: 'm' },
  { id: 'kg', label: 'Kilogramo', abreviatura: 'kg' },
  { id: 'litro', label: 'Litro', abreviatura: 'lt' },
  { id: 'dia', label: 'Día', abreviatura: 'día' },
  { id: 'mes', label: 'Mes', abreviatura: 'mes' },
  { id: 'global', label: 'Global', abreviatura: 'gl' },
  { id: 'm2', label: 'Metro cuadrado', abreviatura: 'm²' },
] as const

// ─── Categorías de costo por defecto (más completas que en v1) ───

export const CATEGORIAS_COSTO_DEFAULT = [
  { id: 'mano_obra', label: 'Mano de obra' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'horas_hombre', label: 'Horas hombre' },
  { id: 'movilidad', label: 'Movilidad' },
  { id: 'flete', label: 'Flete' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'repuestos', label: 'Repuestos' },
  { id: 'traslado', label: 'Traslado' },
] as const

// ─── Item de desglose de costos ───

export interface DesgloseCosto {
  id: string
  categoria_id: string
  descripcion: string
  monto: number
}

// ─── Categoría de costo (configurable por empresa) ───

export interface CategoriaCosto {
  id: string
  label: string
}

// ─── Categoría de producto (configurable por empresa) ───

export interface CategoriaProducto {
  id: string
  label: string
}

// ─── Prefijo de código (configurable por empresa) ───

export interface PrefijoProducto {
  id: string
  prefijo: string
  label: string
  siguiente: number
}

// ─── Producto completo ───

export interface Producto {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  tipo: TipoProducto

  // Categorización
  categoria: string | null
  favorito: boolean
  referencia_interna: string | null
  codigo_barras: string | null
  imagen_url: string | null

  // Precios e impuestos
  precio_unitario: string | null
  moneda: string | null
  costo: string | null
  desglose_costos: DesgloseCosto[]
  impuesto_id: string | null
  impuesto_compra_id: string | null
  unidad: string

  // Descripciones
  descripcion: string | null
  descripcion_venta: string | null
  notas_internas: string | null

  // Logística (solo productos)
  peso: string | null
  volumen: string | null
  ubicacion_deposito: string | null
  dimensiones: string | null
  proveedor_principal: string | null
  stock_actual: number
  stock_minimo: number
  stock_maximo: number
  punto_reorden: number
  alerta_stock_bajo: boolean

  // Capacidades
  puede_venderse: boolean
  puede_comprarse: boolean
  activo: boolean

  // Soft delete
  en_papelera: boolean
  papelera_en: string | null

  // Auditoría
  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

// ─── Payloads ───

export interface CrearProductoPayload {
  nombre: string
  tipo?: TipoProducto
  categoria?: string
  referencia_interna?: string
  codigo_barras?: string
  imagen_url?: string
  precio_unitario?: string
  moneda?: string
  costo?: string
  desglose_costos?: DesgloseCosto[]
  impuesto_id?: string
  impuesto_compra_id?: string
  unidad?: string
  descripcion?: string
  descripcion_venta?: string
  notas_internas?: string
  peso?: string
  volumen?: string
  ubicacion_deposito?: string
  dimensiones?: string
  proveedor_principal?: string
  stock_actual?: number
  stock_minimo?: number
  stock_maximo?: number
  punto_reorden?: number
  alerta_stock_bajo?: boolean
  puede_venderse?: boolean
  puede_comprarse?: boolean
}

export interface EditarProductoPayload extends Partial<CrearProductoPayload> {
  favorito?: boolean
  activo?: boolean
  en_papelera?: boolean
}

// ─── Configuración del catálogo por empresa ───

export interface ConfigProductos {
  empresa_id: string
  categorias: CategoriaProducto[]
  unidades: { id: string; label: string; abreviatura: string }[]
  prefijos: PrefijoProducto[]
  categorias_costo: CategoriaCosto[]
}

// ─── Filtros para listado ───

export interface FiltrosProducto {
  busqueda?: string
  tipo?: TipoProducto
  categoria?: string
  activo?: boolean
  puede_venderse?: boolean
  puede_comprarse?: boolean
  en_papelera?: boolean
}
