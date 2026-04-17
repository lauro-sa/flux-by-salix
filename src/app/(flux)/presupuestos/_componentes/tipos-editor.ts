/**
 * Tipos e interfaces compartidos entre las páginas de nuevo y edicion de presupuestos.
 * Se usa en: nuevo/page.tsx, [id]/page.tsx, componentes del editor.
 */

import type { LineaPresupuesto } from '@/tipos/presupuesto'

// Simbolos de moneda para formatear importes
export const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€',
}

// Contacto del buscador (resumen para selector)
export interface ContactoResumido {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp?: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  datos_fiscales: Record<string, string> | null
  condicion_iva: string | null
  direcciones: { id?: string; texto: string | null; tipo?: string; calle?: string | null; numero?: string | null; piso?: string | null; departamento?: string | null; barrio?: string | null; ciudad?: string | null; provincia?: string | null; pais?: string | null; codigo_postal?: string | null; timbre?: string | null; es_principal: boolean }[]
}

// Vinculacion de un contacto (persona vinculada a una empresa)
export interface Vinculacion {
  id: string
  vinculado_id: string
  puesto: string | null
  recibe_documentos: boolean
  vinculado: {
    id: string
    nombre: string
    apellido: string | null
    correo: string | null
    telefono: string | null
    whatsapp?: string | null
    tipo_contacto: { clave: string; etiqueta: string } | null
  }
}

// Datos fiscales de la empresa emisora
export interface DatosEmpresa {
  nombre: string
  telefono: string | null
  correo: string | null
  datos_fiscales: Record<string, unknown> | null
}

// Linea temporal (sin presupuesto_id, usada antes de guardar)
export interface LineaTemporal extends Omit<LineaPresupuesto, 'presupuesto_id'> {
  _temp: true
}
