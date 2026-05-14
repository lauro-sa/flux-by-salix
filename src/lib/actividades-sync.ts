/**
 * Mantiene la sincronización bidireccional entre `actividades.fecha_vencimiento`
 * y los bloques de calendario (`eventos_calendario`) vinculados:
 *
 *   - `recalcularFechaVencimientoDesdeBloques` → cuando cambia un bloque
 *     del calendario, sincroniza la fecha_vencimiento al inicio del bloque
 *     más temprano. Lo llaman los endpoints de `/api/calendario/*`.
 *   - `moverPrimerBloqueAFecha` → cuando el usuario cambia
 *     `fecha_vencimiento` desde el editor de actividades, mueve el bloque
 *     más temprano a esa fecha (preservando la duración). Lo llama
 *     `/api/actividades/[id]` (PUT).
 *
 * Regla de producto (heredada de `/api/calendario/[id]/route.ts:333-334`):
 *   - Si quedan bloques activos: la fecha de vencimiento de la actividad
 *     se setea con el `fecha_inicio` del bloque más temprano.
 *   - Si ya no quedan bloques activos (todos en papelera o cancelados):
 *     la fecha de vencimiento se MANTIENE. No se borra. La idea es no
 *     perder la fecha "objetivo" original cuando alguien limpia el
 *     calendario sin querer abandonar el deadline.
 *
 * "Bloque activo" = evento de calendario con `en_papelera=false` y
 * `estado` distinto de `'cancelado'`. Los eventos cancelados representan
 * agendas frustradas (visitador no fue, se reprogramó manualmente, etc.)
 * y no deben condicionar el vencimiento.
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function recalcularFechaVencimientoDesdeBloques(
  actividadId: string,
  empresaId: string,
): Promise<void> {
  if (!actividadId || !empresaId) return
  const admin = crearClienteAdmin()

  // Tomar el bloque activo con fecha_inicio más temprana.
  const { data: bloque, error } = await admin
    .from('eventos_calendario')
    .select('fecha_inicio')
    .eq('actividad_id', actividadId)
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .neq('estado', 'cancelado')
    .order('fecha_inicio', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[actividades-sync] error leyendo eventos_calendario:', error)
    return
  }

  // Sin bloques activos → no tocamos la fecha (decisión de producto).
  if (!bloque?.fecha_inicio) return

  const { error: errorUpdate } = await admin
    .from('actividades')
    .update({ fecha_vencimiento: bloque.fecha_inicio })
    .eq('id', actividadId)
    .eq('empresa_id', empresaId)

  if (errorUpdate) {
    console.error('[actividades-sync] error actualizando fecha_vencimiento:', errorUpdate)
  }
}

/**
 * Mueve el bloque más temprano de la actividad al `nuevaFecha` (ISO string).
 * Preserva la duración del bloque (`fecha_fin - fecha_inicio` se mantiene).
 *
 * Retorna `true` si movió un bloque, `false` si la actividad no tiene
 * bloques activos (en ese caso el caller debe persistir la fecha_vencimiento
 * directamente en la columna). Esto desacopla el comportamiento: actividades
 * que no usan calendario siguen escribiendo `fecha_vencimiento` a mano sin
 * efectos colaterales.
 */
export async function moverPrimerBloqueAFecha(
  actividadId: string,
  empresaId: string,
  nuevaFecha: string,
): Promise<boolean> {
  if (!actividadId || !empresaId || !nuevaFecha) return false
  const admin = crearClienteAdmin()

  // Buscar el bloque activo más temprano + su duración.
  const { data: bloque, error } = await admin
    .from('eventos_calendario')
    .select('id, fecha_inicio, fecha_fin')
    .eq('actividad_id', actividadId)
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .neq('estado', 'cancelado')
    .order('fecha_inicio', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[actividades-sync] error leyendo bloque a mover:', error)
    return false
  }
  if (!bloque?.id || !bloque.fecha_inicio) return false

  // Calcular el nuevo fecha_fin preservando la duración original.
  let nuevoFin: string | null = null
  if (bloque.fecha_fin) {
    const inicio = new Date(bloque.fecha_inicio).getTime()
    const fin = new Date(bloque.fecha_fin).getTime()
    const duracionMs = fin - inicio
    if (Number.isFinite(duracionMs) && duracionMs > 0) {
      nuevoFin = new Date(new Date(nuevaFecha).getTime() + duracionMs).toISOString()
    }
  }

  const update: Record<string, unknown> = { fecha_inicio: nuevaFecha }
  if (nuevoFin) update.fecha_fin = nuevoFin

  const { error: errorUpdate } = await admin
    .from('eventos_calendario')
    .update(update)
    .eq('id', bloque.id)
    .eq('empresa_id', empresaId)

  if (errorUpdate) {
    console.error('[actividades-sync] error moviendo bloque:', errorUpdate)
    return false
  }

  return true
}
