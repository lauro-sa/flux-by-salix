/**
 * /api/nominas/ajustes-periodo/[id]
 *
 * DELETE → elimina un ajuste puntual del período. Hard delete: el
 *          motor recalcula sin el ajuste y el operador puede volver
 *          a crear uno distinto. No mantenemos historial: si fue un
 *          error, simplemente se borra.
 *
 * Auth: requiere `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  const admin = crearClienteAdmin()

  // Snapshot del estado antes del delete para auditoría.
  const { data: anterior } = await admin
    .from('ajustes_concepto_periodo')
    .select('id, miembro_id, concepto_id, periodo_inicio, periodo_fin, tipo_ajuste, monto_override, motivo')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  const { error, count } = await admin
    .from('ajustes_concepto_periodo')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) {
    console.error('[ajustes-periodo] DELETE error:', error)
    return NextResponse.json({ error: 'No se pudo eliminar el ajuste' }, { status: 500 })
  }
  if (count === 0) return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 })

  if (anterior) {
    await admin.from('auditoria_ajustes_concepto_periodo').insert({
      empresa_id: empresaId,
      ajuste_id: id,
      miembro_id: anterior.miembro_id,
      concepto_id: anterior.concepto_id,
      periodo_inicio: anterior.periodo_inicio,
      periodo_fin: anterior.periodo_fin,
      editado_por: user.id,
      accion: 'eliminar',
      estado_anterior: anterior,
      estado_nuevo: null,
    })
  }

  return NextResponse.json({ ok: true })
}
