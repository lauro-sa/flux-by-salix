import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/actividades/[id] — Obtener una actividad por ID.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('actividades')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PUT /api/actividades/[id] — Actualizar una actividad.
 * Soporta acciones especiales via body.accion: 'completar', 'posponer', 'reactivar'
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'actividades', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar actividades' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Acciones especiales
    if (body.accion === 'completar') {
      const { data: estadoCompletada } = await admin
        .from('estados_actividad')
        .select('id, clave')
        .eq('empresa_id', empresaId)
        .eq('grupo', 'completado')
        .order('orden')
        .limit(1)
        .single()

      if (!estadoCompletada) return NextResponse.json({ error: 'Estado completado no encontrado' }, { status: 500 })

      const { data, error } = await admin
        .from('actividades')
        .update({
          estado_id: estadoCompletada.id,
          estado_clave: estadoCompletada.clave,
          fecha_completada: new Date().toISOString(),
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al completar' }, { status: 500 })

      // Registrar en chatter de cada entidad vinculada
      const vinculos = (data.vinculos || []) as { tipo: string; id: string }[]
      for (const vinculo of vinculos) {
        registrarChatter({
          empresaId,
          entidadTipo: vinculo.tipo,
          entidadId: vinculo.id,
          contenido: `Actividad completada: ${data.titulo}`,
          autorId: user.id,
          autorNombre: nombreEditor,
          metadata: {
            accion: 'actividad_completada',
            actividad_id: data.id,
            titulo: data.titulo,
          },
        })
      }

      // Notificar al creador que su actividad fue completada (si fue otro quien la completó)
      if (data.creado_por && data.creado_por !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.creado_por,
          tipo: 'actividad_asignada',
          titulo: `✅ ${nombreEditor} completó una actividad`,
          cuerpo: data.titulo,
          icono: 'CheckCircle',
          color: '#46a758',
          url: '/actividades',
          referenciaTipo: 'actividad',
          referenciaId: data.id,
        })
      }

      return NextResponse.json(data)
    }

    if (body.accion === 'posponer') {
      const dias = body.dias || 1
      const actividad = await admin.from('actividades').select('fecha_vencimiento').eq('id', id).single()
      const base = actividad.data?.fecha_vencimiento ? new Date(actividad.data.fecha_vencimiento) : new Date()
      base.setDate(base.getDate() + dias)

      const { data, error } = await admin
        .from('actividades')
        .update({
          fecha_vencimiento: base.toISOString(),
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al posponer' }, { status: 500 })
      return NextResponse.json(data)
    }

    if (body.accion === 'reactivar') {
      const { data: estadoPendiente } = await admin
        .from('estados_actividad')
        .select('id, clave')
        .eq('empresa_id', empresaId)
        .eq('clave', 'pendiente')
        .single()

      if (!estadoPendiente) return NextResponse.json({ error: 'Estado pendiente no encontrado' }, { status: 500 })

      const { data, error } = await admin
        .from('actividades')
        .update({
          estado_id: estadoPendiente.id,
          estado_clave: estadoPendiente.clave,
          fecha_completada: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
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
    if (body.asignado_a !== undefined) {
      campos.asignado_a = body.asignado_a
      campos.asignado_nombre = body.asignado_nombre || null
    }
    if (body.checklist !== undefined) campos.checklist = body.checklist
    if (body.vinculos !== undefined) {
      campos.vinculos = body.vinculos
      campos.vinculo_ids = body.vinculos.map((v: { id: string }) => v.id)
    }

    // Cambio de tipo
    if (body.tipo_id !== undefined) {
      const { data: tipoNuevo } = await admin.from('tipos_actividad').select('clave').eq('id', body.tipo_id).single()
      if (tipoNuevo) {
        campos.tipo_id = body.tipo_id
        campos.tipo_clave = tipoNuevo.clave
      }
    }

    // Cambio de estado
    if (body.estado_id !== undefined) {
      const { data: estadoNuevo } = await admin.from('estados_actividad').select('clave, grupo').eq('id', body.estado_id).single()
      if (estadoNuevo) {
        campos.estado_id = body.estado_id
        campos.estado_clave = estadoNuevo.clave
        if (estadoNuevo.grupo === 'completado') {
          campos.fecha_completada = new Date().toISOString()
        }
      }
    }

    const { data, error } = await admin
      .from('actividades')
      .update(campos)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al editar actividad:', error)
      return NextResponse.json({ error: 'Error al editar' }, { status: 500 })
    }

    // Notificar si se reasignó a otro usuario
    if (body.asignado_a && body.asignado_a !== user.id) {
      crearNotificacion({
        empresaId,
        usuarioId: body.asignado_a,
        tipo: 'actividad_asignada',
        titulo: `📋 ${nombreEditor} te asignó una actividad`,
        cuerpo: data.titulo,
        icono: 'ClipboardList',
        color: '#3b82f6',
        url: '/actividades',
        referenciaTipo: 'actividad',
        referenciaId: data.id,
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/actividades/[id] — Enviar actividad a papelera (soft delete).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'actividades', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar actividades' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('actividades')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
