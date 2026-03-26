/**
 * Tipos para el sistema de direcciones con Google Places API.
 * Se usa en: InputDireccion, useBuscadorDirecciones, API de lugares.
 */

/** Dirección estructurada que devuelve el buscador */
export interface Direccion {
  calle: string
  numero: string
  barrio: string
  ciudad: string
  provincia: string
  codigoPostal: string
  pais: string
  coordenadas: {
    lat: number
    lng: number
  } | null
  /** Texto completo concatenado para búsqueda y display */
  textoCompleto: string
}

/** Sugerencia individual del autocompletado */
export interface SugerenciaDireccion {
  placeId: string
  textoPrincipal: string
  textoSecundario: string
}

/** Tipos de dirección para entidades que manejan múltiples */
export type TipoDireccion = 'principal' | 'fiscal' | 'sucursal' | 'deposito' | 'entrega' | 'otro'

/** Dirección con tipo y campos extra manuales (para guardar en BD) */
export interface DireccionCompleta extends Direccion {
  tipo: TipoDireccion
  piso?: string
  departamento?: string
  referencia?: string
}
