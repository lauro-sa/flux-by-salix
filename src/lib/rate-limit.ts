/**
 * Rate limiter en memoria para endpoints públicos.
 * Limita requests por IP usando un Map con limpieza automática.
 * Se usa en: portal público, webhooks, endpoints sin auth.
 *
 * Nota: En Vercel serverless, cada instancia tiene su propio Map.
 * Para rate limiting distribuido real, usar Upstash Redis.
 * Esto es una primera capa de protección razonable.
 */

interface EntradaRateLimit {
  conteo: number
  reseteaEn: number
}

const limites = new Map<string, EntradaRateLimit>()

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const ahora = Date.now()
  for (const [clave, entrada] of limites) {
    if (ahora > entrada.reseteaEn) limites.delete(clave)
  }
}, 5 * 60 * 1000)

interface OpcionesRateLimit {
  /** Máximo de requests permitidos en la ventana */
  maximo: number
  /** Duración de la ventana en segundos */
  ventanaSegundos: number
}

/**
 * Verifica si un request está dentro del límite.
 * Retorna { permitido, restante, reseteaEn }
 */
export function verificarRateLimit(
  identificador: string,
  opciones: OpcionesRateLimit = { maximo: 60, ventanaSegundos: 60 }
): { permitido: boolean; restante: number; reseteaEn: number } {
  const ahora = Date.now()
  const entrada = limites.get(identificador)

  if (!entrada || ahora > entrada.reseteaEn) {
    // Nueva ventana
    const nuevaEntrada: EntradaRateLimit = {
      conteo: 1,
      reseteaEn: ahora + opciones.ventanaSegundos * 1000,
    }
    limites.set(identificador, nuevaEntrada)
    return { permitido: true, restante: opciones.maximo - 1, reseteaEn: nuevaEntrada.reseteaEn }
  }

  entrada.conteo++

  if (entrada.conteo > opciones.maximo) {
    return { permitido: false, restante: 0, reseteaEn: entrada.reseteaEn }
  }

  return { permitido: true, restante: opciones.maximo - entrada.conteo, reseteaEn: entrada.reseteaEn }
}

/** Obtiene el IP del request (compatible con Vercel) */
export function obtenerIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'desconocido'
}
