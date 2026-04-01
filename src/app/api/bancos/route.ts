import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/bancos — Lista los bancos de la empresa activa.
 * Se usa en: perfil de usuario (info bancaria), SelectCreable de bancos.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('bancos')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/bancos — Crea un banco nuevo para la empresa activa.
 * Body: { nombre: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const raw = (body.nombre || '').trim()
    if (!raw) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    // Formatear: capitalizar cada palabra
    const nombre = raw.replace(/\b\w/g, (c: string) => c.toUpperCase())

    const admin = crearClienteAdmin()

    // Si ya existe (case-insensitive), devolver el existente
    const { data: existente } = await admin
      .from('bancos')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .ilike('nombre', nombre)
      .maybeSingle()

    if (existente) return NextResponse.json(existente)

    const { data, error } = await admin
      .from('bancos')
      .insert({ empresa_id: empresaId, nombre })
      .select('id, nombre')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/bancos — Elimina un banco y limpia info_bancaria de quienes lo usaban.
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const id = body.id
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Obtener nombre antes de eliminar para limpiar info_bancaria
    const { data: banco } = await admin
      .from('bancos')
      .select('nombre')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!banco) return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })

    // Limpiar el campo banco en todos los info_bancaria que lo usaban
    await admin
      .from('info_bancaria')
      .update({ banco: null })
      .ilike('banco', banco.nombre)

    // Eliminar el banco del catálogo
    const { error } = await admin
      .from('bancos')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/bancos — Renombra un banco y actualiza info_bancaria de quienes lo usaban.
 * Body: { id: string, nombre: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { id, nombre: nombreRaw } = body
    if (!id || !nombreRaw?.trim()) return NextResponse.json({ error: 'ID y nombre requeridos' }, { status: 400 })

    const nombre = nombreRaw.trim().replace(/\b\w/g, (c: string) => c.toUpperCase())

    const admin = crearClienteAdmin()

    // Obtener nombre anterior para actualizar info_bancaria
    const { data: bancoAnterior } = await admin
      .from('bancos')
      .select('nombre')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!bancoAnterior) return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })

    // Renombrar en el catálogo
    const { data, error } = await admin
      .from('bancos')
      .update({ nombre })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select('id, nombre')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Actualizar en todos los info_bancaria que usaban el nombre anterior
    if (bancoAnterior.nombre !== nombre) {
      await admin
        .from('info_bancaria')
        .update({ banco: nombre })
        .ilike('banco', bancoAnterior.nombre)
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
