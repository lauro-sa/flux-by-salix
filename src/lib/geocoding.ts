/**
 * Geocoding — convierte un texto de dirección en coordenadas lat/lng usando
 * la API de Google Geocoding.
 *
 * USO PRINCIPAL
 * Cuando el usuario crea/edita una visita escribiendo el texto a mano (sin
 * usar el autocompletar de Google), el backend llama a esta función para
 * intentar resolver coords. Sin coords:
 *   - El botón "Navegar" cae al texto crudo (geocoder de Maps puede fallar)
 *   - El cálculo de ETA del aviso "en camino" no funciona — el WhatsApp sale
 *     con "en breve" en vez del tiempo estimado
 *
 * USA LA MISMA API KEY que Places y Directions (GOOGLE_PLACES_API_KEY).
 * El proyecto de Google Cloud tiene que tener "Geocoding API" habilitada.
 *
 * NO falla nunca: si no hay key, si la red falla o si Google no encuentra
 * la dirección, devuelve null. La capa que la llama decide qué hacer.
 */

export async function geocodificarDireccion(
  texto: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  const textoLimpio = texto.trim()
  if (!textoLimpio) return null

  // region=ar: sesga el geocoder a Argentina cuando el texto es ambiguo
  // (ej. "Sarmiento 4406, San Martín" — hay varios "San Martín" en el mundo).
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(textoLimpio)}&region=ar&language=es&key=${apiKey}`

  try {
    const resp = await fetch(url, {
      // Timeout corto: si Google tarda, no bloqueamos la creación de la visita.
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return null
    const data = await resp.json() as {
      status: string
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>
    }
    if (data.status !== 'OK' || !data.results?.length) return null
    const loc = data.results[0].geometry?.location
    if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null
    return { lat: loc.lat, lng: loc.lng }
  } catch {
    // Timeout, network, parse error → degradar silencioso. Mejor crear la
    // visita sin coords que fallar la operación entera.
    return null
  }
}
