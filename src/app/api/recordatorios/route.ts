import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * API de Recordatorios — CRUD para recordatorios personales.
 * GET — listar recordatorios del usuario (activos, completados, o todos).
 * POST — crear un nuevo recordatorio.
 * PATCH — marcar como completado o editar.
 * DELETE — eliminar un recordatorio.
 */

async function obtenerUsuario() {
  const guard = await requerirPermisoAPI('actividades', 'ver_propio')
  if ('respuesta' in guard) return { respuesta: guard.respuesta as NextResponse }
  return { user: guard.user, empresaId: guard.empresaId }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await obtenerUsuario()
    if ('respuesta' in auth) return auth.respuesta

    const params = request.nextUrl.searchParams
    const estado = params.get('estado') || 'activos' // 'activos' | 'completados' | 'todos'
    const limite = Math.min(parseInt(params.get('limite') || '50'), 100)

    const admin = crearClienteAdmin()

    let query = admin
      .from('recordatorios')
      .select('*', { count: 'exact' })
      .eq('empresa_id', auth.empresaId)
      .eq('asignado_a', auth.user.id)

    if (estado === 'activos') query = query.eq('completado', false)
    else if (estado === 'completados') query = query.eq('completado', true)

    const { data, count, error } = await query
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true, nullsFirst: false })
      .limit(limite)

    if (error) throw error

    return NextResponse.json({
      recordatorios: data || [],
      total: count || 0,
    })
  } catch (err) {
    console.error('Error al obtener recordatorios:', err)
    return NextResponse.json({ error: 'Error al obtener recordatorios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await obtenerUsuario()
    if ('respuesta' in auth) return auth.respuesta

    const body = await request.json()
    const { titulo, descripcion, fecha, hora, repetir, recurrencia, alerta_modal, notificar_whatsapp, asignado_a } = body

    if (!titulo || !fecha) {
      return NextResponse.json({ error: 'Título y fecha son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('recordatorios')
      .insert({
        empresa_id: auth.empresaId,
        creado_por: auth.user.id,
        asignado_a: asignado_a || auth.user.id,
        titulo,
        descripcion: descripcion || null,
        fecha,
        hora: hora || null,
        repetir: repetir || 'ninguno',
        recurrencia: recurrencia || null,
        alerta_modal: alerta_modal || false,
        notificar_whatsapp: notificar_whatsapp !== false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ recordatorio: data })
  } catch (err) {
    console.error('Error al crear recordatorio:', err)
    return NextResponse.json({ error: 'Error al crear recordatorio' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await obtenerUsuario()
    if ('respuesta' in auth) return auth.respuesta

    const body = await request.json()
    const { id, ...campos } = body

    if (!id) return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })

    const admin = crearClienteAdmin()

    /* Si se marca como completado, agregar timestamp */
    if (campos.completado === true) {
      campos.completado_en = new Date().toISOString()
    } else if (campos.completado === false) {
      campos.completado_en = null
    }

    const { error } = await admin
      .from('recordatorios')
      .update(campos)
      .eq('id', id)
      .eq('empresa_id', auth.empresaId)
      .eq('asignado_a', auth.user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al actualizar recordatorio:', err)
    return NextResponse.json({ error: 'Error al actualizar recordatorio' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await obtenerUsuario()
    if ('respuesta' in auth) return auth.respuesta

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('recordatorios')
      .delete()
      .eq('id', body.id)
      .eq('empresa_id', auth.empresaId)
      .eq('asignado_a', auth.user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar recordatorio:', err)
    return NextResponse.json({ error: 'Error al eliminar recordatorio' }, { status: 500 })
  }
}
