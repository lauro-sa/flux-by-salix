/**
 * Cálculo de horarios estimados para un recorrido.
 *
 * Dado el array de paradas (en orden), estima:
 *   - hora de llegada a cada parada
 *   - hora estimada de fin del recorrido
 *   - distancia total (km)
 *
 * Para paradas ya tocadas usa los timestamps reales de la BD (fecha_inicio,
 * fecha_llegada, fecha_completada). Para las futuras proyecta desde el último
 * timestamp conocido (o desde "ahora" si el recorrido aún no arrancó) sumando
 * `duracion_viaje_min` (trayecto hasta la parada) + `duracion_estimada_min`
 * (tiempo que pasa en cada parada).
 *
 * Se usa en: página /recorrido (barra superior, tarjeta de parada, lista) y
 * en la planificación del recorrido.
 */

/** Parada mínima requerida para el cálculo — compatible con visita y parada genérica. */
export interface ParadaHorario {
  tipo: 'visita' | 'parada'
  estado?: string | null
  fecha_inicio?: string | null // cuando arrancó el trayecto hacia la parada (en_camino)
  fecha_llegada?: string | null // cuando llegó (en_sitio)
  fecha_completada?: string | null // cuando se completó
  distancia_km?: number | null // distancia del trayecto HASTA esta parada
  duracion_viaje_min?: number | null // duración del trayecto HASTA esta parada
  duracion_estimada_min?: number | null // tiempo estimado dentro de la parada (visita)
  lat?: number | null
  lng?: number | null
}

/** Info del tramo que llega hasta una parada (desde la anterior). */
export interface TramoHorario {
  km: number
  min: number
  /** `true` si se estimó con Haversine (sin Directions API). `false` si vino de BD. */
  esEstimado: boolean
}

/** Resultado por parada. */
export interface HorarioParada {
  /** Hora estimada (o real) de llegada a la parada. */
  llegada: Date | null
  /** Hora estimada (o real) de salida hacia la siguiente. */
  salida: Date | null
  /** `true` si al menos la llegada es dato real (ya pasó). */
  esReal: boolean
  /** Tramo desde la parada anterior. `null` para la primera. */
  tramo: TramoHorario | null
}

/**
 * Distancia en km por Haversine (línea recta). Se usa cuando BD no tiene
 * `distancia_km` del trayecto real (que viene de Google Directions al
 * optimizar ruta). Aplicamos un factor 1.3 para compensar rodeos de calles.
 */
function distanciaRecta(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // radio terrestre en km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Factor de conversión línea-recta → distancia por calles. */
const FACTOR_RODEO = 1.3
/** Velocidad promedio urbana supuesta para estimar tiempo (~24 km/h con tráfico). */
const MIN_POR_KM = 2.5

export interface ResumenHorarios {
  /** Horario por cada parada (mismo orden que el input). */
  porParada: HorarioParada[]
  /** Hora estimada de fin del recorrido (última salida). `null` si no hay paradas. */
  horaFin: Date | null
  /** Distancia total en km (suma de `distancia_km`). */
  kmTotal: number
  /** Duración total estimada en minutos (trayectos + paradas). */
  duracionTotalMin: number
}

/**
 * Duración dentro de una parada. Para paradas genéricas (tipo='parada') usamos
 * 10 min como valor típico (ej: café, carga combustible). Para visitas usa
 * `duracion_estimada_min` o 30 de fallback.
 */
function duracionInterna(p: ParadaHorario): number {
  if (p.tipo === 'parada') return 10
  return p.duracion_estimada_min ?? 30
}

/**
 * Calcula los horarios estimados de un recorrido.
 *
 * @param paradas Array de paradas en orden.
 * @param horaReferencia Hora desde donde proyectar si el recorrido no arrancó (default: now).
 * @param origen Coordenadas de partida (usuario / empresa). Si se provee, se calcula
 *               el tramo desde el origen hasta la primera parada con Haversine.
 */
export function calcularHorariosRecorrido(
  paradas: ParadaHorario[],
  horaReferencia: Date = new Date(),
  origen?: { lat: number; lng: number } | null,
): ResumenHorarios {
  const porParada: HorarioParada[] = []
  let cursor: Date | null = null
  let duracionTotalMin = 0
  let kmTotal = 0

  for (let i = 0; i < paradas.length; i++) {
    const p = paradas[i]
    const estado = p.estado || 'programada'
    const anterior = i > 0 ? paradas[i - 1] : null
    // Para la primera parada (i=0) usamos `origen` (ubicación del usuario/empresa)
    // como referencia. Para el resto, la parada anterior.
    const refLat = anterior?.lat ?? (i === 0 ? origen?.lat : null)
    const refLng = anterior?.lng ?? (i === 0 ? origen?.lng : null)

    // Resolver distancia/duración del tramo. Si BD no las tiene (null), caer a Haversine
    // calculado desde la coord de referencia. Si tampoco hay coords, null.
    let kmTramo = p.distancia_km ?? null
    let minTramo = p.duracion_viaje_min ?? null
    let tramoEstimado = false
    if ((kmTramo == null || minTramo == null) && refLat != null && refLng != null && p.lat != null && p.lng != null) {
      const kmRecto = distanciaRecta(refLat, refLng, p.lat, p.lng)
      const kmEst = kmRecto * FACTOR_RODEO
      if (kmTramo == null) { kmTramo = Math.round(kmEst * 10) / 10; tramoEstimado = true }
      if (minTramo == null) { minTramo = Math.max(1, Math.round(kmEst * MIN_POR_KM)); tramoEstimado = true }
    }
    const tramo: TramoHorario | null = (kmTramo != null || minTramo != null)
      ? { km: kmTramo ?? 0, min: minTramo ?? 0, esEstimado: tramoEstimado }
      : null

    const viajeMin = minTramo ?? 0
    const internaMin = duracionInterna(p)
    kmTotal += kmTramo ?? 0
    duracionTotalMin += viajeMin + internaMin

    // Paradas completadas — datos reales si los tenemos.
    if (estado === 'completada' && p.fecha_completada) {
      const llegada = p.fecha_llegada ? new Date(p.fecha_llegada) : null
      const salida = new Date(p.fecha_completada)
      porParada.push({ llegada, salida, esReal: true, tramo })
      cursor = salida
      continue
    }

    // En el sitio — llegó de verdad, la salida se estima sumando duración interna.
    if (estado === 'en_sitio' && p.fecha_llegada) {
      const llegada = new Date(p.fecha_llegada)
      const salida = new Date(llegada.getTime() + internaMin * 60_000)
      porParada.push({ llegada, salida, esReal: true, tramo })
      cursor = salida
      continue
    }

    // En camino — ya salió hacia esta parada; estimamos llegada y salida.
    if (estado === 'en_camino' && p.fecha_inicio) {
      const inicio = new Date(p.fecha_inicio)
      const llegada = new Date(inicio.getTime() + viajeMin * 60_000)
      const salida = new Date(llegada.getTime() + internaMin * 60_000)
      porParada.push({ llegada, salida, esReal: false, tramo })
      cursor = salida
      continue
    }

    // Cancelada — no suma tiempo pero mantenemos el cursor.
    if (estado === 'cancelada') {
      porParada.push({ llegada: null, salida: null, esReal: false, tramo })
      duracionTotalMin -= viajeMin + internaMin // revertimos lo sumado: no se recorre
      kmTotal -= kmTramo ?? 0
      continue
    }

    // Futuro — proyectamos desde el cursor (o desde hora de referencia la 1ra vez).
    const partida: Date = cursor ?? horaReferencia
    const llegadaFut = new Date(partida.getTime() + viajeMin * 60_000)
    const salidaFut = new Date(llegadaFut.getTime() + internaMin * 60_000)
    porParada.push({ llegada: llegadaFut, salida: salidaFut, esReal: false, tramo })
    cursor = salidaFut
  }

  return {
    porParada,
    horaFin: cursor,
    kmTotal,
    duracionTotalMin,
  }
}

/** Formatea una Date a `HH:MM` 24h (hora local del navegador). */
export function formatearHora(fecha: Date | null): string {
  if (!fecha) return '—'
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
