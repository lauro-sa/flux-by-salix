import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { recalcularContadoresRecorrido } from '@/lib/recorrido-contadores'

/**
 * DELETE /api/recorrido/quitar-parada — Quita una parada (visita o genérica) del recorrido.
 * Body: { recorrido_id, parada_id }
 * No elimina la visita subyacente (si la tiene), solo la desvincula del recorrido.
 * Se usa en: ModalRecorrido y PaginaRecorrido.
 *
 * Autorización (igual que reordenar): dueño del recorrido necesita
 * `recorrido:reordenar`; cualquier otro miembro alcanza con `visitas:asignar`.
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

    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, asignado_a')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    if (recorrido.asignado_a === user.id) {
      const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'recorrido', 'reordenar')
      if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    } else {
      const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
      if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { error } = await admin
      .from('recorrido_paradas')
      .delete()
      .eq('id', parada_id)
      .eq('recorrido_id', recorrido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al quitar parada', detalle: error.message }, { status: 500 })
    }

    // Renumerar orden de las restantes
    const { data: restantes } = await admin
      .from('recorrido_paradas')
      .select('id, orden')
      .eq('recorrido_id', recorrido_id)
      .order('orden', { ascending: true })

    if (restantes && restantes.length > 0) {
      const reordenamientos = await Promise.all(
        restantes.map((p, i) =>
          p.orden === i + 1
            ? Promise.resolve({ error: null })
            : admin.from('recorrido_paradas').update({ orden: i + 1 }).eq('id', p.id)
        )
      )
      const erroresReorden = reordenamientos.filter(r => r.error)
      if (erroresReorden.length > 0) {
        console.error('Errores al renumerar paradas:', erroresReorden.map(e => e.error))
      }
    }

    // Recalcular contadores separados (visitas vs paradas) y estado del recorrido
    await recalcularContadoresRecorrido(admin, recorrido_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en DELETE /api/recorrido/quitar-parada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
