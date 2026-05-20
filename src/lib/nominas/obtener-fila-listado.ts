/**
 * Helper para enriquecer el snapshot de una liquidación con la fila
 * completa del listado, tal cual la devuelve /api/nominas GET.
 *
 * Uso: lo llaman `/api/nominas/liquidar` y `/api/nominas/pagos` antes
 * de persistir el snapshot, para que al releer el período el endpoint
 * pueda saltarse el motor entero y devolver la fila desde la BD.
 *
 * Hace un fetch HTTP interno al propio endpoint, reusando la cookie de
 * autenticación del request original. Es un round-trip extra pero la
 * operación de liquidar/pagar es poco frecuente (1-N veces por período
 * por mes), así que el costo es despreciable comparado con el ahorro
 * en cada GET futuro del listado.
 *
 * Si falla la red o el endpoint devuelve algo inesperado, devuelve null
 * y el snapshot se persiste sin `fila_listado`. En ese caso, los GET
 * futuros caen al motor en vivo (backwards-compat con shape v3.0).
 */

import type { NextRequest } from 'next/server'

export async function obtenerFilaListadoParaSnapshot(
  request: NextRequest,
  miembroId: string,
  periodoInicio: string,
  periodoFin: string,
): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams()
    params.set('desde', periodoInicio)
    params.set('hasta', periodoFin)
    params.set('empleados', miembroId)
    const url = new URL(`/api/nominas?${params.toString()}`, request.url)
    const cookie = request.headers.get('cookie') ?? ''
    const r = await fetch(url, { headers: { cookie }, cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json() as { resultados?: Array<Record<string, unknown>> }
    return data.resultados?.[0] ?? null
  } catch {
    return null
  }
}
