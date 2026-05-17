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
  const { empresaId } = guard

  const admin = crearClienteAdmin()
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
  return NextResponse.json({ ok: true })
}
