/**
 * API Route — Obtiene detalle completo de un lugar de Google Places API (New).
 * Parsea address_components y extrae coordenadas.
 * Se usa en: hook useBuscadorDirecciones (al seleccionar una sugerencia).
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Direccion } from '@/tipos/direccion'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY

/** Mapa de tipos de Google → campos internos */
function parsearComponentes(componentes: { types: string[]; longText: string }[]): Omit<Direccion, 'coordenadas' | 'textoCompleto'> {
  let calle = ''
  let numero = ''
  let barrio = ''
  let ciudad = ''
  let provincia = ''
  let codigoPostal = ''
  let pais = ''

  for (const comp of componentes) {
    const tipos = comp.types
    if (tipos.includes('route')) calle = comp.longText
    else if (tipos.includes('street_number')) numero = comp.longText
    else if (tipos.includes('sublocality_level_1') || tipos.includes('sublocality')) barrio = comp.longText
    else if (tipos.includes('locality')) ciudad = comp.longText
    else if (tipos.includes('administrative_area_level_1')) provincia = comp.longText
    else if (tipos.includes('postal_code')) codigoPostal = comp.longText
    else if (tipos.includes('country')) pais = comp.longText
  }

  // Caso especial CABA: Google devuelve "Comuna X" como locality
  if (ciudad.startsWith('Comuna') && provincia) {
    ciudad = provincia
  }

  // Si no hay ciudad pero hay provincia, usar provincia
  if (!ciudad && provincia) {
    ciudad = provincia
  }

  return { calle, numero, barrio, ciudad, provincia, codigoPostal, pais }
}

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Google Places API key no configurada' },
      { status: 500 }
    )
  }

  try {
    const { placeId, sessionToken } = await request.json()

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId es requerido' },
        { status: 400 }
      )
    }

    // Pedir solo los campos necesarios para reducir costos
    const campos = 'addressComponents,location,formattedAddress'

    let url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`
    if (sessionToken) {
      url += `&sessionToken=${sessionToken}`
    }

    const respuesta = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': campos,
      },
    })

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      console.error('Error Google Places Detail:', errorTexto)
      return NextResponse.json(
        { error: 'Error al obtener detalle de dirección' },
        { status: respuesta.status }
      )
    }

    const datos = await respuesta.json()

    const componentes = parsearComponentes(datos.addressComponents || [])

    // Construir texto de calle con número
    const calleCompleta = componentes.numero
      ? `${componentes.calle} ${componentes.numero}`
      : componentes.calle

    const coordenadas = datos.location
      ? { lat: datos.location.latitude, lng: datos.location.longitude }
      : null

    // Texto completo para display y búsqueda
    const partes = [calleCompleta, componentes.barrio, componentes.ciudad, componentes.provincia, componentes.pais].filter(Boolean)
    const textoCompleto = datos.formattedAddress || partes.join(', ')

    const direccion: Direccion = {
      ...componentes,
      calle: calleCompleta,
      coordenadas,
      textoCompleto,
    }

    return NextResponse.json({ direccion })
  } catch (error) {
    console.error('Error en detalle:', error)
    return NextResponse.json(
      { error: 'Error interno al obtener detalle' },
      { status: 500 }
    )
  }
}
