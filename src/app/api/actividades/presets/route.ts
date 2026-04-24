import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * Presets del modal "Nueva actividad" — hasta 3 por (usuario, empresa, tipo_id).
 * A diferencia de presets_visitas, acá el alcance se segmenta por tipo: cada tipo
 * (Llamada, Reunión, Nota, etc.) tiene sus propios presets y su propio favorito.
 */

const MAX_PRESETS = 3

/**
 * GET /api/actividades/presets?tipo_id=XXX — Listar presets del usuario para ese tipo.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const tipoId = searchParams.get('tipo_id')
    if (!tipoId) return NextResponse.json({ error: 'tipo_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('presets_actividades')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .eq('tipo_id', tipoId)
      .order('orden', { ascending: true })

    if (error) return NextResponse.json({ error: 'Error al listar presets' }, { status: 500 })
    return NextResponse.json({ presets: data || [], max: MAX_PRESETS })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/actividades/presets — Crear preset nuevo para un tipo.
 * Body: { nombre, tipo_id, valores, aplicar_al_abrir? }
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    const tipoId = typeof body.tipo_id === 'string' ? body.tipo_id : ''
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    if (nombre.length > 40) return NextResponse.json({ error: 'Nombre muy largo' }, { status: 400 })
    if (!tipoId) return NextResponse.json({ error: 'tipo_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Validar que el tipo pertenece a la empresa del usuario (evita filtrar por tipos ajenos)
    const { data: tipo } = await admin
      .from('tipos_actividad')
      .select('id')
      .eq('id', tipoId)
      .eq('empresa_id', empresaId)
      .single()
    if (!tipo) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    // Tope de 3 presets por (usuario, empresa, tipo)
    const { count } = await admin
      .from('presets_actividades')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .eq('tipo_id', tipoId)

    if ((count ?? 0) >= MAX_PRESETS) {
      return NextResponse.json({ error: `Máximo ${MAX_PRESETS} presets por tipo` }, { status: 400 })
    }

    // Si pidió aplicar_al_abrir, desmarcar el resto del mismo tipo primero
    if (body.aplicar_al_abrir) {
      await admin
        .from('presets_actividades')
        .update({ aplicar_al_abrir: false })
        .eq('empresa_id', empresaId)
        .eq('usuario_id', user.id)
        .eq('tipo_id', tipoId)
    }

    const { data, error } = await admin
      .from('presets_actividades')
      .insert({
        empresa_id: empresaId,
        usuario_id: user.id,
        tipo_id: tipoId,
        nombre,
        orden: count ?? 0,
        valores: body.valores || {},
        aplicar_al_abrir: !!body.aplicar_al_abrir,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un preset con ese nombre para este tipo' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear preset' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/actividades/presets?id=XXX — Actualizar preset.
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

    // Validar pertenencia y capturar tipo_id (para desmarcar favorito solo dentro del mismo tipo)
    const { data: existente } = await admin
      .from('presets_actividades')
      .select('id, tipo_id')
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
        // Desmarcar favorito previo del MISMO tipo
        await admin
          .from('presets_actividades')
          .update({ aplicar_al_abrir: false })
          .eq('empresa_id', empresaId)
          .eq('usuario_id', user.id)
          .eq('tipo_id', existente.tipo_id)
          .neq('id', id)
      }
      campos.aplicar_al_abrir = !!body.aplicar_al_abrir
    }

    const { data, error } = await admin
      .from('presets_actividades')
      .update(campos)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un preset con ese nombre para este tipo' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al actualizar preset' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/actividades/presets?id=XXX — Eliminar preset del usuario.
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
      .from('presets_actividades')
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
