import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/agente-ia/base-conocimiento — Listar entradas de la base de conocimiento.
 * POST /api/inbox/agente-ia/base-conocimiento — Crear nueva entrada.
 *
 * Query params GET: ?categoria=soporte&activo=true&busqueda=texto
 */

export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const activo = searchParams.get('activo')
    const busqueda = searchParams.get('busqueda')

    const admin = crearClienteAdmin()
    let query = admin
      .from('base_conocimiento_ia')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: false })

    if (categoria) query = query.eq('categoria', categoria)
    if (activo !== null && activo !== undefined) query = query.eq('activo', activo === 'true')
    if (busqueda) query = query.or(`titulo.ilike.%${busqueda}%,contenido.ilike.%${busqueda}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ entradas: data || [] })
  } catch (err) {
    console.error('Error al listar base de conocimiento:', err)
    return NextResponse.json({ entradas: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()

    // Validar campos requeridos
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : ''
    if (!titulo || !contenido) {
      return NextResponse.json({ error: 'titulo y contenido son requeridos' }, { status: 400 })
    }
    if (titulo.length > 200) {
      return NextResponse.json({ error: 'titulo no puede superar 200 caracteres' }, { status: 400 })
    }
    if (contenido.length > 10000) {
      return NextResponse.json({ error: 'contenido no puede superar 10000 caracteres' }, { status: 400 })
    }

    const categoriasValidas = ['general', 'soporte', 'ventas', 'info', 'producto']
    const categoria = categoriasValidas.includes(body.categoria) ? body.categoria : 'general'
    const etiquetas = Array.isArray(body.etiquetas)
      ? body.etiquetas.filter((e: unknown) => typeof e === 'string').slice(0, 20)
      : []

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('base_conocimiento_ia')
      .insert({
        empresa_id: empresaId,
        titulo,
        contenido,
        categoria,
        etiquetas,
        activo: body.activo ?? true,
      })
      .select()
      .single()

    if (error) throw error

    // Generar embedding en background (no bloquea la respuesta)
    if (data?.id) {
      import('@/lib/agente-ia/embeddings').then(({ actualizarEmbedding }) => {
        actualizarEmbedding(admin, empresaId, data.id, `${titulo}\n\n${contenido}`).catch(() => {})
      }).catch(() => {})
    }

    return NextResponse.json({ entrada: data })
  } catch (err) {
    console.error('Error al crear entrada de conocimiento:', err)
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
  }
}
