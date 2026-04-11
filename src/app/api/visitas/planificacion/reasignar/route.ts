import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarChatter } from '@/lib/chatter'

/**
 * PATCH /api/visitas/planificacion/reasignar — Reasignar visita a otro visitador.
 * Actualiza la visita y sincroniza los recorridos afectados.
 * Body: { visita_id, asignado_a: string | null, asignado_nombre: string | null }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()
    const { visita_id, asignado_a, asignado_nombre } = body as {
      visita_id: string
      asignado_a: string | null
      asignado_nombre: string | null
    }

    if (!visita_id) {
      return NextResponse.json({ error: 'visita_id es obligatorio' }, { status: 400 })
    }

    // Obtener la visita actual
    const { data: visita } = await admin
      .from('visitas')
      .select('*')
      .eq('id', visita_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) {
      return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
    }

    const asignadoAnterior = visita.asignado_a
    const fecha = visita.fecha_programada ? new Date(visita.fecha_programada).toISOString().split('T')[0] : null

    // Obtener nombre del coordinador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCoordinador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : ''

    // Actualizar la visita
    const { error: errorUpdate } = await admin
      .from('visitas')
      .update({
        asignado_a: asignado_a,
        asignado_nombre: asignado_nombre,
        editado_por: user.id,
        editado_por_nombre: nombreCoordinador,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', visita_id)
      .eq('empresa_id', empresaId)

    if (errorUpdate) {
      console.error('Error al reasignar visita:', errorUpdate)
      return NextResponse.json({ error: 'Error al reasignar' }, { status: 500 })
    }

    // Sincronizar recorridos si hay fecha
    if (fecha) {
      // Quitar la parada del recorrido anterior (si existía)
      if (asignadoAnterior) {
        const { data: recAnterior } = await admin
          .from('recorridos')
          .select('id, total_visitas')
          .eq('empresa_id', empresaId)
          .eq('asignado_a', asignadoAnterior)
          .eq('fecha', fecha)
          .single()

        if (recAnterior) {
          await admin
            .from('recorrido_paradas')
            .delete()
            .eq('recorrido_id', recAnterior.id)
            .eq('visita_id', visita_id)

          // Actualizar total del recorrido anterior
          await admin
            .from('recorridos')
            .update({ total_visitas: Math.max(0, (recAnterior.total_visitas || 1) - 1) })
            .eq('id', recAnterior.id)
        }
      }

      // Agregar parada al recorrido nuevo (si se asigna a alguien)
      if (asignado_a) {
        let { data: recNuevo } = await admin
          .from('recorridos')
          .select('id, total_visitas')
          .eq('empresa_id', empresaId)
          .eq('asignado_a', asignado_a)
          .eq('fecha', fecha)
          .single()

        // Crear recorrido si no existe
        if (!recNuevo) {
          const { data: nuevo } = await admin
            .from('recorridos')
            .insert({
              empresa_id: empresaId,
              asignado_a: asignado_a,
              asignado_nombre: asignado_nombre,
              fecha: fecha,
              estado: 'pendiente',
              total_visitas: 0,
              visitas_completadas: 0,
              creado_por: user.id,
            })
            .select('id, total_visitas')
            .single()
          recNuevo = nuevo
        }

        if (recNuevo) {
          // Obtener orden máximo actual
          const { data: ultimaParada } = await admin
            .from('recorrido_paradas')
            .select('orden')
            .eq('recorrido_id', recNuevo.id)
            .order('orden', { ascending: false })
            .limit(1)
            .single()

          const nuevoOrden = (ultimaParada?.orden || 0) + 1

          await admin
            .from('recorrido_paradas')
            .insert({
              recorrido_id: recNuevo.id,
              visita_id: visita_id,
              orden: nuevoOrden,
            })

          // Actualizar total del recorrido nuevo
          await admin
            .from('recorridos')
            .update({ total_visitas: (recNuevo.total_visitas || 0) + 1 })
            .eq('id', recNuevo.id)
        }
      }
    }

    // Registrar en chatter
    const mensajeReasignacion = asignado_a
      ? `Visita reasignada a ${asignado_nombre || 'otro visitador'}`
      : 'Visita desasignada'

    registrarChatter({
      empresaId,
      entidadTipo: 'contacto',
      entidadId: visita.contacto_id,
      contenido: mensajeReasignacion,
      autorId: user.id,
      autorNombre: nombreCoordinador,
      metadata: { accion: 'campo_editado', visita_id, detalles: { campo: 'asignado_a' } },
    })

    return NextResponse.json({
      ok: true,
      visita_id,
      asignado_a,
      asignado_nombre,
    })
  } catch (err) {
    console.error('Error en PATCH /api/visitas/planificacion/reasignar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
