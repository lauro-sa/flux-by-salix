import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// Roles con poder de gestión sobre la OT (edición aunque no sean creador/cabecilla).
const ROLES_ADMIN_OT = ['propietario', 'administrador', 'gerente']

/**
 * GET /api/ordenes/[id]/tareas — Listar tareas de una orden de trabajo.
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

    const { data, error } = await admin
      .from('tareas_orden')
      .select('*')
      .eq('orden_trabajo_id', id)
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })
      .order('creado_en', { ascending: true })

    if (error) {
      console.error('Error al listar tareas de orden:', error)
      return NextResponse.json({ error: 'Error al listar tareas' }, { status: 500 })
    }

    return NextResponse.json({ tareas: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/ordenes/[id]/tareas — Crear una tarea en una orden de trabajo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    // Verificar que la orden existe y que el usuario puede gestionar
    const [{ data: orden }, { data: asignadosOT }] = await Promise.all([
      admin
        .from('ordenes_trabajo')
        .select('id, numero, creado_por, publicada')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single(),
      admin
        .from('asignados_orden_trabajo')
        .select('usuario_id, es_cabecilla')
        .eq('orden_trabajo_id', id),
    ])

    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const rol = user.app_metadata?.rol
    const esAdmin = ROLES_ADMIN_OT.includes(rol) || Boolean(user.app_metadata?.es_superadmin)
    const esCreador = orden.creado_por === user.id
    const esCabecilla = (asignadosOT || []).some(a => a.usuario_id === user.id && a.es_cabecilla)
    const puedeGestionar = esAdmin || esCreador || esCabecilla

    if (!puedeGestionar) {
      return NextResponse.json(
        { error: 'Solo responsable, creador o administrador pueden crear tareas' },
        { status: 403 }
      )
    }

    // OT publicada = congelada. Para agregar tareas, despublicar primero.
    if (orden.publicada) {
      return NextResponse.json(
        { error: 'La orden está publicada: despublicala para agregar tareas' },
        { status: 409 }
      )
    }

    // Obtener nombre del creador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Construir asignados
    const asignados = Array.isArray(body.asignados) ? body.asignados : []
    const asignadosIds = asignados.map((a: { id?: string; usuario_id?: string }) => a.id || a.usuario_id).filter(Boolean)

    const { data, error } = await admin
      .from('tareas_orden')
      .insert({
        empresa_id: empresaId,
        orden_trabajo_id: id,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion || null,
        estado: 'pendiente',
        prioridad: body.prioridad || 'normal',
        fecha_vencimiento: body.fecha_vencimiento || null,
        asignados,
        asignados_ids: asignadosIds,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) {
      console.error('Error al crear tarea de orden:', error)
      return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
