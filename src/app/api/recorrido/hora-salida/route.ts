import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { calcularHorariosRecorrido, type ParadaHorario } from '@/lib/recorrido-horarios'

/**
 * PATCH /api/recorrido/hora-salida
 *
 * Setea (o limpia) la hora de salida planificada de un recorrido y, en cascada,
 * recalcula los horarios estimados de cada parada según el orden actual y los
 * tiempos de viaje + tiempo en sitio. El cálculo se persiste como `fecha_programada`
 * en cada visita con `tiene_hora_especifica = true`.
 *
 * Body:
 *   recorrido_id: string
 *   hora_salida: string ISO (timestamp) | null  // null = limpiar
 *
 * Permiso: recorrido.registrar (visitador) o visitas.asignar (coordinador).
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'registrar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json() as {
      recorrido_id?: string
      hora_salida?: string | null
    }
    if (!body.recorrido_id) {
      return NextResponse.json({ error: 'Falta recorrido_id' }, { status: 400 })
    }
    const horaSalidaISO = body.hora_salida ?? null

    const admin = crearClienteAdmin()

    // Cargar recorrido + paradas con sus visitas
    const { data: recorrido, error: errR } = await admin
      .from('recorridos')
      .select('id, empresa_id, fecha, asignado_a, origen_lat, origen_lng')
      .eq('id', body.recorrido_id)
      .eq('empresa_id', empresaId)
      .single()
    if (errR || !recorrido) return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })

    // Si solo limpian la hora, actualizamos el campo y salimos sin tocar visitas.
    if (!horaSalidaISO) {
      const { error: errUpd } = await admin
        .from('recorridos')
        .update({ hora_salida_planificada: null, actualizado_en: new Date().toISOString() })
        .eq('id', recorrido.id)
      if (errUpd) return NextResponse.json({ error: 'Error al limpiar hora de salida' }, { status: 500 })
      return NextResponse.json({ ok: true, hora_salida: null, visitas_actualizadas: 0 })
    }

    const horaSalida = new Date(horaSalidaISO)
    if (isNaN(horaSalida.getTime())) {
      return NextResponse.json({ error: 'hora_salida inválida' }, { status: 400 })
    }

    // Cargar paradas en orden
    const { data: paradas, error: errP } = await admin
      .from('recorrido_paradas')
      .select('id, orden, tipo, visita_id, distancia_km, duracion_viaje_min, estado, direccion_lat, direccion_lng, visita:visitas(id, estado, direccion_lat, direccion_lng, duracion_estimada_min, fecha_inicio, fecha_llegada, fecha_completada)')
      .eq('recorrido_id', recorrido.id)
      .order('orden', { ascending: true })
    if (errP) return NextResponse.json({ error: 'Error al leer paradas' }, { status: 500 })

    type ParadaRow = {
      id: string
      orden: number
      tipo: string
      visita_id: string | null
      distancia_km: number | null
      duracion_viaje_min: number | null
      estado: string | null
      direccion_lat: number | null
      direccion_lng: number | null
      visita: {
        id: string
        estado: string | null
        direccion_lat: number | null
        direccion_lng: number | null
        duracion_estimada_min: number | null
        fecha_inicio: string | null
        fecha_llegada: string | null
        fecha_completada: string | null
      } | null
    }
    const paradasArr = (paradas || []) as unknown as ParadaRow[]

    // Mapear al shape que espera calcularHorariosRecorrido
    const paradasParaHelper: ParadaHorario[] = paradasArr.map((p): ParadaHorario => {
      if (p.tipo === 'parada') {
        return {
          tipo: 'parada',
          estado: p.estado || 'programada',
          lat: p.direccion_lat,
          lng: p.direccion_lng,
          distancia_km: p.distancia_km,
          duracion_viaje_min: p.duracion_viaje_min,
        }
      }
      const v = p.visita
      return {
        tipo: 'visita',
        estado: v?.estado || 'programada',
        lat: v?.direccion_lat ?? null,
        lng: v?.direccion_lng ?? null,
        distancia_km: p.distancia_km,
        duracion_viaje_min: p.duracion_viaje_min,
        duracion_estimada_min: v?.duracion_estimada_min ?? null,
        fecha_inicio: v?.fecha_inicio ?? null,
        fecha_llegada: v?.fecha_llegada ?? null,
        fecha_completada: v?.fecha_completada ?? null,
      }
    })

    const origen = (recorrido.origen_lat != null && recorrido.origen_lng != null)
      ? { lat: recorrido.origen_lat, lng: recorrido.origen_lng }
      : null
    const horarios = calcularHorariosRecorrido(paradasParaHelper, horaSalida, origen)

    // Reprogramar cada visita (no las paradas genéricas) con la hora estimada
    // de llegada calculada. Solo tocamos visitas no completadas — las completadas
    // ya tienen su hora real y no se deben mover.
    let visitasActualizadas = 0
    const updates: Promise<unknown>[] = []
    for (let i = 0; i < paradasArr.length; i++) {
      const p = paradasArr[i]
      if (p.tipo !== 'visita' || !p.visita_id || !p.visita) continue
      const estado = p.visita.estado || 'programada'
      if (['completada', 'cancelada'].includes(estado)) continue
      const llegada = horarios.porParada[i]?.llegada
      if (!llegada) continue
      visitasActualizadas++
      // Supabase query builders solo se ejecutan al hacer await/then, así que
      // los envolvemos en una Promise resuelta para meterlos en Promise.all.
      updates.push(
        Promise.resolve(
          admin
            .from('visitas')
            .update({
              fecha_programada: llegada.toISOString(),
              tiene_hora_especifica: true,
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', p.visita_id)
            .then(r => r)
        )
      )
    }

    // Actualizar recorrido + ejecutar updates en paralelo
    const ahora = new Date().toISOString()
    const [{ error: errUpdRec }] = await Promise.all([
      admin
        .from('recorridos')
        .update({ hora_salida_planificada: horaSalidaISO, actualizado_en: ahora })
        .eq('id', recorrido.id),
      ...updates,
    ])
    if (errUpdRec) return NextResponse.json({ error: 'Error al guardar hora de salida' }, { status: 500 })

    return NextResponse.json({
      ok: true,
      hora_salida: horaSalidaISO,
      visitas_actualizadas: visitasActualizadas,
    })
  } catch (err) {
    console.error('Error en PATCH /api/recorrido/hora-salida:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
