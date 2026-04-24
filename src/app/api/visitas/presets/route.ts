import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * Presets del modal "Nueva visita" — hasta 3 por usuario+empresa.
 * Cada usuario solo ve/edita los suyos (RLS por usuario_id).
 */

const MAX_PRESETS = 3

/**
 * GET /api/visitas/presets — Listar presets del usuario actual.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('presets_visitas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .order('orden', { ascending: true })

    if (error) return NextResponse.json({ error: 'Error al listar presets' }, { status: 500 })
    return NextResponse.json({ presets: data || [], max: MAX_PRESETS })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/visitas/presets — Crear preset nuevo.
 * Body: { nombre, valores, aplicar_al_abrir? }
 * Rechaza si el usuario ya tiene MAX_PRESETS.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (nombre.length > 40) return NextResponse.json({ error: 'Nombre muy largo' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Verificar límite de 3 presets
    const { count } = await admin
      .from('presets_visitas')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)

    if ((count ?? 0) >= MAX_PRESETS) {
      return NextResponse.json({ error: `Máximo ${MAX_PRESETS} presets por usuario` }, { status: 400 })
    }

    // Si pidió aplicar_al_abrir, desmarcar el resto primero
    if (body.aplicar_al_abrir) {
      await admin
        .from('presets_visitas')
        .update({ aplicar_al_abrir: false })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
    }

    const { data, error } = await admin
      .from('presets_visitas')
      .insert({
        empresa_id: empresaId,
        usuario_id: user.id,
        nombre,
        orden: count ?? 0,
        valores: body.valores || {},
        aplicar_al_abrir: !!body.aplicar_al_abrir,
      })
      .select()
      .single()

    if (error) {
      // Conflicto de nombre único
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un preset con ese nombre' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear preset' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/visitas/presets?id=XXX — Actualizar preset existente.
 * Body: { nombre?, valores?, aplicar_al_abrir? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Validar que el preset pertenece al usuario
    const { data: existente } = await admin
      .from('presets_visitas')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .single()
    if (!existente) return NextResponse.json({ error: 'Preset no encontrado' }, { status: 404 })

    const campos: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (typeof body.nombre === 'string') {
      const nombre = body.nombre.trim()
      if (!nombre) return NextResponse.json({ error: 'Nombre vacío' }, { status: 400 })
      if (nombre.length > 40) return NextResponse.json({ error: 'Nombre muy largo' }, { status: 400 })
      campos.nombre = nombre
    }
    if (body.valores !== undefined) campos.valores = body.valores
    if (body.aplicar_al_abrir !== undefined) {
      if (body.aplicar_al_abrir) {
        // Desmarcar los demás antes de marcar este
        await admin
          .from('presets_visitas')
          .update({ aplicar_al_abrir: false })
          .eq('empresa_id', empresaId)
          .eq('usuario_id', user.id)
          .neq('id', id)
      }
      campos.aplicar_al_abrir = !!body.aplicar_al_abrir
    }

    const { data, error } = await admin
      .from('presets_visitas')
      .update(campos)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un preset con ese nombre' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al actualizar preset' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/visitas/presets?id=XXX — Eliminar preset del usuario.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { error } = await admin
      .from('presets_visitas')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)

    if (error) return NextResponse.json({ error: 'Error al eliminar preset' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
