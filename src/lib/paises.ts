/**
 * Países disponibles en Flux — se usa en configuración de empresa y formularios de contacto.
 * Solo se listan países que tienen campos fiscales configurados en la tabla campos_fiscales_pais.
 */

export interface PaisDisponible {
  codigo: string
  nombre: string
  bandera: string
}

export const PAISES_DISPONIBLES: PaisDisponible[] = [
  { codigo: 'AR', nombre: 'Argentina', bandera: '🇦🇷' },
  { codigo: 'MX', nombre: 'México', bandera: '🇲🇽' },
  { codigo: 'CO', nombre: 'Colombia', bandera: '🇨🇴' },
  { codigo: 'ES', nombre: 'España', bandera: '🇪🇸' },
  { codigo: 'CL', nombre: 'Chile', bandera: '🇨🇱' },
  { codigo: 'UY', nombre: 'Uruguay', bandera: '🇺🇾' },
  { codigo: 'PE', nombre: 'Perú', bandera: '🇵🇪' },
  { codigo: 'BR', nombre: 'Brasil', bandera: '🇧🇷' },
  { codigo: 'US', nombre: 'Estados Unidos', bandera: '🇺🇸' },
]

/** Obtener nombre + bandera de un código de país */
export function obtenerPais(codigo: string): PaisDisponible | undefined {
  return PAISES_DISPONIBLES.find(p => p.codigo === codigo)
}

/** Obtener etiqueta formateada "🇦🇷 Argentina" */
export function etiquetaPais(codigo: string): string {
  const pais = obtenerPais(codigo)
  return pais ? `${pais.bandera} ${pais.nombre}` : codigo
}
