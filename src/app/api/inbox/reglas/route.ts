import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta, crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * CRUD /api/inbox/reglas — Reglas automáticas de correo.
 * Condiciones: campo + operador + valor (AND entre condiciones)
 * Acciones: etiquetar, asignar, marcar_spam, archivar, responder
 */

export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const supabase = await crearClienteServidor()
    const { data } = await supabase
      .from('reglas_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })

    return NextResponse.json({ reglas: data || [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { nombre, condiciones, acciones, activa } = await request.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (!condiciones?.length) return NextResponse.json({ error: 'Al menos una condición requerida' }, { status: 400 })
    if (!acciones?.length) return NextResponse.json({ error: 'Al menos una acción requerida' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('reglas_correo')
      .insert({
        empresa_id: empresaId,
        nombre: nombre.trim(),
        condiciones,
        acciones,
        activa: activa ?? true,
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ regla: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const body = await request.json()
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (body.nombre !== undefined) cambios.nombre = body.nombre
    if (body.condiciones !== undefined) cambios.condiciones = body.condiciones
    if (body.acciones !== undefined) cambios.acciones = body.acciones
    if (body.activa !== undefined) cambios.activa = body.activa
    if (body.orden !== undefined) cambios.orden = body.orden

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('reglas_correo')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ regla: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    await admin.from('reglas_correo').delete().eq('id', id).eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
