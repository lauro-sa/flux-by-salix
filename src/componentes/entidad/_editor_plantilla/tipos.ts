/**
 * Tipos compartidos para el editor de plantillas de correo.
 * Se usan en: ModalEditorPlantillaCorreo y sus sub-componentes.
 */

import type { PlantillaRespuesta } from '@/tipos/inbox'

// ─── Props del modal principal ───

export interface PropiedadesModalEditorPlantilla {
  abierto: boolean
  onCerrar: () => void
  /** Plantilla existente para editar (null = crear nueva) */
  plantilla?: PlantillaRespuesta | null
  /** Callback al guardar exitosamente */
  onGuardado: () => void
}

// ─── Resultado de búsqueda de contacto ───

export interface ContactoResultado {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  codigo?: string
}

// ─── Resultado de búsqueda de documento ───

export interface DocumentoResultado {
  id: string
  numero: string
  estado: string
  contacto_nombre: string | null
  total_final: string | null
  subtotal_neto: string | null
  total_impuestos: string | null
  descuento_global_monto: string | null
  moneda: string
  fecha_emision: string
  fecha_vencimiento: string | null
  condicion_pago_label: string | null
  condicion_pago_tipo: string | null
  referencia: string | null
  porcentaje_adelanto?: number
  pagado?: string | null
}

// ─── Cuota para preview ───

export interface CuotaPreview {
  numero: number
  descripcion: string
  porcentaje: string
  monto: string
  estado: string
}
