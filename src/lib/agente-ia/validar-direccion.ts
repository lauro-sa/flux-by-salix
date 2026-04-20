/**
 * Validación de direcciones con Google Places API.
 * Se usa en: pipeline.ts para validar direcciones capturadas por el agente IA.
 * Busca la dirección en Google, trae la versión formateada con barrio, ciudad, provincia.
 */

import { GOOGLE_PLACES_API, GOOGLE_PLACES_AUTOCOMPLETE } from '@/lib/constantes/api-urls'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY

interface DireccionValidada {
  calle: string        // "Juncal" (sin número)
  numero: string       // "1724"
  calleCompleta: string // "Juncal 1724" (para mostrar en confirmación)
  barrio: string
  ciudad: string
  provincia: string
  textoCompleto: string
  coordenadas: { lat: number; lng: number } | null
}

/**
 * Fetch con reintentos y backoff exponencial.
 * Reintenta en errores de red (catch) o en 5xx/429. No reintenta en 4xx salvo 429.
 */
async function fetchConRetry(
  url: string,
  opciones: RequestInit,
  intentos = 3,
  delayInicial = 400,
): Promise<Response | null> {
  let delay = delayInicial
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url, opciones)
      // Éxito o error no recuperable (4xx que no sea 429) → devolver directo
      if (res.ok) return res
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return res
      // 5xx o 429 → reintentar
      if (i < intentos - 1) {
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      return res
    } catch (err) {
      if (i === intentos - 1) {
        console.warn('[DIRECCION] fetch falló tras reintentos:', err)
        return null
      }
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  return null
}

/**
 * Busca una dirección en Google Places y devuelve la versión formateada.
 * Ejemplo: "directorio 1835 flores" → "Av. Directorio 1835, Flores, CABA"
 */
export async function validarDireccion(textoRaw: string): Promise<DireccionValidada | null> {
  if (!GOOGLE_API_KEY || !textoRaw || textoRaw.length < 5) return null

  try {
    // Paso 1: Autocompletar para encontrar el place (con retry en 5xx/red)
    const resAuto = await fetchConRetry(GOOGLE_PLACES_AUTOCOMPLETE, {
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

    if (!resAuto || !resAuto.ok) return null
    const datosAuto = await resAuto.json()

    const sugerencia = datosAuto.suggestions?.[0]?.placePrediction
    if (!sugerencia?.placeId) return null

    // Paso 2: Detalle del lugar (con retry en 5xx/red)
    const campos = 'addressComponents,location,formattedAddress'
    const resDetalle = await fetchConRetry(
      `${GOOGLE_PLACES_API}/${sugerencia.placeId}?languageCode=es`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': campos,
        },
      }
    )

    if (!resDetalle || !resDetalle.ok) return null
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

    let calleCompleta = numero ? `${calle} ${numero}` : calle

    // Usar formattedAddress de Google pero limpiarlo (quitar país y código postal)
    // Si la calle de Google es más completa (ej: "Avenida Directorio" vs "Directorio"), usarla
    if (datosDetalle.formattedAddress) {
      const formattedParts = datosDetalle.formattedAddress.split(',').map((p: string) => p.trim())
      if (formattedParts[0] && formattedParts[0].length > calleCompleta.length) {
        calleCompleta = formattedParts[0]
      }
    }

    // Texto completo para mostrar/confirmar: calle número, barrio, ciudad, provincia
    const textoCompleto = [calleCompleta, barrio, ciudad, provincia]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i) // evitar duplicados (ej: CABA como ciudad y provincia)
      .join(', ')

    const coordenadas = datosDetalle.location
      ? { lat: datosDetalle.location.latitude, lng: datosDetalle.location.longitude }
      : null

    return {
      calle,
      numero,
      calleCompleta,
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
