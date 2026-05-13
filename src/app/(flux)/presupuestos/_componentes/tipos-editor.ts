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

/**
 * Une las vinculaciones DIRECTAS (donde el contacto actual es el origen) con las
 * INVERSAS (donde el contacto actual es el destino), normalizando ambas al mismo
 * shape `Vinculacion`. El endpoint /api/contactos/[id] devuelve los dos arrays
 * por separado — sin esta función, el editor del presupuesto solo veía las
 * directas y dejaba sin opciones de "Dirigido a" a contactos como edificios
 * cuyas relaciones se crearon desde el otro lado (ej: "Bruno es propietario
 * de [edificio]").
 */
export function unirVinculaciones(
  directas: unknown[] | null | undefined,
  inversas: unknown[] | null | undefined,
): Vinculacion[] {
  const out: Vinculacion[] = []
  for (const v of (directas || []) as Vinculacion[]) {
    if (v?.vinculado) out.push(v)
  }
  for (const _v of (inversas || [])) {
    const v = _v as Record<string, unknown>
    const contacto = v.contacto as Record<string, unknown> | null
    if (!contacto) continue
    out.push({
      id: v.id as string,
      vinculado_id: v.contacto_id as string,
      puesto: (v.puesto as string) || null,
      recibe_documentos: (v.recibe_documentos as boolean) || false,
      vinculado: {
        id: contacto.id as string,
        nombre: (contacto.nombre as string) || '',
        apellido: (contacto.apellido as string) || null,
        correo: (contacto.correo as string) || null,
        telefono: (contacto.telefono as string) || null,
        whatsapp: (contacto.whatsapp as string) || null,
        tipo_contacto: contacto.tipo_contacto as { clave: string; etiqueta: string } | null,
      },
    })
  }
  return out
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
