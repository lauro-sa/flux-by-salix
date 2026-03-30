/**
 * Tipos para el portal público de presupuestos.
 * Se usa en: API portal, página portal, componentes portal.
 */

import type { LineaPresupuesto, CuotaPago } from './presupuesto'

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
}

// ─── Datos que recibe la página pública del portal ──────────────────────────

export interface DatosPortal {
  presupuesto: {
    id: string
    numero: string
    estado: string
    fecha_emision: string
    fecha_vencimiento: string | null
    moneda: string
    referencia: string | null
    condicion_pago_label: string | null
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
    cbu: string
    alias: string
  } | null
  moneda_simbolo: string
}
