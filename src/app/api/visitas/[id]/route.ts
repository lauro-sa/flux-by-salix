import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'
import { obtenerTiposVisita, sincronizarRegistrosVinculados, eliminarRegistrosVinculados } from '@/lib/visitas-sync'

/**
 * GET /api/visitas/[id] — Obtener una visita por ID.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('visitas')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })

    // Registrar en recientes (fire-and-forget)
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'visita',
      entidadId: id,
      titulo: data.contacto_nombre || 'Visita',
      subtitulo: data.estado || undefined,
      accion: 'visto',
    })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/visitas/[id] — Actualizar una visita.
 * Soporta acciones especiales via body.accion: 'en_camino', 'en_sitio', 'completar', 'cancelar', 'reprogramar'
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar visitas' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    const ahora = new Date().toISOString()

    // ── Acción: en_camino ──
    if (body.accion === 'en_camino') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'en_camino',
          fecha_inicio: ahora,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} está en camino a la visita`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'en_camino' },
      })

      return NextResponse.json(data)
    }

    // ── Acción: en_sitio ──
    if (body.accion === 'en_sitio') {
      const campos: Record<string, unknown> = {
        estado: 'en_sitio',
        fecha_llegada: ahora,
        editado_por: user.id,
        editado_por_nombre: nombreEditor,
        actualizado_en: ahora,
      }

      // Registrar geolocalización si la envía
      if (body.registro_lat !== undefined) {
        campos.registro_lat = body.registro_lat
        campos.registro_lng = body.registro_lng
        campos.registro_precision_m = body.registro_precision_m || null
      }

      const { data, error } = await admin
        .from('visitas')
        .update(campos)
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al registrar llegada' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} llegó al sitio`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'en_sitio' },
      })

      return NextResponse.json(data)
    }

    // ── Acción: completar ──
    if (body.accion === 'completar') {
      // Obtener la visita para calcular duración
      const { data: visitaActual } = await admin
        .from('visitas')
        .select('fecha_llegada, contacto_id, contacto_nombre')
        .eq('id', id)
        .single()

      let duracionReal: number | null = null
      if (visitaActual?.fecha_llegada) {
        duracionReal = Math.round((Date.now() - new Date(visitaActual.fecha_llegada).getTime()) / 60000)
      }

      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'completada',
          fecha_completada: ahora,
          duracion_real_min: duracionReal,
          resultado: body.resultado || null,
          checklist: body.checklist || undefined,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al completar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita completada${duracionReal ? ` (${duracionReal} min)` : ''}${body.resultado ? `: ${body.resultado}` : ''}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'completada' },
      })

      // Notificar al creador si fue otro quien completó
      if (data.creado_por && data.creado_por !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.creado_por,
          tipo: 'actividad_asignada',
          titulo: `✅ ${nombreEditor} completó la visita`,
          cuerpo: `${data.contacto_nombre}`,
          icono: 'CheckCircle',
          color: '#46a758',
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }

      // Marcar notificaciones previas como leídas
      admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('referencia_tipo', 'visita')
        .eq('referencia_id', data.id)
        .eq('empresa_id', empresaId)
        .eq('leida', false)
        .then(() => {})

      // Sincronizar actividad + evento
      const tiposComp = await obtenerTiposVisita(empresaId)
      if (tiposComp) {
        sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'completada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposComp)
      }

      registrarReciente({
        empresaId, usuarioId: user.id, tipoEntidad: 'visita', entidadId: id,
        titulo: data.contacto_nombre || 'Visita', subtitulo: 'completada', accion: 'editado',
      })

      return NextResponse.json(data)
    }

    // ── Acción: cancelar ──
    if (body.accion === 'cancelar') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'cancelada',
          resultado: body.resultado || null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita cancelada${body.resultado ? `: ${body.resultado}` : ''}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'cancelada' },
      })

      // Sincronizar actividad + evento (cancelar)
      const tiposCanc = await obtenerTiposVisita(empresaId)
      if (tiposCanc) {
        sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'cancelada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposCanc)
      }

      // Marcar notificaciones como leídas
      admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('referencia_tipo', 'visita')
        .eq('referencia_id', data.id)
        .eq('empresa_id', empresaId)
        .eq('leida', false)
        .then(() => {})

      return NextResponse.json(data)
    }

    // ── Acción: reprogramar ──
    if (body.accion === 'reprogramar') {
      if (!body.fecha_programada) {
        return NextResponse.json({ error: 'La nueva fecha es obligatoria' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'reprogramada',
          fecha_programada: body.fecha_programada,
          fecha_inicio: null,
          fecha_llegada: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al reprogramar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita reprogramada para ${new Date(body.fecha_programada).toLocaleDateString('es-AR')}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'reprogramada' },
      })

      return NextResponse.json(data)
    }

    // ── Acción: reactivar (volver a programada) ──
    if (body.accion === 'reactivar') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'programada',
          fecha_completada: null,
          fecha_inicio: null,
          fecha_llegada: null,
          duracion_real_min: null,
          resultado: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al reactivar' }, { status: 500 })
      return NextResponse.json(data)
    }

    // ── Edición general ──
    const campos: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreEditor,
      actualizado_en: ahora,
    }

    if (body.contacto_id !== undefined) {
      campos.contacto_id = body.contacto_id
      // Snapshot del nombre
      if (body.contacto_nombre) {
        campos.contacto_nombre = body.contacto_nombre
      } else {
        const { data: c } = await admin.from('contactos').select('nombre, empresa_nombre').eq('id', body.contacto_id).single()
        campos.contacto_nombre = c?.nombre || c?.empresa_nombre || 'Sin nombre'
      }
    }
    if (body.direccion_id !== undefined) {
      campos.direccion_id = body.direccion_id
      campos.direccion_texto = body.direccion_texto || null
      campos.direccion_lat = body.direccion_lat || null
      campos.direccion_lng = body.direccion_lng || null
    }
    if (body.asignado_a !== undefined) {
      campos.asignado_a = body.asignado_a
      campos.asignado_nombre = body.asignado_nombre || null
    }
    if (body.fecha_programada !== undefined) campos.fecha_programada = body.fecha_programada
    if (body.duracion_estimada_min !== undefined) campos.duracion_estimada_min = body.duracion_estimada_min
    if (body.motivo !== undefined) campos.motivo = body.motivo
    if (body.resultado !== undefined) campos.resultado = body.resultado
    if (body.notas !== undefined) campos.notas = body.notas
    if (body.prioridad !== undefined) campos.prioridad = body.prioridad
    if (body.checklist !== undefined) campos.checklist = body.checklist
    if (body.recibe_nombre !== undefined) campos.recibe_nombre = body.recibe_nombre
    if (body.recibe_telefono !== undefined) campos.recibe_telefono = body.recibe_telefono
    if (body.vinculos !== undefined) campos.vinculos = body.vinculos

    const { data, error } = await admin
      .from('visitas')
      .update(campos)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al editar visita:', error)
      return NextResponse.json({ error: 'Error al editar' }, { status: 500 })
    }

    // Sincronizar actividad + evento calendario
    const tipos = await obtenerTiposVisita(empresaId)
    if (tipos) {
      sincronizarRegistrosVinculados({
        id: data.id,
        empresa_id: empresaId,
        contacto_id: data.contacto_id,
        contacto_nombre: data.contacto_nombre,
        direccion_texto: data.direccion_texto,
        asignado_a: data.asignado_a,
        asignado_nombre: data.asignado_nombre,
        fecha_programada: data.fecha_programada,
        duracion_estimada_min: data.duracion_estimada_min || 30,
        estado: data.estado,
        motivo: data.motivo,
        prioridad: data.prioridad,
        actividad_id: data.actividad_id,
        creado_por: data.creado_por,
        creado_por_nombre: data.creado_por_nombre,
      }, tipos)
    }

    // Registrar en recientes
    registrarReciente({
      empresaId, usuarioId: user.id, tipoEntidad: 'visita', entidadId: id,
      titulo: data.contacto_nombre || 'Visita', subtitulo: data.estado, accion: 'editado',
    })

    // Notificar si se reasignó a otro usuario
    if (body.asignado_a && body.asignado_a !== user.id) {
      crearNotificacion({
        empresaId,
        usuarioId: body.asignado_a,
        tipo: 'actividad_asignada',
        titulo: `📍 ${nombreEditor} te asignó una visita`,
        cuerpo: `${data.contacto_nombre} · ${data.direccion_texto || 'Sin dirección'}`,
        icono: 'MapPin',
        color: '#3b82f6',
        url: '/visitas',
        referenciaTipo: 'visita',
        referenciaId: data.id,
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/visitas/[id] — Enviar visita a papelera (soft delete).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar visitas' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener la visita para saber su actividad_id antes de borrar
    const { data: visita } = await admin
      .from('visitas')
      .select('actividad_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    const { error } = await admin
      .from('visitas')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    // Eliminar actividad + evento calendario vinculados
    eliminarRegistrosVinculados(id, visita?.actividad_id || null)

    // Eliminar entradas del chatter vinculadas
    await admin.from('chatter')
      .delete()
      .eq('empresa_id', empresaId)
      .contains('metadata', { visita_id: id })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
