import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'

/**
 * POST /api/mapa/optimizar-ruta
 * Optimiza el orden de paradas usando Google Directions API con waypoint optimization.
 * Body: { origen: {lat, lng}, paradas: [{id, lat, lng}] }
 */
export async function POST(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const body = await request.json()
  const { origen, paradas } = body as {
    origen: { lat: number; lng: number }
    paradas: { id: string; lat: number; lng: number }[]
  }

  if (!origen || !paradas?.length) {
    return NextResponse.json({ error: 'Faltan origen o paradas' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key de Google no configurada' }, { status: 500 })
  }

  const originStr = `${origen.lat},${origen.lng}`
  const waypointsStr = `optimize:true|${paradas.map((p) => `${p.lat},${p.lng}`).join('|')}`
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${originStr}&waypoints=${waypointsStr}&key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') {
    return NextResponse.json(
      { error: 'No se pudo optimizar la ruta', detalle: data.status },
      { status: 400 }
    )
  }

  const ordenOptimo = data.routes[0].waypoint_order as number[]
  const paradasOrdenadas = ordenOptimo.map((i: number) => paradas[i])

  const tramos = data.routes[0].legs.map(
    (leg: { distance: { value: number }; duration: { value: number } }) => ({
      distancia_km: Math.round(leg.distance.value / 100) / 10,
      duracion_min: Math.round(leg.duration.value / 60),
    })
  )

  return NextResponse.json({
    paradas_ordenadas: paradasOrdenadas,
    tramos,
    distancia_total_km: tramos.reduce((s: number, t: { distancia_km: number }) => s + t.distancia_km, 0),
    duracion_total_min: tramos.reduce((s: number, t: { duracion_min: number }) => s + t.duracion_min, 0),
  })
}
