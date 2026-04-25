/**
 * Tipos de pagos de presupuesto. Una cuota puede tener múltiples pagos
 * (parciales) y un pago puede no estar asignado a una cuota ("a cuenta").
 * Estado derivado: pendiente | parcial | cobrada según sum(pagos) vs monto.
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

export interface PresupuestoPago {
  id: string
  empresa_id: string
  presupuesto_id: string
  cuota_id: string | null

  monto: string
  moneda: string
  cotizacion_cambio: string
  monto_en_moneda_presupuesto: string

  fecha_pago: string
  metodo: MetodoPago
  referencia: string | null
  descripcion: string | null

  comprobante_url: string | null
  comprobante_storage_path: string | null
  comprobante_nombre: string | null
  comprobante_tipo: string | null
  comprobante_tamano_bytes: number | null

  mensaje_origen_id: string | null
  chatter_origen_id: string | null

  creado_por: string
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

/** Payload para crear un pago. El comprobante se sube por separado vía FormData. */
export interface CrearPagoPayload {
  cuota_id?: string | null
  monto: number
  moneda?: string
  cotizacion_cambio?: number
  fecha_pago?: string
  metodo: MetodoPago
  referencia?: string | null
  descripcion?: string | null
  /** ID del registro de chatter origen (cuando se registra desde un mensaje) */
  chatter_origen_id?: string | null
  /** ID del mensaje del inbox origen (correo/whatsapp) */
  mensaje_origen_id?: string | null
}

export interface EditarPagoPayload {
  cuota_id?: string | null
  monto?: number
  moneda?: string
  cotizacion_cambio?: number
  fecha_pago?: string
  metodo?: MetodoPago
  referencia?: string | null
  descripcion?: string | null
}
