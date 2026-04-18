/**
 * validarRequisitosEtapa — Valida requisitos de una etapa del pipeline antes de mover una conversacion.
 * Se usa en: VistaPipeline.tsx (drag & drop), DrawerChat (selector de etapa).
 * Separa requisitos estrictos (bloquean) de recomendados (advierten).
 */

import type { ConversacionConDetalles, RequisitoEtapa } from '@/tipos/inbox'

// ─── Catalogo de requisitos con validaciones ───

export const CATALOGO_REQUISITOS: Record<
  string,
  { nombre: string; icono: string; validar: (conv: ConversacionConDetalles) => boolean }
> = {
  contacto_vinculado: {
    nombre: 'Contacto vinculado',
    icono: '\u{1F464}', // persona
    validar: (conv) => !!conv.contacto_id,
  },
  agente_asignado: {
    nombre: 'Agente asignado',
    icono: '\u{1F9D1}\u{200D}\u{1F4BC}', // profesional
    validar: (conv) => !!conv.asignado_a,
  },
  sector: {
    nombre: 'Sector asignado',
    icono: '\u{1F3E2}', // edificio
    validar: (conv) => !!conv.sector_id,
  },
  direccion: {
    nombre: 'Contacto tiene direccion',
    icono: '\u{1F4CD}', // pin
    // La interfaz ConversacionConDetalles.contacto no incluye campo direccion.
    // Para validar realmente, habría que expandir esa interfaz con los datos
    // de direcciones del contacto (tabla contacto_direcciones).
    // Por ahora siempre pasa — se valida del lado del servidor al mover etapa.
    validar: () => true,
  },
  email: {
    nombre: 'Contacto tiene email',
    icono: '\u{2709}\u{FE0F}', // sobre
    validar: (conv) => !!conv.contacto?.correo,
  },
  telefono: {
    nombre: 'Contacto tiene telefono',
    icono: '\u{1F4DE}', // telefono
    validar: (conv) => !!(conv.contacto?.telefono || conv.contacto?.whatsapp),
  },
}

// ─── Resultado de la validacion ───

export interface ResultadoValidacion {
  /** Requisitos estrictos que no se cumplen — bloquean el movimiento */
  estrictos: { campo: string; nombre: string; icono: string }[]
  /** Requisitos recomendados que no se cumplen — advierten pero permiten continuar */
  recomendados: { campo: string; nombre: string; icono: string }[]
}

/**
 * Valida los requisitos de una etapa contra una conversacion.
 * Devuelve listas separadas de requisitos estrictos y recomendados que fallan.
 */
export function validarRequisitosEtapa(
  conversacion: ConversacionConDetalles,
  requisitos: RequisitoEtapa[]
): ResultadoValidacion {
  const estrictos: ResultadoValidacion['estrictos'] = []
  const recomendados: ResultadoValidacion['recomendados'] = []

  for (const req of requisitos) {
    const catalogo = CATALOGO_REQUISITOS[req.campo]
    if (!catalogo) continue

    if (!catalogo.validar(conversacion)) {
      const item = { campo: req.campo, nombre: catalogo.nombre, icono: catalogo.icono }
      if (req.estricto) estrictos.push(item)
      else recomendados.push(item)
    }
  }

  return { estrictos, recomendados }
}

/**
 * Valida si el usuario tiene permiso para mover a una etapa con sectores restringidos.
 * Los admins siempre pueden mover. Si no hay sectores configurados, tambien pasa.
 */
export function validarPermisoSector(
  sectoresPermitidos: string[] | undefined,
  sectorIdsUsuario: string[],
  esAdmin: boolean
): boolean {
  if (esAdmin) return true
  if (!sectoresPermitidos || sectoresPermitidos.length === 0) return true
  return sectorIdsUsuario.some((s) => sectoresPermitidos.includes(s))
}
