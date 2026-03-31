import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/chatter?entidad_tipo=presupuesto&entidad_id=xxx
 * Retorna todas las entradas de chatter para una entidad, ordenadas cronológicamente.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entidadTipo = searchParams.get('entidad_tipo')
    const entidadId = searchParams.get('entidad_id')

    if (!entidadTipo || !entidadId) {
      return NextResponse.json({ error: 'Faltan parámetros entidad_tipo y entidad_id' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('chatter')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('creado_en', { ascending: true })

    if (error) {
      console.error('Error al obtener chatter:', error)
      return NextResponse.json({ error: 'Error al obtener chatter' }, { status: 500 })
    }

    return NextResponse.json({ entradas: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/chatter — Crear una nueva entrada de chatter.
 * Body: { entidad_tipo, entidad_id, tipo?, contenido, adjuntos?, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { entidad_tipo, entidad_id, tipo, contenido, adjuntos, metadata } = body

    if (!entidad_tipo || !entidad_id || !contenido) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Obtener nombre del usuario
    const admin = crearClienteAdmin()
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()

    const autorNombre = perfil
      ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
      : 'Usuario'

    const { data, error } = await admin
      .from('chatter')
      .insert({
        empresa_id: empresaId,
        entidad_tipo,
        entidad_id,
        tipo: tipo || 'mensaje',
        contenido,
        autor_id: user.id,
        autor_nombre: autorNombre,
        autor_avatar_url: perfil?.avatar_url || null,
        adjuntos: adjuntos || [],
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error al crear entrada chatter:', error)
      return NextResponse.json({ error: 'Error al crear entrada' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
