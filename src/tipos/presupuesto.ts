/**
 * Tipos del sistema de presupuestos de Flux.
 * Se usa en: listado, detalle, edición, líneas, configuración.
 */

// ─── Estados del presupuesto ───

export type EstadoPresupuesto =
  | 'borrador'
  | 'enviado'
  | 'confirmado_cliente'
  | 'orden_venta'
  | 'rechazado'
  | 'vencido'
  | 'cancelado'

export const ETIQUETAS_ESTADO: Record<EstadoPresupuesto, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  confirmado_cliente: 'Confirmado por Cliente',
  orden_venta: 'Orden de Venta',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

// Etiquetas cortas para la barra de estados compacta
export const ETIQUETAS_ESTADO_CORTA: Record<EstadoPresupuesto, string> = {
  borrador: 'Borr',
  enviado: 'Env',
  confirmado_cliente: 'Conf',
  orden_venta: 'OV',
  rechazado: 'Rech',
  vencido: 'Venc',
  cancelado: 'Canc',
}

// Flujo progresivo (happy path)
export const FLUJO_ESTADO: EstadoPresupuesto[] = [
  'borrador', 'enviado', 'confirmado_cliente', 'orden_venta',
]

// Estados terminales (no forman parte del flujo, se muestran como badge)
export const ESTADOS_TERMINALES: EstadoPresupuesto[] = ['cancelado', 'rechazado', 'vencido']

// Transiciones válidas desde cada estado
export const TRANSICIONES_ESTADO: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: ['enviado', 'cancelado'],
  enviado: ['confirmado_cliente', 'orden_venta', 'rechazado', 'cancelado'],
  confirmado_cliente: ['orden_venta', 'borrador', 'cancelado'],
  orden_venta: ['borrador', 'cancelado'],
  rechazado: ['borrador', 'cancelado'],
  vencido: ['borrador', 'cancelado'],
  cancelado: ['borrador'],
}

// ─── Tipos de línea ───

export type TipoLinea = 'producto' | 'seccion' | 'nota' | 'descuento'

export const ETIQUETAS_TIPO_LINEA: Record<TipoLinea, string> = {
  producto: 'Producto / Servicio',
  seccion: 'Sección',
  nota: 'Nota',
  descuento: 'Descuento',
}

// ─── Presupuesto principal ───

export interface Presupuesto {
  id: string
  empresa_id: string
  numero: string
  estado: EstadoPresupuesto

  // Contacto vinculado (snapshot)
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_tipo: string | null
  contacto_identificacion: string | null
  contacto_condicion_iva: string | null
  contacto_direccion: string | null
  contacto_correo: string | null
  contacto_telefono: string | null

  // Dirigido a
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_correo: string | null
  atencion_cargo: string | null

  // Referencia
  referencia: string | null

  // Moneda y pago
  moneda: string
  cotizacion_cambio: string
  condicion_pago_id: string | null
  condicion_pago_label: string | null
  condicion_pago_tipo: string | null

  // Fechas
  fecha_emision: string
  dias_vencimiento: number
  fecha_vencimiento: string | null

  // Totales
  subtotal_neto: string
  total_impuestos: string
  descuento_global: string
  descuento_global_monto: string
  total_final: string

  // Columnas visibles
  columnas_lineas: string[]

  // Notas y condiciones
  notas_html: string | null
  condiciones_html: string | null
  nota_plan_pago: string | null

  // PDF
  pdf_url: string | null
  pdf_miniatura_url: string | null
  pdf_storage_path: string | null
  pdf_generado_en: string | null
  // PDF firmado (certificado de aceptación)
  pdf_firmado_url: string | null
  pdf_firmado_storage_path: string | null

  // Vinculación
  origen_documento_id: string | null
  origen_documento_numero: string | null

  // Auditoría
  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string

  // Estado
  activo: boolean
  en_papelera: boolean
}

// ─── Presupuesto con relaciones ───

export interface PresupuestoConLineas extends Presupuesto {
  lineas: LineaPresupuesto[]
  cuotas: CuotaPago[]
  historial: HistorialEstado[]
}

// ─── Línea de presupuesto ───

export interface LineaPresupuesto {
  id: string
  presupuesto_id: string
  tipo_linea: TipoLinea
  orden: number

  // Producto/servicio
  codigo_producto: string | null
  descripcion: string | null
  descripcion_detalle: string | null
  cantidad: string
  unidad: string | null
  precio_unitario: string
  descuento: string
  impuesto_label: string | null
  impuesto_porcentaje: string

  // Calculados
  subtotal: string
  impuesto_monto: string
  total: string

  // Descuento fijo
  monto: string | null
}

// ─── Historial de estados ───

export interface HistorialEstado {
  id: string
  presupuesto_id: string
  estado: EstadoPresupuesto
  usuario_id: string
  usuario_nombre: string | null
  fecha: string
  notas: string | null
}

// ─── Cuotas de pago ───

export interface CuotaPago {
  id: string
  presupuesto_id: string
  numero: number
  descripcion: string | null
  porcentaje: string
  monto: string
  dias_desde_emision: number
  estado: 'pendiente' | 'cobrada'
  fecha_cobro: string | null
  cobrado_por_nombre: string | null
}

// ─── Payloads de creación/edición ───

export interface CrearPresupuestoPayload {
  contacto_id?: string
  referencia?: string
  moneda?: string
  condicion_pago_id?: string
  dias_vencimiento?: number
  notas_html?: string
  condiciones_html?: string
  columnas_lineas?: string[]
  lineas?: CrearLineaPayload[]
}

export interface EditarPresupuestoPayload {
  contacto_id?: string
  referencia?: string
  moneda?: string
  cotizacion_cambio?: string
  condicion_pago_id?: string
  condicion_pago_label?: string
  condicion_pago_tipo?: string
  fecha_emision?: string
  dias_vencimiento?: number
  fecha_vencimiento?: string
  notas_html?: string
  condiciones_html?: string
  nota_plan_pago?: string
  columnas_lineas?: string[]
  descuento_global?: string
  estado?: EstadoPresupuesto
  atencion_contacto_id?: string
  atencion_nombre?: string
  atencion_correo?: string
  atencion_cargo?: string
  // Snapshot contacto (para actualizar)
  contacto_nombre?: string
  contacto_apellido?: string
  contacto_tipo?: string
  contacto_identificacion?: string
  contacto_condicion_iva?: string
  contacto_direccion?: string
  contacto_correo?: string
  contacto_telefono?: string
}

export interface CrearLineaPayload {
  tipo_linea: TipoLinea
  orden?: number
  codigo_producto?: string
  descripcion?: string
  descripcion_detalle?: string
  cantidad?: string
  unidad?: string
  precio_unitario?: string
  descuento?: string
  impuesto_label?: string
  impuesto_porcentaje?: string
  monto?: string // solo para tipo descuento
}

// ─── Configuración de presupuestos ───

export interface Impuesto {
  id: string
  label: string
  porcentaje: number
  activo: boolean
  predeterminado?: boolean
}

export interface Moneda {
  id: string
  label: string
  simbolo: string
  activo: boolean
}

export interface UnidadMedida {
  id: string
  label: string
  abreviatura: string
}

export interface CondicionPago {
  id: string
  label: string
  tipo: 'plazo_fijo' | 'hitos'
  diasVencimiento: number
  hitos: HitoPago[]
  notaPlanPago: string
  predeterminado: boolean
}

export interface HitoPago {
  id: string
  porcentaje: number
  descripcion: string
  diasDesdeEmision: number
}

export interface PlantillaPresupuesto {
  [k: string]: unknown
  id: string
  nombre: string
  creado_por: string
  moneda?: string
  condicion_pago_id?: string
  condicion_pago_label?: string
  condicion_pago_tipo?: string
  dias_vencimiento?: number
  lineas?: unknown[]
  notas_html?: string
  condiciones_html?: string
}

export interface ConfigPresupuestos {
  empresa_id: string
  impuestos: Impuesto[]
  monedas: Moneda[]
  moneda_predeterminada: string
  condiciones_pago: CondicionPago[]
  dias_vencimiento_predeterminado: number
  condiciones_predeterminadas: string | null
  notas_predeterminadas: string | null
  unidades: UnidadMedida[]
  columnas_lineas_default: string[]
  plantillas: PlantillaPresupuesto[]
  plantillas_predeterminadas: Record<string, string>
  // Configuración PDF
  membrete: ConfigMembrete | null
  pie_pagina: ConfigPiePagina | null
  plantilla_html: string | null
  patron_nombre_pdf: string | null
  datos_empresa_pdf: ConfigDatosEmpresaPdf | null
}

// ─── Configuración de membrete (encabezado del PDF) ───

export interface ConfigMembrete {
  mostrar_logo: boolean
  tipo_logo: 'cuadrado' | 'apaisado'
  posicion_logo: 'izquierda' | 'centro' | 'derecha'
  ancho_logo: number
  texto_logo: string
  tamano_texto_logo: number
  subtitulo_logo: string
  tamano_subtitulo: number
  contenido_html: string
  alineacion_texto: 'izquierda' | 'centro' | 'derecha'
  tamano_texto: number
  linea_separadora: boolean
  grosor_linea: number
  color_linea: 'gris' | 'marca'
}

// ─── Configuración de pie de página del PDF ───

export type TipoColumnaPie = 'vacio' | 'texto' | 'numeracion' | 'imagen'

export interface ColumnaPie {
  tipo: TipoColumnaPie
  texto?: string
  tamano_texto?: number
  imagen_url?: string
  texto_imagen?: string
  posicion_texto?: 'arriba' | 'abajo'
  alineacion_texto?: 'izquierda' | 'centro' | 'derecha'
}

export interface ConfigPiePagina {
  linea_superior: boolean
  grosor_linea: number
  color_linea: 'gris' | 'marca'
  tamano_texto: number
  columnas: {
    izquierda: ColumnaPie
    centro: ColumnaPie
    derecha: ColumnaPie
  }
}

// ─── Datos de empresa visibles en el PDF ───

export interface DatosBancarios {
  banco: string
  titular: string
  numero_cuenta: string
  cbu: string
  alias: string
}

export interface ConfigDatosEmpresaPdf {
  mostrar_razon_social: boolean
  mostrar_identificacion: boolean
  mostrar_condicion_fiscal: boolean
  mostrar_direccion: boolean
  mostrar_telefono: boolean
  mostrar_correo: boolean
  mostrar_pagina_web: boolean
  mostrar_datos_bancarios: boolean
  datos_bancarios: DatosBancarios
  usar_datos_empresa?: boolean // true = hereda datos bancarios de config empresa
}

// ─── Variables disponibles para la plantilla PDF ───

export const VARIABLES_PLANTILLA_PDF = [
  // Documento
  '{numero}', '{tipo_documento}', '{fecha_emision}', '{fecha_vencimiento}',
  '{moneda_simbolo}', '{moneda_codigo}', '{referencia}', '{estado}',
  '{condicion_pago}', '{nota_plan_pago}',
  // Contacto
  '{contacto_nombre}', '{contacto_identificacion}', '{contacto_condicion_fiscal}',
  '{contacto_direccion}', '{contacto_correo}', '{contacto_telefono}',
  // Dirigido a
  '{atencion_nombre}', '{atencion_cargo}', '{atencion_correo}',
  // Totales
  '{subtotal_neto}', '{total_impuestos}', '{descuento_global_porcentaje}',
  '{descuento_global_monto}', '{total_final}',
  // Empresa
  '{empresa_nombre}', '{empresa_identificacion}', '{empresa_condicion_fiscal}',
  '{empresa_direccion}', '{empresa_telefono}', '{empresa_correo}',
  '{empresa_pagina_web}', '{empresa_logo_url}',
  // Bancarios
  '{banco}', '{banco_titular}', '{banco_cbu}', '{banco_alias}',
] as const

// Variables para el patrón de nombre del archivo PDF
export const VARIABLES_NOMBRE_PDF = [
  { variable: '{numero}', descripcion: 'Número del documento' },
  { variable: '{contacto_nombre}', descripcion: 'Nombre del contacto' },
  { variable: '{fecha}', descripcion: 'Fecha de emisión (dd-mm-yyyy)' },
  { variable: '{tipo}', descripcion: 'Tipo de documento (Presupuesto)' },
  { variable: '{referencia}', descripcion: 'Referencia interna' },
] as const

// ─── Columnas configurables de la tabla de líneas ───

export interface ColumnaLinea {
  id: string
  label: string
  visible: boolean
  requerida: boolean // no se puede ocultar (ej: descripcion)
}

export const COLUMNAS_LINEA_DISPONIBLES: ColumnaLinea[] = [
  { id: 'producto', label: 'Código', visible: true, requerida: false },
  { id: 'descripcion', label: 'Descripción', visible: true, requerida: true },
  { id: 'cantidad', label: 'Cant.', visible: true, requerida: false },
  { id: 'unidad', label: 'U. Medida', visible: true, requerida: false },
  { id: 'precio_unitario', label: 'Precio unit.', visible: true, requerida: false },
  { id: 'descuento', label: '% Bonif.', visible: true, requerida: false },
  { id: 'impuesto', label: 'Impuestos', visible: true, requerida: false },
  { id: 'subtotal', label: 'Importe', visible: true, requerida: true },
]

// ─── Filtros para listado ───

export interface FiltrosPresupuesto {
  busqueda?: string
  estado?: EstadoPresupuesto | EstadoPresupuesto[]
  contacto_id?: string
  moneda?: string
  fecha_desde?: string
  fecha_hasta?: string
  en_papelera?: boolean
}
