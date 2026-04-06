import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/plantillas — Listar plantillas de respuesta rápida.
 * Filtros: canal ('whatsapp', 'correo', 'todos')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const canal = request.nextUrl.searchParams.get('canal')
    const admin = crearClienteAdmin()

    let query = admin
      .from('plantillas_respuesta')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (canal) {
      query = query.or(`canal.eq.${canal},canal.eq.todos`)
    }

    // Filtrar por visibilidad: ver plantillas para todos + mis propias plantillas personales
    query = query.or(`disponible_para.eq.todos,creado_por.eq.${user.id}`)

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ plantillas: [] })
      }
      throw error
    }

    return NextResponse.json({ plantillas: data || [] })
  } catch (err) {
    console.error('Error al obtener plantillas:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

/**
 * POST /api/inbox/plantillas — Crear plantilla de respuesta.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { nombre, canal, contenido } = body

    if (!nombre || !canal || !contenido) {
      return NextResponse.json({ error: 'nombre, canal y contenido son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('plantillas_respuesta')
      .insert({
        empresa_id: empresaId,
        nombre,
        categoria: body.categoria || null,
        canal,
        asunto: body.asunto || null,
        contenido,
        contenido_html: body.contenido_html || null,
        variables: body.variables || [],
        modulos: body.modulos || [],
        disponible_para: body.disponible_para || 'todos',
        roles_permitidos: body.roles_permitidos || [],
        usuarios_permitidos: body.usuarios_permitidos || [],
        creado_por: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data }, { status: 201 })
  } catch (err) {
    console.error('Error al crear plantilla:', err)
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
  }
}
