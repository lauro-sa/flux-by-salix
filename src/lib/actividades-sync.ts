/**
 * Mantiene `actividades.fecha_vencimiento` sincronizada con los bloques
 * de calendario (`eventos_calendario`) vinculados a la actividad.
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
