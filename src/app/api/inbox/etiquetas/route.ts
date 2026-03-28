import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/etiquetas — Listar etiquetas de correo de la empresa.
 * POST /api/inbox/etiquetas — Crear nueva etiqueta.
 * PATCH /api/inbox/etiquetas?id=xxx — Actualizar etiqueta.
 * DELETE /api/inbox/etiquetas?id=xxx — Eliminar etiqueta.
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { data } = await supabase
      .from('etiquetas_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })

    return NextResponse.json({ etiquetas: data || [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { nombre, color, icono } = await request.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('etiquetas_correo')
      .insert({
        empresa_id: empresaId,
        nombre: nombre.trim(),
        color: color || '#6b7280',
        icono: icono || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etiqueta: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const body = await request.json()
    const cambios: Record<string, unknown> = {}
    if (body.nombre !== undefined) cambios.nombre = body.nombre
    if (body.color !== undefined) cambios.color = body.color
    if (body.icono !== undefined) cambios.icono = body.icono
    if (body.orden !== undefined) cambios.orden = body.orden

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('etiquetas_correo')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etiqueta: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    await admin
      .from('etiquetas_correo')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
