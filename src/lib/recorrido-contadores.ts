/**
 * Helper para recalcular los contadores de un recorrido.
 * Se llama desde cualquier endpoint que agregue, quite o cambie el estado de una parada.
 *
 * Reglas:
 *  - total_visitas / visitas_completadas cuentan SOLO las paradas tipo 'visita'
 *    (leyendo el estado desde la tabla `visitas`).
 *  - total_paradas / paradas_completadas cuentan SOLO las paradas tipo 'parada'
 *    (usando el estado propio de la parada en `recorrido_paradas.estado`).
 *  - El recorrido pasa a 'completado' cuando TODAS las paradas (de los dos tipos)
 *    están finalizadas (completadas o canceladas). Pasa a 'en_curso' cuando alguna
 *    parada está activa o completada y todavía quedan pendientes.
 *
 * Acepta un `SupabaseClient` ya creado por el caller para no abrir clientes nuevos.
 */

import type { crearClienteAdmin } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof crearClienteAdmin>

export interface ResultadoContadores {
  total_visitas: number
  visitas_completadas: number
  total_paradas: number
  paradas_completadas: number
  estado: 'borrador' | 'pendiente' | 'en_curso' | 'completado'
}

export async function recalcularContadoresRecorrido(
  admin: Admin,
  recorridoId: string,
): Promise<ResultadoContadores | null> {
  // Estado actual del recorrido (para respetar 'borrador' y no forzar 'pendiente')
  const { data: recorrido } = await admin
    .from('recorridos')
    .select('estado')
    .eq('id', recorridoId)
    .single()

  if (!recorrido) return null

  // Paradas con su visita asociada (si corresponde)
  const { data: paradas } = await admin
    .from('recorrido_paradas')
    .select('id, tipo, estado, visita:visitas(estado)')
    .eq('recorrido_id', recorridoId)

  const lista = (paradas || []) as Array<{
    id: string
    tipo: 'visita' | 'parada'
    estado: string
    visita: { estado: string } | { estado: string }[] | null
  }>

  let totalVisitas = 0
  let visitasCompletadas = 0
  let totalParadas = 0
  let paradasCompletadas = 0
  let finalizadas = 0 // completadas + canceladas (cuentan para cerrar el recorrido)
  let activas = 0    // en_camino / en_sitio (fuerzan 'en_curso')

  for (const p of lista) {
    // Normalizar: supabase puede devolver la relación como array u objeto según config
    const visita = Array.isArray(p.visita) ? p.visita[0] : p.visita
    const estadoEfectivo = p.tipo === 'visita' ? (visita?.estado || 'programada') : p.estado

    if (p.tipo === 'visita') {
      totalVisitas++
      if (estadoEfectivo === 'completada') visitasCompletadas++
    } else {
      totalParadas++
      if (estadoEfectivo === 'completada') paradasCompletadas++
    }

    if (estadoEfectivo === 'completada' || estadoEfectivo === 'cancelada') finalizadas++
    if (estadoEfectivo === 'en_camino' || estadoEfectivo === 'en_sitio') activas++
  }

  const totalTodas = totalVisitas + totalParadas
  const estadoActual = recorrido.estado as ResultadoContadores['estado']

  // No tocar el estado si el recorrido está en borrador (el coordinador todavía no publicó).
  let nuevoEstado: ResultadoContadores['estado'] = estadoActual
  if (estadoActual !== 'borrador') {
    if (totalTodas > 0 && finalizadas >= totalTodas) nuevoEstado = 'completado'
    else if (activas > 0 || visitasCompletadas + paradasCompletadas > 0) nuevoEstado = 'en_curso'
    else nuevoEstado = 'pendiente'
  }

  await admin
    .from('recorridos')
    .update({
      total_visitas: totalVisitas,
      visitas_completadas: visitasCompletadas,
      total_paradas: totalParadas,
      paradas_completadas: paradasCompletadas,
      estado: nuevoEstado,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', recorridoId)

  return {
    total_visitas: totalVisitas,
    visitas_completadas: visitasCompletadas,
    total_paradas: totalParadas,
    paradas_completadas: paradasCompletadas,
    estado: nuevoEstado,
  }
}
