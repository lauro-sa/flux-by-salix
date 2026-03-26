/**
 * API Route — Proxy de autocompletado de Google Places API (New).
 * Mantiene la API key en el servidor, nunca se expone al cliente.
 * Se usa en: hook useBuscadorDirecciones.
 */

import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Google Places API key no configurada' },
      { status: 500 }
    )
  }

  try {
    const { texto, paises, sessionToken } = await request.json()

    if (!texto || texto.length < 3) {
      return NextResponse.json({ sugerencias: [] })
    }

    const cuerpo: Record<string, unknown> = {
      input: texto,
      languageCode: 'es',
    }

    // Restricción por países (máximo 5, formato ISO 3166-1 alpha-2)
    if (paises?.length) {
      cuerpo.includedRegionCodes = paises.slice(0, 5)
    }

    // Session token para agrupar llamadas y reducir costos
    if (sessionToken) {
      cuerpo.sessionToken = sessionToken
    }

    const respuesta = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
        },
        body: JSON.stringify(cuerpo),
      }
    )

    if (!respuesta.ok) {
      const errorTexto = await respuesta.text()
      console.error('Error Google Places Autocomplete:', errorTexto)
      return NextResponse.json(
        { error: 'Error al buscar direcciones' },
        { status: respuesta.status }
      )
    }

    const datos = await respuesta.json()

    // Mapear respuesta de Google al formato interno
    const sugerencias = (datos.suggestions || [])
      .filter((s: Record<string, unknown>) => s.placePrediction)
      .map((s: { placePrediction: { placeId: string; structuredFormat: { mainText: { text: string }; secondaryText: { text: string } } } }) => ({
        placeId: s.placePrediction.placeId,
        textoPrincipal: s.placePrediction.structuredFormat.mainText.text,
        textoSecundario: s.placePrediction.structuredFormat.secondaryText.text,
      }))

    return NextResponse.json({ sugerencias })
  } catch (error) {
    console.error('Error en autocompletar:', error)
    return NextResponse.json(
      { error: 'Error interno al buscar direcciones' },
      { status: 500 }
    )
  }
}
