import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'

type EstadoVisita = 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada'

const ETIQUETAS_ESTADO: Record<string, string> = {
  programada: 'Programada',
  en_camino: 'En camino',
  en_sitio: 'En sitio',
  completada: 'Completada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
}

/**
 * PATCH /api/recorrido/estado — Cambiar estado de una visita desde el recorrido.
 * Body: { visita_id, estado, registro_lat?, registro_lng?, registro_precision_m? }
 * Se usa en: TarjetaParada al tocar botón de acción.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { visita_id, estado, registro_lat, registro_lng, registro_precision_m } = body as {
      visita_id: string
      estado: EstadoVisita
      registro_lat?: number
      registro_lng?: number
      registro_precision_m?: number
    }

    if (!visita_id || !estado) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener visita actual
    const { data: visita } = await admin
      .from('visitas')
      .select('*')
      .eq('id', visita_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) {
      return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
    }

    const estadoAnterior = visita.estado
    const ahora = new Date().toISOString()

    // Preparar campos a actualizar según el nuevo estado
    const actualizacion: Record<string, unknown> = {
      estado,
      actualizado_en: ahora,
    }

    if (estado === 'programada') {
      // Reactivar — limpiar timestamps previos
      actualizacion.fecha_inicio = null
      actualizacion.fecha_llegada = null
      actualizacion.fecha_completada = null
      actualizacion.registro_lat = null
      actualizacion.registro_lng = null
      actualizacion.registro_precision_m = null
      actualizacion.duracion_real_min = null
    }

    if (estado === 'en_camino') {
      actualizacion.fecha_inicio = ahora
    }

    if (estado === 'en_sitio') {
      actualizacion.fecha_llegada = ahora
      if (registro_lat != null) actualizacion.registro_lat = registro_lat
      if (registro_lng != null) actualizacion.registro_lng = registro_lng
      if (registro_precision_m != null) actualizacion.registro_precision_m = registro_precision_m
    }

    if (estado === 'completada') {
      actualizacion.fecha_completada = ahora
      // Calcular duración real si hay fecha de llegada
      if (visita.fecha_llegada) {
        const llegada = new Date(visita.fecha_llegada).getTime()
        const fin = new Date(ahora).getTime()
        actualizacion.duracion_real_min = Math.round((fin - llegada) / 60000)
      }
    }

    // Actualizar visita
    const { error: errorVisita } = await admin
      .from('visitas')
      .update(actualizacion)
      .eq('id', visita_id)

    if (errorVisita) {
      return NextResponse.json({ error: 'Error al actualizar visita', detalle: errorVisita.message }, { status: 500 })
    }

    // Obtener el recorrido que contiene esta visita para actualizar contadores
    const { data: paradaDeVisita } = await admin
      .from('recorrido_paradas')
      .select('recorrido_id')
      .eq('visita_id', visita_id)
      .limit(1)
      .single()

    const recorridoId = paradaDeVisita?.recorrido_id
    const { data: recorrido } = recorridoId
      ? await admin
          .from('recorridos')
          .select('id, total_visitas')
          .eq('id', recorridoId)
          .eq('empresa_id', empresaId)
          .single()
      : { data: null }

    if (recorrido) {
      // Contar visitas completadas
      const { data: paradasRecorrido } = await admin
        .from('recorrido_paradas')
        .select('visita_id')
        .eq('recorrido_id', recorrido.id)

      if (paradasRecorrido) {
        const idsVisitas = paradasRecorrido.map(p => p.visita_id)
        const { count } = await admin
          .from('visitas')
          .select('id', { count: 'exact', head: true })
          .in('id', idsVisitas)
          .eq('estado', 'completada')

        const completadas = count || 0

        const actualizacionRecorrido: Record<string, unknown> = {
          visitas_completadas: completadas,
        }

        // Si todas completadas, marcar recorrido como completado
        if (completadas >= recorrido.total_visitas) {
          actualizacionRecorrido.estado = 'completado'
        } else if (estado === 'en_camino' || estado === 'en_sitio') {
          actualizacionRecorrido.estado = 'en_curso'
        }

        await admin
          .from('recorridos')
          .update(actualizacionRecorrido)
          .eq('id', recorrido.id)
      }
    }

    // Obtener nombre del usuario para el chatter
    const { data: miembro } = await admin
      .from('miembros')
      .select('nombre_completo')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    // Registrar cambio de estado en chatter
    await registrarChatter({
      empresaId,
      entidadTipo: 'visita',
      entidadId: visita_id,
      contenido: `Estado cambiado de ${ETIQUETAS_ESTADO[estadoAnterior] || estadoAnterior} a ${ETIQUETAS_ESTADO[estado] || estado}`,
      autorId: user.id,
      autorNombre: miembro?.nombre_completo || user.email || 'Usuario',
      metadata: {
        accion: 'estado_cambiado',
        estado_anterior: estadoAnterior,
        estado_nuevo: estado,
      },
    })

    return NextResponse.json({ ok: true, estado })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/estado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
