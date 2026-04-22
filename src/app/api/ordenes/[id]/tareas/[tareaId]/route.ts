import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'

/**
 * PUT /api/ordenes/[id]/tareas/[tareaId] — Acciones sobre una tarea de OT.
 * Soporta: completar, cancelar, reactivar, edición general.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const { id: ordenId, tareaId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor + orden + asignados + tarea actual
    const [{ data: perfil }, { data: orden }, { data: asignadosOT }, { data: tareaActual }] = await Promise.all([
      admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single(),
      admin.from('ordenes_trabajo')
        .select('numero, publicada, creado_por')
        .eq('id', ordenId)
        .eq('empresa_id', empresaId)
        .single(),
      admin.from('asignados_orden_trabajo')
        .select('usuario_id, es_cabecilla')
        .eq('orden_trabajo_id', ordenId),
      admin.from('tareas_orden')
        .select('asignados_ids')
        .eq('id', tareaId)
        .eq('empresa_id', empresaId)
        .single(),
    ])

    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    if (!tareaActual) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    // ── Permisos: puede gestionar si tiene editar del módulo o es creador/cabecilla ──
    const datosActor = await obtenerDatosMiembro(user.id, empresaId)
    const puedeEditarTodas = datosActor ? verificarPermiso(datosActor, 'ordenes_trabajo', 'editar') : false
    const esCreador = orden.creado_por === user.id
    const asigs = asignadosOT || []
    const esCabecilla = asigs.some(a => a.usuario_id === user.id && a.es_cabecilla)
    const esAsignadoOT = asigs.some(a => a.usuario_id === user.id)
    const puedeGestionar = puedeEditarTodas || esCreador || esCabecilla

    // Borrador: solo gestores
    if (!orden.publicada && !puedeGestionar) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // Determinar si el usuario puede marcar esta tarea como hecha (aunque no sea gestor).
    // Regla: publicada + está asignado a la tarea; o publicada + asignado a la OT sin asignados específicos.
    const tareaAsignados = (tareaActual.asignados_ids as string[] | null) || []
    const esAsignadoTarea = tareaAsignados.includes(user.id)
    const puedeMarcar =
      puedeGestionar ||
      (orden.publicada && esAsignadoTarea) ||
      (orden.publicada && esAsignadoOT && tareaAsignados.length === 0)

    if (body.accion === 'completar') {
      if (!puedeMarcar) {
        return NextResponse.json({ error: 'Sin permiso para completar esta tarea' }, { status: 403 })
      }
      const { data, error } = await admin
        .from('tareas_orden')
        .update({
          estado: 'completada',
          fecha_completada: new Date().toISOString(),
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', tareaId)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al completar' }, { status: 500 })

      // Registrar en chatter de la OT
      registrarChatter({
        empresaId,
        entidadTipo: 'orden_trabajo',
        entidadId: ordenId,
        contenido: `Tarea completada: ${data.titulo}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'tarea_completada', tarea_id: data.id, titulo: data.titulo },
      })

      return NextResponse.json(data)
    }

    if (body.accion === 'cancelar') {
      if (!puedeGestionar) {
        return NextResponse.json({ error: 'Solo responsable, creador o administrador pueden cancelar tareas' }, { status: 403 })
      }
      if (orden.publicada) {
        return NextResponse.json({ error: 'La orden está publicada: despublicala para cancelar tareas' }, { status: 409 })
      }
      const { data, error } = await admin
        .from('tareas_orden')
        .update({
          estado: 'cancelada',
          fecha_completada: new Date().toISOString(),
          notas_cancelacion: body.notas || null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', tareaId)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'orden_trabajo',
        entidadId: ordenId,
        contenido: `Tarea cancelada: ${data.titulo}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'tarea_cancelada', tarea_id: data.id, titulo: data.titulo },
      })

      return NextResponse.json(data)
    }

    if (body.accion === 'reactivar') {
      if (!puedeMarcar) {
        return NextResponse.json({ error: 'Sin permiso para reabrir esta tarea' }, { status: 403 })
      }
      const { data, error } = await admin
        .from('tareas_orden')
        .update({
          estado: 'pendiente',
          fecha_completada: null,
          notas_cancelacion: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', tareaId)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al reactivar' }, { status: 500 })

      return NextResponse.json(data)
    }

    // Edición general (título, descripción, prioridad, fecha, asignados): solo gestores
    if (!puedeGestionar) {
      return NextResponse.json({ error: 'Solo responsable, creador o administrador pueden editar tareas' }, { status: 403 })
    }
    if (orden.publicada) {
      return NextResponse.json({ error: 'La orden está publicada: despublicala para editar tareas' }, { status: 409 })
    }
    const campos: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreEditor,
      actualizado_en: new Date().toISOString(),
    }

    if (body.titulo !== undefined) campos.titulo = body.titulo.trim()
    if (body.descripcion !== undefined) campos.descripcion = body.descripcion
    if (body.prioridad !== undefined) campos.prioridad = body.prioridad
    if (body.fecha_vencimiento !== undefined) campos.fecha_vencimiento = body.fecha_vencimiento
    if (body.asignados !== undefined) {
      campos.asignados = body.asignados
      campos.asignados_ids = Array.isArray(body.asignados)
        ? body.asignados.map((a: { id?: string; usuario_id?: string }) => a.id || a.usuario_id).filter(Boolean)
        : []
    }

    const { data, error } = await admin
      .from('tareas_orden')
      .update(campos)
      .eq('id', tareaId)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Error al editar tarea' }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/ordenes/[id]/tareas/[tareaId] — Eliminar una tarea permanentemente.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const { id: ordenId, tareaId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Solo gestores (admin/creador/cabecilla) pueden eliminar tareas
    const [{ data: orden }, { data: asignadosOT }] = await Promise.all([
      admin.from('ordenes_trabajo').select('creado_por, publicada').eq('id', ordenId).eq('empresa_id', empresaId).single(),
      admin.from('asignados_orden_trabajo').select('usuario_id, es_cabecilla').eq('orden_trabajo_id', ordenId),
    ])
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const datosActor = await obtenerDatosMiembro(user.id, empresaId)
    const puedeEliminarTodas = datosActor ? verificarPermiso(datosActor, 'ordenes_trabajo', 'eliminar') : false
    const esCreador = orden.creado_por === user.id
    const esCabecilla = (asignadosOT || []).some(a => a.usuario_id === user.id && a.es_cabecilla)
    if (!(puedeEliminarTodas || esCreador || esCabecilla)) {
      return NextResponse.json({ error: 'Sin permiso para eliminar tareas' }, { status: 403 })
    }
    if (orden.publicada) {
      return NextResponse.json({ error: 'La orden está publicada: despublicala para eliminar tareas' }, { status: 409 })
    }

    const { error } = await admin
      .from('tareas_orden')
      .delete()
      .eq('id', tareaId)
      .eq('orden_trabajo_id', ordenId)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
