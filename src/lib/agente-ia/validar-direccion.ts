/**
 * Validación de direcciones con Google Places API.
 * Se usa en: pipeline.ts para validar direcciones capturadas por el agente IA.
 * Busca la dirección en Google, trae la versión formateada con barrio, ciudad, provincia.
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY

interface DireccionValidada {
  calle: string
  barrio: string
  ciudad: string
  provincia: string
  textoCompleto: string
  coordenadas: { lat: number; lng: number } | null
}

/**
 * Busca una dirección en Google Places y devuelve la versión formateada.
 * Ejemplo: "directorio 1835 flores" → "Av. Directorio 1835, Flores, CABA"
 */
export async function validarDireccion(textoRaw: string): Promise<DireccionValidada | null> {
  if (!GOOGLE_API_KEY || !textoRaw || textoRaw.length < 5) return null

  try {
    // Paso 1: Autocompletar para encontrar el place
    const resAuto = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: textoRaw,
        languageCode: 'es',
        includedRegionCodes: ['ar'],
      }),
    })

    if (!resAuto.ok) return null
    const datosAuto = await resAuto.json()

    const sugerencia = datosAuto.suggestions?.[0]?.placePrediction
    if (!sugerencia?.placeId) return null

    // Paso 2: Detalle del lugar
    const campos = 'addressComponents,location,formattedAddress'
    const resDetalle = await fetch(
      `https://places.googleapis.com/v1/places/${sugerencia.placeId}?languageCode=es`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': campos,
        },
      }
    )

    if (!resDetalle.ok) return null
    const datosDetalle = await resDetalle.json()

    // Paso 3: Parsear componentes
    const componentes = datosDetalle.addressComponents || []
    let calle = ''
    let numero = ''
    let barrio = ''
    let ciudad = ''
    let provincia = ''

    for (const comp of componentes) {
      const tipos = comp.types as string[]
      if (tipos.includes('route')) calle = comp.longText
      else if (tipos.includes('street_number')) numero = comp.longText
      else if (tipos.includes('sublocality_level_1') || tipos.includes('sublocality')) barrio = comp.longText
      else if (tipos.includes('locality')) ciudad = comp.longText
      else if (tipos.includes('administrative_area_level_1')) provincia = comp.longText
    }

    // Caso especial CABA
    if (ciudad.startsWith('Comuna') && provincia) {
      ciudad = provincia
    }
    if (!ciudad && provincia) {
      ciudad = provincia
    }

    const calleCompleta = numero ? `${calle} ${numero}` : calle
    const partes = [calleCompleta, barrio, ciudad].filter(Boolean)
    const textoCompleto = partes.join(', ')

    const coordenadas = datosDetalle.location
      ? { lat: datosDetalle.location.latitude, lng: datosDetalle.location.longitude }
      : null

    return {
      calle: calleCompleta,
      barrio,
      ciudad,
      provincia,
      textoCompleto,
      coordenadas,
    }
  } catch (err) {
    console.warn('[DIRECCION] Error validando:', err)
    return null
  }
}
