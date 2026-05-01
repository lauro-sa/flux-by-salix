/**
 * Orden inteligente de actividades.
 * Criterio único compartido entre el Server Component (SSR inicial) y la API route,
 * para que la primera carga y los re-fetches del cliente coincidan exactamente.
 *
 * Reglas:
 *   1. Cerradas (completada/cancelada) siempre al final.
 *   2. Por urgencia: Vencidas → Hoy → Futuras → Sin fecha.
 *   3. Dentro del mismo grupo: prioridad alta primero.
 *   4. Misma prioridad: fecha ascendente
 *      (vencidas: las más viejas/atrasadas arriba; futuras: las más próximas arriba).
 */

interface ActividadOrdenable {
  estado_clave: string | null
  prioridad: string | null
  fecha_vencimiento: string | null
}

const PESO_PRIORIDAD: Record<string, number> = { alta: 1, normal: 2, baja: 3 }

function esCerrada(estadoClave: string | null): boolean {
  return estadoClave === 'completada' || estadoClave === 'cancelada'
}

/**
 * Ordena actividades respetando el criterio inteligente de Flux.
 * @param actividades lista a ordenar (no muta — devuelve copia ordenada)
 * @param inicioHoy timestamp del inicio del día "hoy" en zona del usuario/empresa
 * @param inicioManana timestamp del inicio del día siguiente
 */
export function ordenarActividadesInteligente<T extends ActividadOrdenable>(
  actividades: T[],
  inicioHoy: Date,
  inicioManana: Date,
): T[] {
  const pesoGrupo = (fecha: string | null): number => {
    if (!fecha) return 4 // sin fecha al final
    const f = new Date(fecha)
    if (f < inicioHoy) return 1 // vencidas primero (lo más urgente)
    if (f >= inicioHoy && f < inicioManana) return 2 // hoy
    return 3 // futuras
  }

  return [...actividades].sort((a, b) => {
    const ca = esCerrada(a.estado_clave) ? 1 : 0
    const cb = esCerrada(b.estado_clave) ? 1 : 0
    if (ca !== cb) return ca - cb

    const ga = pesoGrupo(a.fecha_vencimiento)
    const gb = pesoGrupo(b.fecha_vencimiento)
    if (ga !== gb) return ga - gb

    const pa = PESO_PRIORIDAD[a.prioridad ?? ''] || 2
    const pb = PESO_PRIORIDAD[b.prioridad ?? ''] || 2
    if (pa !== pb) return pa - pb

    if (a.fecha_vencimiento && b.fecha_vencimiento) {
      const fa = new Date(a.fecha_vencimiento).getTime()
      const fb = new Date(b.fecha_vencimiento).getTime()
      return fa - fb
    }
    return 0
  })
}
