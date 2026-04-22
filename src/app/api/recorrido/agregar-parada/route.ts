import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'

/**
 * POST /api/recorrido/agregar-parada — Agrega una visita como nueva parada al final del recorrido.
 * Body: { recorrido_id, visita_id }
 * Calcula el orden automáticamente (último + 1).
 * Notifica al visitador si el recorrido está en curso.
 * Se usa en: ModalRecorrido (coordinador agrega visita al recorrido).
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'reordenar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { recorrido_id, visita_id } = body as { recorrido_id: string; visita_id: string }

    if (!recorrido_id || !visita_id) {
      return NextResponse.json({ error: 'recorrido_id y visita_id requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar recorrido
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, asignado_a, estado, total_visitas')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Verificar que la visita no esté ya en el recorrido
    const { data: existente } = await admin
      .from('recorrido_paradas')
      .select('id')
      .eq('recorrido_id', recorrido_id)
      .eq('visita_id', visita_id)
      .maybeSingle()

    if (existente) {
      return NextResponse.json({ error: 'La visita ya está en el recorrido' }, { status: 409 })
    }

    // Obtener el último orden
    const { data: ultimaParada } = await admin
      .from('recorrido_paradas')
      .select('orden')
      .eq('recorrido_id', recorrido_id)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nuevoOrden = (ultimaParada?.orden || 0) + 1

    // Insertar la parada
    const { error: errorInsert } = await admin
      .from('recorrido_paradas')
      .insert({
        recorrido_id,
        visita_id,
        orden: nuevoOrden,
      })

    if (errorInsert) {
      return NextResponse.json({ error: 'Error al agregar parada', detalle: errorInsert.message }, { status: 500 })
    }

    // Actualizar total_visitas del recorrido
    await admin
      .from('recorridos')
      .update({
        total_visitas: (recorrido.total_visitas || 0) + 1,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', recorrido_id)

    // Notificar al visitador solo si está en curso (ya lo está realizando)
    if (recorrido.asignado_a !== user.id && recorrido.estado === 'en_curso') {
      crearNotificacion({
        empresaId,
        usuarioId: recorrido.asignado_a,
        tipo: 'sistema',
        titulo: 'Se agregó una parada a tu recorrido',
        cuerpo: 'Revisá tu recorrido, se agregó una nueva visita.',
        icono: 'route',
        url: '/recorrido',
        referenciaTipo: 'recorrido',
        referenciaId: recorrido_id,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, orden: nuevoOrden })
  } catch (err) {
    console.error('Error en POST /api/recorrido/agregar-parada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
