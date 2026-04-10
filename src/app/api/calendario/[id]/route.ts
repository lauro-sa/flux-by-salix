import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'

type Contexto = { params: Promise<{ id: string }> }

/**
 * GET /api/calendario/[id] — Obtener un evento por ID.
 */
export async function GET(_request: NextRequest, contexto: Contexto) {
  try {
    const { id } = await contexto.params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('eventos_calendario')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    // Verificar permisos de visibilidad
    const esPropio = data.creado_por === user.id ||
      (data.asignado_ids as string[])?.includes(user.id)

    if (!esPropio) {
      const { permitido: verTodos } = await obtenerYVerificarPermiso(user.id, empresaId, 'calendario', 'ver_todos')
      if (!verTodos) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

      if (data.visibilidad === 'privada') {
        return NextResponse.json({ error: 'Evento privado' }, { status: 403 })
      }
    }

    // Registrar en historial de recientes (fire-and-forget)
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'evento',
      entidadId: id,
      titulo: data.titulo || 'Evento',
      subtitulo: data.todo_el_dia ? 'Todo el día' : undefined,
      accion: 'visto',
    })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PUT /api/calendario/[id] — Actualizar un evento.
 * Soporta acciones especiales: mover, cancelar.
 */
export async function PUT(request: NextRequest, contexto: Contexto) {
  try {
    const { id } = await contexto.params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'calendario', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar eventos' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Acción especial: mover (drag-and-drop)
    if (body.accion === 'mover') {
      const { data, error } = await admin
        .from('eventos_calendario')
        .update({
          fecha_inicio: body.fecha_inicio,
          fecha_fin: body.fecha_fin,
          todo_el_dia: body.todo_el_dia,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al mover evento' }, { status: 500 })
      return NextResponse.json(data)
    }

    // Acción especial: cancelar
    if (body.accion === 'cancelar') {
      const { data, error } = await admin
        .from('eventos_calendario')
        .update({
          estado: 'cancelado',
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al cancelar evento' }, { status: 500 })
      return NextResponse.json(data)
    }

    // Actualización general
    const campos: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreEditor,
      actualizado_en: new Date().toISOString(),
    }

    if (body.titulo !== undefined) campos.titulo = body.titulo.trim()
    if (body.descripcion !== undefined) campos.descripcion = body.descripcion
    if (body.ubicacion !== undefined) campos.ubicacion = body.ubicacion
    if (body.fecha_inicio !== undefined) campos.fecha_inicio = body.fecha_inicio
    if (body.fecha_fin !== undefined) campos.fecha_fin = body.fecha_fin
    if (body.todo_el_dia !== undefined) campos.todo_el_dia = body.todo_el_dia
    if (body.visibilidad !== undefined) campos.visibilidad = body.visibilidad
    if (body.estado !== undefined) campos.estado = body.estado
    if (body.notas !== undefined) campos.notas = body.notas
    if (body.color !== undefined) campos.color = body.color
    if (body.recurrencia !== undefined) campos.recurrencia = body.recurrencia

    // Tipo
    if (body.tipo_id !== undefined) {
      campos.tipo_id = body.tipo_id
      if (body.tipo_id) {
        const { data: tipo } = await admin
          .from('tipos_evento_calendario')
          .select('clave')
          .eq('id', body.tipo_id)
          .single()
        campos.tipo_clave = tipo?.clave || null
      } else {
        campos.tipo_clave = null
      }
    }

    // Asignados
    if (body.asignados !== undefined) {
      const asignados = Array.isArray(body.asignados) ? body.asignados : []
      campos.asignados = asignados
      campos.asignado_ids = asignados.map((a: { id: string }) => a.id)
    }

    // Vínculos
    if (body.vinculos !== undefined) {
      const vinculos = Array.isArray(body.vinculos) ? body.vinculos : []
      campos.vinculos = vinculos
      campos.vinculo_ids = vinculos.map((v: { id: string }) => v.id)
    }

    const { data, error } = await admin
      .from('eventos_calendario')
      .update(campos)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al actualizar evento:', error)
      return NextResponse.json({ error: 'Error al actualizar evento' }, { status: 500 })
    }

    // Registrar edición en recientes (fire-and-forget)
    if (data) {
      registrarReciente({
        empresaId,
        usuarioId: user.id,
        tipoEntidad: 'evento',
        entidadId: id,
        titulo: data.titulo || 'Evento',
        subtitulo: data.todo_el_dia ? 'Todo el día' : undefined,
        accion: 'editado',
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/calendario/[id] — Eliminar evento (soft delete).
 */
export async function DELETE(_request: NextRequest, contexto: Contexto) {
  try {
    const { id } = await contexto.params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'calendario', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar eventos' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('eventos_calendario')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
