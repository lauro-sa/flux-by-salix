/**
 * Tipos para el portal público de presupuestos.
 * Se usa en: API portal, página portal, componentes portal.
 */

import type { LineaPresupuesto, CuotaPago } from './presupuesto'

// ─── Estado del cliente en el portal ───────────────────────────────────────
export type EstadoPortal = 'pendiente' | 'visto' | 'aceptado' | 'rechazado' | 'cancelado'

// ─── Token de acceso ────────────────────────────────────────────────────────

export interface TokenPortal {
  id: string
  token: string
  presupuesto_id: string
  empresa_id: string
  creado_por: string
  creado_en: string
  expira_en: string
  visto_en: string | null
  veces_visto: number
  activo: boolean
  // Campos de acción del cliente
  estado_cliente: EstadoPortal
  firma_url: string | null
  firma_nombre: string | null
  firma_modo: string | null
  firma_metadata: Record<string, unknown> | null
  aceptado_en: string | null
  rechazado_en: string | null
  motivo_rechazo: string | null
  mensajes: MensajePortal[]
  comprobantes: ComprobantePortal[]
}

// ─── Mensaje del chat del portal ────────────────────────────────────────────

export interface MensajePortal {
  id: string
  autor: 'cliente' | 'vendedor'
  autor_nombre: string
  contenido: string
  creado_en: string
}

// ─── Comprobante de pago ────────────────────────────────────────────────────

export interface ComprobantePortal {
  id: string
  url: string
  nombre_archivo: string
  tipo: string // 'image/jpeg', 'application/pdf', etc.
  cuota_id: string | null // null = pago total
  monto: string | null
  creado_en: string
  estado: 'pendiente' | 'confirmado' | 'rechazado'
}

// ─── Datos que recibe la página pública del portal ──────────────────────────

export interface DatosPortal {
  token_id: string
  presupuesto: {
    id: string
    numero: string
    estado: string
    fecha_emision: string
    fecha_emision_original: string | null
    fecha_vencimiento: string | null
    moneda: string
    referencia: string | null
    condicion_pago_label: string | null
    condicion_pago_tipo: string | null
    nota_plan_pago: string | null
    // Contacto
    contacto_nombre: string | null
    contacto_apellido: string | null
    contacto_identificacion: string | null
    contacto_condicion_iva: string | null
    contacto_direccion: string | null
    contacto_correo: string | null
    contacto_telefono: string | null
    // Atención
    atencion_nombre: string | null
    atencion_cargo: string | null
    atencion_correo: string | null
    // Totales
    subtotal_neto: string
    total_impuestos: string
    descuento_global: string
    descuento_global_monto: string
    total_final: string
    // Contenido
    notas_html: string | null
    condiciones_html: string | null
    pdf_url: string | null
    // Relaciones
    lineas: LineaPresupuesto[]
    cuotas: CuotaPago[]
  }
  empresa: {
    nombre: string
    logo_url: string | null
    color_marca: string | null
    descripcion: string | null
    telefono: string | null
    correo: string | null
    pagina_web: string | null
    ubicacion: string | null
    datos_fiscales: Record<string, string> | null
  }
  vendedor: {
    nombre: string
    correo: string | null
    telefono: string | null
  }
  datos_bancarios: {
    banco: string
    titular: string
    numero_cuenta: string
    cbu: string
    alias: string
  } | null
  moneda_simbolo: string
  /** Locale derivado de la zona horaria de la empresa (ej: 'es-AR', 'es-MX', 'es') */
  locale: string
  // Estado del portal (persistido)
  estado_cliente: EstadoPortal
  firma: {
    url: string | null
    nombre: string | null
    modo: string | null
  } | null
  aceptado_en: string | null
  rechazado_en: string | null
  motivo_rechazo: string | null
  mensajes: MensajePortal[]
  comprobantes: ComprobantePortal[]
}
