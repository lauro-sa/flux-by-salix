/**
 * Helpers de ETA para mensajes de "voy en camino".
 * Calcula duración real con Google Directions y genera un texto
 * redondeado a múltiplos amigables — nunca comprometedor (22 min → "25 min aproximadamente").
 * Se usa en: /api/recorrido/aviso-en-camino y afines.
 */

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json'

export interface PuntoGeo {
  lat: number
  lng: number
}

export interface ResultadoETA {
  duracion_min: number   // minutos crudos según Google (con tráfico si hay)
  distancia_km: number
}

/**
 * Llama a Google Directions API (driving, con tráfico) para obtener ETA entre dos puntos.
 * Retorna null si Google no responde OK o no hay ruta.
 */
export async function calcularETA(
  origen: PuntoGeo,
  destino: PuntoGeo,
  apiKey: string,
): Promise<ResultadoETA | null> {
  const params = new URLSearchParams({
    origin: `${origen.lat},${origen.lng}`,
    destination: `${destino.lat},${destino.lng}`,
    mode: 'driving',
    departure_time: 'now', // habilita duration_in_traffic
    key: apiKey,
  })

  try {
    const res = await fetch(`${DIRECTIONS_URL}?${params.toString()}`)
    const data = await res.json()
    if (data.status !== 'OK') return null
    const leg = data.routes?.[0]?.legs?.[0]
    if (!leg) return null
    // duration_in_traffic aparece cuando departure_time=now — es más realista
    const segundos = leg.duration_in_traffic?.value ?? leg.duration?.value
    if (typeof segundos !== 'number') return null
    return {
      duracion_min: Math.round(segundos / 60),
      distancia_km: Math.round(leg.distance.value / 100) / 10,
    }
  } catch {
    return null
  }
}

/**
 * Redondea minutos a un múltiplo "amigable" para usar en mensajes conversacionales.
 * Siempre redondea hacia arriba — preferible llegar antes que después de lo prometido.
 * - ≤ 30 min → múltiplos de 5 (22 → 25, 30 → 30)
 * - 31-60 min → múltiplos de 10 (45 → 50, 52 → 60)
 * - > 60 min → múltiplos de 15 (75 → 75, 80 → 90)
 */
export function redondearETA(minutos: number): number {
  if (minutos <= 0) return 5
  if (minutos <= 30) return Math.ceil(minutos / 5) * 5
  if (minutos <= 60) return Math.ceil(minutos / 10) * 10
  return Math.ceil(minutos / 15) * 15
}

/**
 * Arma el fragmento textual con el ETA ya redondeado.
 * Ejemplos:
 *   22  → "dentro de los próximos 25 minutos aproximadamente"
 *   45  → "dentro de los próximos 50 minutos aproximadamente"
 *   60  → "dentro de aproximadamente 1 hora"
 *   90  → "dentro de aproximadamente 1 hora y 30 minutos"
 */
export function formatearETATexto(minutosRaw: number): string {
  const min = redondearETA(minutosRaw)
  if (min < 60) return `dentro de los próximos ${min} minutos aproximadamente`
  const horas = Math.floor(min / 60)
  const resto = min % 60
  if (resto === 0) {
    return `dentro de aproximadamente ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }
  return `dentro de aproximadamente ${horas} ${horas === 1 ? 'hora' : 'horas'} y ${resto} minutos`
}

