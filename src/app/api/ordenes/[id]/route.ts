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

    // Orden + lineas + historial + actividades vinculadas en paralelo
    const [ordenRes, lineasRes, historialRes, actividadesRes] = await Promise.all([
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
      // Actividades vinculadas a esta OT (por vinculo_ids)
      admin
        .from('actividades')
        .select('id, estado_clave')
        .eq('empresa_id', empresaId)
        .contains('vinculo_ids', [id])
        .eq('en_papelera', false),
    ])

    if (ordenRes.error || !ordenRes.data) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // Calcular progreso de actividades
    const actividades = actividadesRes.data || []
    const totalActividades = actividades.length
    const completadas = actividades.filter(a => a.estado_clave === 'completada').length

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

    // Verificar que la orden existe
    const { data: ordenActual } = await admin
      .from('ordenes_trabajo')
      .select('id, estado, numero, titulo')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!ordenActual) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const { data: perfil } = await admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single()
    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null

    // Si hay cambio de estado, validar transición
    if (body.estado && body.estado !== ordenActual.estado) {
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
      'estado', 'prioridad', 'titulo', 'descripcion', 'notas',
      'asignado_a', 'asignado_nombre',
      'fecha_inicio', 'fecha_fin_estimada', 'fecha_fin_real',
      'contacto_id', 'contacto_nombre', 'contacto_telefono',
      'contacto_correo', 'contacto_direccion', 'contacto_whatsapp',
    ]

    const actualizacion: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreUsuario,
      actualizado_en: new Date().toISOString(),
    }

    for (const campo of camposPermitidos) {
      if (campo in body) actualizacion[campo] = body[campo]
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
