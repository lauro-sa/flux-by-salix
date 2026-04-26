/**
 * Tipos de pagos de presupuesto. Una cuota puede tener múltiples pagos
 * (parciales) y un pago puede no estar asignado a una cuota ("a cuenta").
 * Estado derivado: pendiente | parcial | cobrada según sum(pagos) vs monto.
 *
 * Un pago también puede ser un "adicional" (es_adicional=true): trabajo
 * cobrado fuera del presupuesto original. No imputa a cuota y no descuenta
 * saldo del presupuesto, solo se contabiliza como ingreso aparte.
 *
 * Un pago puede tener múltiples comprobantes (presupuesto_pago_comprobantes):
 * típicamente uno del pago en sí (transferencia) y uno o más de las
 * percepciones/retenciones cuando el cliente las cobró por separado.
 */

export type MetodoPago =
  | 'efectivo'
  | 'transferencia'
  | 'cheque'
  | 'tarjeta'
  | 'deposito'
  | 'otro'

export const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  deposito: 'Depósito',
  otro: 'Otro',
}

export const METODOS_PAGO_OPCIONES: Array<{ valor: MetodoPago; etiqueta: string }> =
  (Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_METODO_PAGO[valor],
  }))

export type TipoComprobantePago = 'comprobante' | 'percepcion'

export interface PresupuestoPagoComprobante {
  id: string
  empresa_id: string
  pago_id: string
  tipo: TipoComprobantePago
  url: string
  storage_path: string
  nombre: string
  mime_tipo: string | null
  tamano_bytes: number | null
  creado_en: string
}

export interface PresupuestoPago {
  id: string
  empresa_id: string
  presupuesto_id: string
  cuota_id: string | null

  monto: string
  /** Percepciones/retenciones cobradas dentro del mismo pago. */
  monto_percepciones: string
  moneda: string
  cotizacion_cambio: string
  /** (monto + monto_percepciones) * cotizacion_cambio. */
  monto_en_moneda_presupuesto: string

  fecha_pago: string
  metodo: MetodoPago
  referencia: string | null
  descripcion: string | null

  /** true = entrada de dinero por fuera del presupuesto (trabajo extra). */
  es_adicional: boolean
  /** Concepto corto del adicional (sólo aplica si es_adicional=true). */
  concepto_adicional: string | null

  // Campos legacy del comprobante (un solo archivo). Reemplazados por
  // la tabla presupuesto_pago_comprobantes; quedan acá por compat.
  comprobante_url: string | null
  comprobante_storage_path: string | null
  comprobante_nombre: string | null
  comprobante_tipo: string | null
  comprobante_tamano_bytes: number | null

  /** Lista completa de comprobantes adjuntos al pago. Cuando el endpoint
   *  GET hidrata el pago, se popula con todos los archivos de la tabla
   *  presupuesto_pago_comprobantes. */
  comprobantes?: PresupuestoPagoComprobante[]

  mensaje_origen_id: string | null
  chatter_origen_id: string | null

  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

/** Payload para crear un pago. Los comprobantes se suben por separado vía FormData. */
export interface CrearPagoPayload {
  cuota_id?: string | null
  monto: number
  monto_percepciones?: number
  moneda?: string
  cotizacion_cambio?: number
  fecha_pago?: string
  metodo: MetodoPago
  referencia?: string | null
  descripcion?: string | null
  es_adicional?: boolean
  concepto_adicional?: string | null
  /** ID del registro de chatter origen (cuando se registra desde un mensaje) */
  chatter_origen_id?: string | null
  /** ID del mensaje del inbox origen (correo/whatsapp) */
  mensaje_origen_id?: string | null
}

export interface EditarPagoPayload {
  cuota_id?: string | null
  monto?: number
  monto_percepciones?: number
  moneda?: string
  cotizacion_cambio?: number
  fecha_pago?: string
  metodo?: MetodoPago
  referencia?: string | null
  descripcion?: string | null
  es_adicional?: boolean
  concepto_adicional?: string | null
}
