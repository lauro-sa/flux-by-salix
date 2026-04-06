import { crearClienteServidor } from '@/lib/supabase/servidor'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * POST /api/inbox/conversaciones/snooze — Pospone una conversación.
 * Establece snooze_hasta, snooze_nota y snooze_por sin cambiar el estado.
 * La conversación sigue 'abierta' pero se filtra a la pestaña de pospuestos.
 *
 * Body: { conversacion_id: string, snooze_hasta: string (ISO), nota?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.user_metadata?.empresa_id || user.app_metadata?.empresa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    const body = await request.json()
    const { conversacion_id, snooze_hasta, nota } = body as {
      conversacion_id?: string
      snooze_hasta?: string
      nota?: string
    }

    if (!conversacion_id || !snooze_hasta) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: conversacion_id, snooze_hasta' },
        { status: 400 },
      )
    }

    // Validar que la fecha sea futura
    const fechaSnooze = new Date(snooze_hasta)
    if (isNaN(fechaSnooze.getTime())) {
      return NextResponse.json({ error: 'snooze_hasta no es una fecha válida' }, { status: 400 })
    }
    if (fechaSnooze <= new Date()) {
      return NextResponse.json(
        { error: 'snooze_hasta debe ser una fecha futura' },
        { status: 400 },
      )
    }

    // Actualizar la conversación (RLS filtra por empresa_id automáticamente)
    const { data, error } = await supabase
      .from('conversaciones')
      .update({
        snooze_hasta: fechaSnooze.toISOString(),
        snooze_nota: nota || null,
        snooze_por: user.id,
      })
      .eq('id', conversacion_id)
      .select()
      .single()

    if (error) {
      console.error('Error al posponer conversación:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Error en POST /api/inbox/conversaciones/snooze:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/conversaciones/snooze?conversacion_id=xxx — Despierta una conversación.
 * Limpia snooze_hasta, snooze_nota y snooze_por, devolviéndola al inbox normal.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.user_metadata?.empresa_id || user.app_metadata?.empresa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    const conversacionId = request.nextUrl.searchParams.get('conversacion_id')
    if (!conversacionId) {
      return NextResponse.json(
        { error: 'Falta parámetro: conversacion_id' },
        { status: 400 },
      )
    }

    // Limpiar campos de snooze (RLS filtra por empresa_id automáticamente)
    const { data, error } = await supabase
      .from('conversaciones')
      .update({
        snooze_hasta: null,
        snooze_nota: null,
        snooze_por: null,
      })
      .eq('id', conversacionId)
      .select()
      .single()

    if (error) {
      console.error('Error al despertar conversación:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Error en DELETE /api/inbox/conversaciones/snooze:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
