import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'

/**
 * PATCH /api/recorrido/publicar — Publicar o despublicar un recorrido.
 * Body: { recorrido_id, publicar: boolean }
 * Publicar: cambia estado de 'borrador' a 'pendiente' (visible para el visitador).
 * Despublicar: cambia estado de 'pendiente' a 'borrador' (oculto para el visitador).
 * Se usa en: ModalRecorrido (coordinador).
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'reordenar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { recorrido_id, publicar } = body as { recorrido_id: string; publicar: boolean }

    if (!recorrido_id) {
      return NextResponse.json({ error: 'recorrido_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el recorrido pertenece a la empresa
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, estado, asignado_a, fecha')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Solo cambiar entre borrador <-> pendiente
    // No tocar recorridos en_curso o completados
    if (publicar && recorrido.estado !== 'borrador') {
      return NextResponse.json({ error: 'Solo se pueden publicar recorridos en borrador' }, { status: 400 })
    }
    if (!publicar && recorrido.estado !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden despublicar recorridos pendientes' }, { status: 400 })
    }

    const nuevoEstado = publicar ? 'pendiente' : 'borrador'

    const { error } = await admin
      .from('recorridos')
      .update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() })
      .eq('id', recorrido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar', detalle: error.message }, { status: 500 })
    }

    // Notificar al visitador cuando se publica su recorrido
    if (publicar && recorrido.asignado_a !== user.id) {
      crearNotificacion({
        empresaId,
        usuarioId: recorrido.asignado_a,
        tipo: 'sistema',
        titulo: 'Tenés un recorrido asignado',
        cuerpo: `Se publicó tu recorrido para el ${recorrido.fecha}. Revisá las paradas.`,
        icono: 'route',
        url: '/recorrido',
        referenciaTipo: 'recorrido',
        referenciaId: recorrido_id,
      }).catch(() => { /* no bloquear */ })
    }

    return NextResponse.json({ ok: true, estado: nuevoEstado })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/publicar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
