import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'
import { TRANSICIONES_ESTADO_OT, ETIQUETAS_ESTADO_OT } from '@/tipos/orden-trabajo'
import type { EstadoOrdenTrabajo } from '@/tipos/orden-trabajo'

/**
 * GET /api/ordenes/[id] — Detalle completo de una orden de trabajo.
 * Incluye: líneas, historial, progreso de actividades vinculadas.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Orden + lineas + historial + asignados + tareas en paralelo
    const [ordenRes, lineasRes, historialRes, asignadosRes, tareasRes] = await Promise.all([
      admin
        .from('ordenes_trabajo')
        .select('*')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single(),
      admin
        .from('lineas_orden_trabajo')
        .select('*')
        .eq('orden_trabajo_id', id)
        .order('orden', { ascending: true }),
      admin
        .from('orden_trabajo_historial')
        .select('*')
        .eq('orden_trabajo_id', id)
        .order('fecha', { ascending: true }),
      admin
        .from('asignados_orden_trabajo')
        .select('*')
        .eq('orden_trabajo_id', id)
        .order('es_cabecilla', { ascending: false }),
      // Tareas de la orden (tabla propia)
      admin
        .from('tareas_orden')
        .select('id, estado, fecha_vencimiento')
        .eq('orden_trabajo_id', id)
        .eq('empresa_id', empresaId),
    ])

    if (ordenRes.error || !ordenRes.data) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // Calcular progreso de tareas
    const tareas = tareasRes.data || []
    const totalActividades = tareas.length
    const completadas = tareas.filter((t: { estado: string }) => t.estado === 'completada').length

    // Calcular fechas desde tareas con fecha
    const fechasActividades = tareas
      .map((t: { fecha_vencimiento: string | null }) => t.fecha_vencimiento)
      .filter(Boolean)
      .sort() as string[]

    const fechaInicioCalculada = fechasActividades[0] || null
    // Fecha fin estimada: solo si hay 2+ actividades con fechas DIFERENTES
    const fechasUnicas = [...new Set(fechasActividades.map(f => f.slice(0, 10)))]
    const fechaFinCalculada = fechasUnicas.length > 1
      ? fechasActividades[fechasActividades.length - 1]
      : null

    // Auto-actualizar fechas si cambiaron (fire-and-forget)
    const actualizarFechas: Record<string, unknown> = {}
    if (fechaInicioCalculada && fechaInicioCalculada !== ordenRes.data.fecha_inicio) {
      actualizarFechas.fecha_inicio = fechaInicioCalculada
      ordenRes.data.fecha_inicio = fechaInicioCalculada
    }
    if (fechaFinCalculada && fechaFinCalculada !== ordenRes.data.fecha_fin_estimada) {
      actualizarFechas.fecha_fin_estimada = fechaFinCalculada
      ordenRes.data.fecha_fin_estimada = fechaFinCalculada
    }
    if (Object.keys(actualizarFechas).length > 0) {
      admin
        .from('ordenes_trabajo')
        .update({ ...actualizarFechas, actualizado_en: new Date().toISOString() })
        .eq('id', id)
        .then(() => {})
    }

    // Registrar en recientes (fire-and-forget)
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'orden_trabajo',
      entidadId: id,
      titulo: `OT #${ordenRes.data.numero} — ${ordenRes.data.titulo}`,
      subtitulo: ordenRes.data.estado,
      accion: 'visto',
    })

    return NextResponse.json({
      orden: ordenRes.data,
      lineas: lineasRes.data || [],
      historial: historialRes.data || [],
      asignados: asignadosRes.data || [],
      progreso: {
        total_actividades: totalActividades,
        completadas,
        porcentaje: totalActividades > 0 ? Math.round((completadas / totalActividades) * 100) : 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/ordenes/[id] — Actualizar campos o cambiar estado.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Verificar que la orden existe + obtener asignados actuales
    const [{ data: ordenActual }, { data: asignadosActuales }] = await Promise.all([
      admin
        .from('ordenes_trabajo')
        .select('id, estado, numero, titulo, publicada, creado_por')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single(),
      admin
        .from('asignados_orden_trabajo')
        .select('usuario_id, es_cabecilla')
        .eq('orden_trabajo_id', id),
    ])

    if (!ordenActual) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const { data: perfil } = await admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single()
    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null

    // Verificar si es cabecilla, admin o creador para cambios de estado
    const esCabecilla = (asignadosActuales || []).some(a => a.usuario_id === user.id && a.es_cabecilla)
    const rol = user.app_metadata?.rol
    const esAdmin = ['propietario', 'administrador', 'gerente'].includes(rol) || user.app_metadata?.es_superadmin

    const esCreador = ordenActual.creado_por === user.id
    const puedeGestionar = esAdmin || esCabecilla || esCreador

    // Si hay cambio de estado, validar transición + permisos
    if (body.estado && body.estado !== ordenActual.estado) {
      if (!puedeGestionar) {
        return NextResponse.json({ error: 'Solo un responsable, creador o administrador puede cambiar el estado' }, { status: 403 })
      }
      const estadoActual = ordenActual.estado as EstadoOrdenTrabajo
      const nuevoEstado = body.estado as EstadoOrdenTrabajo
      const transicionesValidas = TRANSICIONES_ESTADO_OT[estadoActual]

      if (!transicionesValidas?.includes(nuevoEstado)) {
        return NextResponse.json({
          error: `No se puede cambiar de "${estadoActual}" a "${nuevoEstado}"`,
        }, { status: 400 })
      }

      // Permisos especiales para completar
      if (nuevoEstado === 'completada') {
        const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'ordenes_trabajo', 'completar')
        if (!permitido) return NextResponse.json({ error: 'Sin permiso para completar órdenes' }, { status: 403 })
      }

      // Registrar historial + chatter
      await Promise.all([
        admin.from('orden_trabajo_historial').insert({
          orden_trabajo_id: id,
          empresa_id: empresaId,
          estado: nuevoEstado,
          usuario_id: user.id,
          usuario_nombre: nombreUsuario,
          notas: body.notas_estado || null,
        }),
        registrarChatter({
          empresaId,
          entidadTipo: 'orden_trabajo',
          entidadId: id,
          contenido: `Cambió el estado a ${ETIQUETAS_ESTADO_OT[nuevoEstado]}`,
          autorId: user.id,
          autorNombre: nombreUsuario || 'Usuario',
          metadata: {
            accion: 'cambio_estado',
            estado_anterior: estadoActual,
            estado_nuevo: nuevoEstado,
          },
        }),
      ])

      // Si se completa, set fecha_fin_real
      if (nuevoEstado === 'completada') {
        body.fecha_fin_real = new Date().toISOString()
      }
      // Si se reabre, limpiar fecha_fin_real
      if (estadoActual === 'completada' && nuevoEstado !== 'completada') {
        body.fecha_fin_real = null
      }
    }

    // Campos actualizables
    const camposPermitidos = [
      'estado', 'prioridad', 'titulo', 'descripcion', 'notas', 'publicada',
      'asignado_a', 'asignado_nombre',
      'fecha_inicio', 'fecha_fin_estimada', 'fecha_fin_real',
      'contacto_id', 'contacto_nombre', 'contacto_telefono',
      'contacto_correo', 'contacto_direccion', 'contacto_whatsapp',
      'atencion_contacto_id', 'atencion_nombre', 'atencion_telefono', 'atencion_correo',
    ]

    const actualizacion: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreUsuario,
      actualizado_en: new Date().toISOString(),
    }

    for (const campo of camposPermitidos) {
      if (campo in body) actualizacion[campo] = body[campo]
    }

    // Si se envían asignados, reemplazar la tabla de asignados
    const asignadosNuevos: { usuario_id: string; usuario_nombre: string; es_cabecilla: boolean }[] | undefined = body.asignados

    // Publicar/despublicar: registrar en chatter
    if ('publicada' in body && body.publicada !== ordenActual.publicada) {
      if (!puedeGestionar) {
        return NextResponse.json({ error: 'Solo un responsable, creador o administrador puede publicar/despublicar' }, { status: 403 })
      }
      await registrarChatter({
        empresaId,
        entidadTipo: 'orden_trabajo',
        entidadId: id,
        contenido: body.publicada ? 'Publicó la orden de trabajo' : 'Despublicó la orden de trabajo (modo borrador)',
        autorId: user.id,
        autorNombre: nombreUsuario || 'Usuario',
        metadata: { accion: body.publicada ? 'publicar' : 'despublicar' },
      })
    }

    // Actualizar asignados si se enviaron
    if (asignadosNuevos !== undefined) {
      // Denormalizar cabecilla en la tabla principal
      const cabecilla = asignadosNuevos.find(a => a.es_cabecilla) || asignadosNuevos[0] || null
      actualizacion.asignado_a = cabecilla?.usuario_id || null
      actualizacion.asignado_nombre = cabecilla?.usuario_nombre || null

      // Reemplazar asignados: borrar existentes e insertar nuevos
      await admin.from('asignados_orden_trabajo').delete().eq('orden_trabajo_id', id)
      if (asignadosNuevos.length > 0) {
        await admin.from('asignados_orden_trabajo').insert(
          asignadosNuevos.map(a => ({
            orden_trabajo_id: id,
            empresa_id: empresaId,
            usuario_id: a.usuario_id,
            usuario_nombre: a.usuario_nombre,
            es_cabecilla: a.es_cabecilla,
          }))
        )
      }
    }

    const { data: ordenActualizada, error } = await admin
      .from('ordenes_trabajo')
      .update(actualizacion)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json(ordenActualizada)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/ordenes/[id] — Soft delete (papelera).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'ordenes_trabajo', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar estado actual de papelera
    const { data: orden } = await admin
      .from('ordenes_trabajo')
      .select('id, en_papelera, numero')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    if (orden.en_papelera) {
      // Ya en papelera → eliminación permanente
      await admin.from('ordenes_trabajo').delete().eq('id', id)
      return NextResponse.json({ eliminado: true })
    }

    // Mover a papelera
    await admin
      .from('ordenes_trabajo')
      .update({ en_papelera: true, papelera_en: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ en_papelera: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
