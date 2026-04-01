import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * API CRUD para vistas guardadas.
 * GET    /api/vistas?modulo=xxx — Listar vistas del usuario para un módulo
 * POST   /api/vistas            — Crear nueva vista
 * PATCH  /api/vistas            — Sobrescribir estado o marcar predefinida
 * DELETE /api/vistas            — Eliminar vista
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const modulo = request.nextUrl.searchParams.get('modulo')
    if (!modulo) return NextResponse.json({ error: 'modulo requerido' }, { status: 400 })

    /* Obtener empresa_id del JWT */
    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json([], { status: 200 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('vistas_guardadas')
      .select('id, nombre, predefinida, estado')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('modulo', modulo)
      .order('creado_en', { ascending: true })

    if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 })

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { modulo, nombre, estado } = await request.json()
    if (!modulo || !nombre || !estado) {
      return NextResponse.json({ error: 'modulo, nombre y estado requeridos' }, { status: 400 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('vistas_guardadas')
      .insert({
        usuario_id: user.id,
        empresa_id: empresaId,
        modulo,
        nombre,
        predefinida: false,
        estado,
      })
      .select('id, nombre, predefinida, estado')
      .single()

    if (error) return NextResponse.json({ error: 'Error al crear' }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id, estado, predefinida, modulo } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    /* Si se marca predefinida, desmarcar las demás del mismo módulo */
    if (predefinida === true && modulo) {
      await admin
        .from('vistas_guardadas')
        .update({ predefinida: false })
        .eq('usuario_id', user.id)
        .eq('modulo', modulo)
    }

    /* Construir campos a actualizar */
    const campos: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (estado !== undefined) campos.estado = estado
    if (predefinida !== undefined) campos.predefinida = predefinida

    const { data, error } = await admin
      .from('vistas_guardadas')
      .update(campos)
      .eq('id', id)
      .eq('usuario_id', user.id)
      .select('id, nombre, predefinida, estado')
      .single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { error } = await admin
      .from('vistas_guardadas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
