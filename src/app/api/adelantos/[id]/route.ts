import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/adelantos/[id] — Detalle de un adelanto con cuotas.
 * PATCH /api/adelantos/[id] — Cancelar adelanto (marca cuotas pendientes como canceladas).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { id } = await params
    const admin = crearClienteAdmin()

    const { data: adelanto, error } = await admin
      .from('adelantos_nomina')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !adelanto) return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 })

    const { data: cuotas } = await admin
      .from('adelantos_cuotas')
      .select('*')
      .eq('adelanto_id', id)
      .order('numero_cuota', { ascending: true })

    return NextResponse.json({ adelanto, cuotas: cuotas || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { estado } = body as { estado: string }

    if (estado !== 'cancelado') {
      return NextResponse.json({ error: 'Solo se puede cancelar un adelanto' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que existe y pertenece a la empresa
    const { data: adelanto } = await admin
      .from('adelantos_nomina')
      .select('id, estado')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!adelanto) return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 })
    if ((adelanto as Record<string, unknown>).estado === 'pagado') {
      return NextResponse.json({ error: 'No se puede cancelar un adelanto ya pagado' }, { status: 400 })
    }

    // Cancelar cuotas pendientes
    await admin
      .from('adelantos_cuotas')
      .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
      .eq('adelanto_id', id)
      .eq('estado', 'pendiente')

    // Marcar adelanto como cancelado
    await admin
      .from('adelantos_nomina')
      .update({
        estado: 'cancelado',
        saldo_pendiente: '0',
        eliminado: true,
        eliminado_en: new Date().toISOString(),
        eliminado_por: user.id,
      })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
