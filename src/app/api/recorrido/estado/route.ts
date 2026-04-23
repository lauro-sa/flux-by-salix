import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { recalcularContadoresRecorrido } from '@/lib/recorrido-contadores'

type EstadoParada = 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'

const ETIQUETAS_ESTADO: Record<string, string> = {
  programada: 'Programada',
  en_camino: 'En camino',
  en_sitio: 'En sitio',
  completada: 'Completada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
}

/**
 * PATCH /api/recorrido/estado — Cambiar estado de una parada del recorrido.
 *
 * Body (dos formas soportadas):
 *   - { parada_id, estado, registro_lat?, registro_lng?, registro_precision_m? }  ← recomendado (tipo-agnóstico)
 *   - { visita_id, estado, ... }  ← legacy (siempre asume parada tipo 'visita')
 *
 * Comportamiento:
 *   - Si la parada es tipo 'visita', actualiza `visitas.estado` + timestamps y
 *     registra un chatter en la visita.
 *   - Si la parada es tipo 'parada' (genérica), actualiza `recorrido_paradas.estado`
 *     + fechas. No hay chatter porque no hay contacto asociado.
 *   - Siempre recalcula contadores y estado del recorrido (pendiente/en_curso/completado).
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'registrar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json() as {
      parada_id?: string
      visita_id?: string
      estado: EstadoParada
      registro_lat?: number
      registro_lng?: number
      registro_precision_m?: number
    }

    const { parada_id, visita_id, estado, registro_lat, registro_lng, registro_precision_m } = body

    if (!estado || (!parada_id && !visita_id)) {
      return NextResponse.json({ error: 'Faltan datos requeridos (parada_id o visita_id, estado)' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Buscar la parada: por parada_id si vino, sino por visita_id (legacy)
    let paradaFiltro = admin
      .from('recorrido_paradas')
      .select('id, tipo, visita_id, recorrido_id, estado, titulo')

    paradaFiltro = parada_id
      ? paradaFiltro.eq('id', parada_id)
      : paradaFiltro.eq('visita_id', visita_id!)

    const { data: parada } = await paradaFiltro.maybeSingle()

    if (!parada) {
      return NextResponse.json({ error: 'Parada no encontrada' }, { status: 404 })
    }

    // Verificar que el recorrido pertenece a la empresa
    const { data: recorridoOwner } = await admin
      .from('recorridos')
      .select('id')
      .eq('id', parada.recorrido_id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!recorridoOwner) {
      return NextResponse.json({ error: 'Recorrido no pertenece a la empresa' }, { status: 403 })
    }

    const ahora = new Date().toISOString()

    if (parada.tipo === 'visita') {
      // ── Flujo legacy: actualizar la visita asociada ──
      const visitaId = parada.visita_id!
      const { data: visita } = await admin
        .from('visitas')
        .select('id, estado, fecha_llegada')
        .eq('id', visitaId)
        .eq('empresa_id', empresaId)
        .single()

      if (!visita) {
        return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
      }

      const estadoAnterior = visita.estado
      const actualizacion: Record<string, unknown> = {
        estado,
        actualizado_en: ahora,
      }

      if (estado === 'programada') {
        actualizacion.fecha_inicio = null
        actualizacion.fecha_llegada = null
        actualizacion.fecha_completada = null
        actualizacion.registro_lat = null
        actualizacion.registro_lng = null
        actualizacion.registro_precision_m = null
        actualizacion.duracion_real_min = null
      }
      if (estado === 'en_camino') actualizacion.fecha_inicio = ahora
      if (estado === 'en_sitio') {
        actualizacion.fecha_llegada = ahora
        if (registro_lat != null) actualizacion.registro_lat = registro_lat
        if (registro_lng != null) actualizacion.registro_lng = registro_lng
        if (registro_precision_m != null) actualizacion.registro_precision_m = registro_precision_m
      }
      if (estado === 'completada') {
        actualizacion.fecha_completada = ahora
        if (visita.fecha_llegada) {
          const llegada = new Date(visita.fecha_llegada).getTime()
          const fin = new Date(ahora).getTime()
          actualizacion.duracion_real_min = Math.round((fin - llegada) / 60000)
        }
      }

      const { error: errorVisita } = await admin
        .from('visitas')
        .update(actualizacion)
        .eq('id', visitaId)

      if (errorVisita) {
        return NextResponse.json({ error: 'Error al actualizar visita', detalle: errorVisita.message }, { status: 500 })
      }

      // Chatter en la visita
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido, correo')
        .eq('id', user.id)
        .single()
      const nombreAutor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

      await registrarChatter({
        empresaId,
        entidadTipo: 'visita',
        entidadId: visitaId,
        contenido: `Estado cambiado de ${ETIQUETAS_ESTADO[estadoAnterior] || estadoAnterior} a ${ETIQUETAS_ESTADO[estado] || estado}`,
        autorId: user.id,
        autorNombre: nombreAutor,
        metadata: {
          accion: 'estado_cambiado',
          estado_anterior: estadoAnterior,
          estado_nuevo: estado,
        },
      })
    } else {
      // ── Flujo parada genérica: solo tocar recorrido_paradas ──
      const actualizacion: Record<string, unknown> = {
        estado,
      }
      if (estado === 'programada') {
        actualizacion.fecha_inicio = null
        actualizacion.fecha_llegada = null
        actualizacion.fecha_completada = null
      }
      if (estado === 'en_camino') actualizacion.fecha_inicio = ahora
      if (estado === 'en_sitio') actualizacion.fecha_llegada = ahora
      if (estado === 'completada') actualizacion.fecha_completada = ahora

      const { error: errorParada } = await admin
        .from('recorrido_paradas')
        .update(actualizacion)
        .eq('id', parada.id)

      if (errorParada) {
        return NextResponse.json({ error: 'Error al actualizar parada', detalle: errorParada.message }, { status: 500 })
      }
    }

    // Recalcular contadores del recorrido
    await recalcularContadoresRecorrido(admin, parada.recorrido_id)

    return NextResponse.json({ ok: true, estado, tipo: parada.tipo })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/estado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
