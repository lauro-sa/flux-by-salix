/**
 * POST /api/nominas/reabrir-periodo
 *
 * Reversa: pasa liquidaciones_periodo de 'cerrado' a 'abierto'. Requiere
 * motivo porque está rompiendo un cierre contable previo (queda en
 * cambios_estado para auditoría).
 *
 * Body: { periodo_inicio, periodo_fin, motivo: string }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface Payload {
  periodo_inicio: string
  periodo_fin: string
  motivo: string
}

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Payload
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { periodo_inicio, periodo_fin, motivo } = body
  if (!periodo_inicio || !periodo_fin) {
    return NextResponse.json({ error: 'periodo_inicio y periodo_fin requeridos' }, { status: 400 })
  }
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'Motivo requerido para reabrir' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data: existente } = await admin
    .from('liquidaciones_periodo')
    .select('id, estado_clave')
    .eq('empresa_id', empresaId)
    .eq('periodo_inicio', periodo_inicio)
    .eq('periodo_fin', periodo_fin)
    .maybeSingle()

  if (!existente) {
    return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  }
  if (existente.estado_clave === 'abierto') {
    return NextResponse.json({ ok: true, ya_estaba: true })
  }

  const { error: errUpd } = await admin
    .from('liquidaciones_periodo')
    .update({
      estado_clave: 'abierto',
      motivo_reapertura: motivo,
      actualizado_por: user.id,
    })
    .eq('id', existente.id)

  if (errUpd) {
    return NextResponse.json({ error: 'No se pudo reabrir el período', detalle: errUpd }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
