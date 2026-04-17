import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
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

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'ordenes_trabajo', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Obtener datos de la orden para el chatter
    const { data: orden } = await admin
      .from('ordenes_trabajo')
      .select('numero')
      .eq('id', ordenId)
      .single()

    if (body.accion === 'completar') {
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

    // Edición general
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

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'ordenes_trabajo', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

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
