// Utilidades para mapas — navegación externa y cálculos geográficos

import { abrirEnlaceExterno } from '@/lib/abrir-enlace-externo'
import type { PreferenciaRuta } from './tipos-mapa'

/**
 * Convierte preferencia de ruta a parámetro avoid de Google Maps URL.
 */
function obtenerAvoid(preferencia: PreferenciaRuta): string {
  switch (preferencia) {
    case 'evitar_autopistas': return '&avoid=highways'
    case 'evitar_peajes': return '&avoid=tolls'
    default: return ''
  }
}

/**
 * Abre Google Maps para navegación al destino.
 * Usa URL universal que funciona en mobile y desktop.
 */
export function abrirNavegacion(
  destino: { lat: number; lng: number },
  preferencia: PreferenciaRuta = 'rapida'
) {
  const avoid = obtenerAvoid(preferencia)
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving${avoid}`
  abrirEnlaceExterno(url)
}

/**
 * Abre Google Maps con ruta completa (múltiples waypoints).
 * Máximo 25 waypoints en Google Maps URL.
 */
export function abrirRutaCompleta(
  paradas: { lat: number; lng: number }[],
  origen?: { lat: number; lng: number },
  preferencia: PreferenciaRuta = 'rapida'
) {
  if (paradas.length === 0) return

  const destino = paradas[paradas.length - 1]
  const waypoints = paradas.slice(0, -1)
  const avoid = obtenerAvoid(preferencia)

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving${avoid}`

  if (origen) {
    url += `&origin=${origen.lat},${origen.lng}`
  }

  if (waypoints.length > 0) {
    const wp = waypoints.map(p => `${p.lat},${p.lng}`).join('|')
    url += `&waypoints=${wp}`
  }

  abrirEnlaceExterno(url)
}

/**
 * Construye un URL de Google Maps para "ir hacia" un destino, preferiendo
 * lat/lng exactos sobre el texto. El texto solo se usa cuando no hay coords —
 * y para reducir ambigüedad de geocoding (ej. "Sarmiento 4406, San Martín"
 * matchea decenas de "San Martín" en Argentina), agregamos `region=ar` para
 * sesgar el geocoder de Google a Argentina.
 *
 * Devuelve null si no hay nada útil (ni coords ni texto).
 */
export function urlMapaDestino(opts: {
  lat?: number | null
  lng?: number | null
  texto?: string | null
  modo?: 'dir' | 'search'
}): string | null {
  const modo = opts.modo || 'dir'
  if (typeof opts.lat === 'number' && typeof opts.lng === 'number') {
    const param = modo === 'dir' ? 'destination' : 'query'
    const travel = modo === 'dir' ? '&travelmode=driving' : ''
    return `https://www.google.com/maps/${modo}/?api=1&${param}=${opts.lat},${opts.lng}${travel}`
  }
  if (opts.texto) {
    const param = modo === 'dir' ? 'destination' : 'query'
    const travel = modo === 'dir' ? '&travelmode=driving' : ''
    // region=ar: sesga el geocoder hacia Argentina cuando el texto es ambiguo.
    return `https://www.google.com/maps/${modo}/?api=1&${param}=${encodeURIComponent(opts.texto)}${travel}&region=ar`
  }
  return null
}

/**
 * Calcula el centro geográfico de un array de puntos.
 * Default: Buenos Aires si no hay puntos.
 */
export function calcularCentro(
  puntos: { lat: number; lng: number }[]
): { lat: number; lng: number } {
  if (puntos.length === 0) return { lat: -34.6037, lng: -58.3816 }
  const lat = puntos.reduce((sum, p) => sum + p.lat, 0) / puntos.length
  const lng = puntos.reduce((sum, p) => sum + p.lng, 0) / puntos.length
  return { lat, lng }
}
