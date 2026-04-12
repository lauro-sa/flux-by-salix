import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * DELETE /api/recorrido/quitar-parada — Quita una parada del recorrido.
 * Body: { recorrido_id, parada_id }
 * No elimina la visita, solo la quita del recorrido.
 * Se usa en: ModalRecorrido (coordinador quita una visita del recorrido).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { recorrido_id, parada_id } = body as { recorrido_id: string; parada_id: string }

    if (!recorrido_id || !parada_id) {
      return NextResponse.json({ error: 'recorrido_id y parada_id requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar recorrido
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, total_visitas')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Eliminar la parada
    const { error } = await admin
      .from('recorrido_paradas')
      .delete()
      .eq('id', parada_id)
      .eq('recorrido_id', recorrido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al quitar parada', detalle: error.message }, { status: 500 })
    }

    // Actualizar total y reordenar las restantes
    const { data: restantes } = await admin
      .from('recorrido_paradas')
      .select('id, orden')
      .eq('recorrido_id', recorrido_id)
      .order('orden', { ascending: true })

    // Renumerar
    if (restantes) {
      await Promise.all(
        restantes.map((p, i) =>
          admin.from('recorrido_paradas').update({ orden: i + 1 }).eq('id', p.id)
        )
      )
    }

    await admin
      .from('recorridos')
      .update({
        total_visitas: restantes?.length || 0,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', recorrido_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en DELETE /api/recorrido/quitar-parada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
