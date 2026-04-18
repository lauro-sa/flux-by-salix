import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// GET /api/inbox/respuestas-correo — listar respuestas rápidas de correo
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('respuestas_rapidas_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .or(`disponible_para.eq.todos,creado_por.eq.${user.id}`)
      .order('orden', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ plantillas: [] })
      }
      throw error
    }

    return NextResponse.json({ plantillas: data || [] })
  } catch (err) {
    console.error('Error al obtener respuestas de correo:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

// POST /api/inbox/respuestas-correo — crear respuesta rápida de correo
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { nombre, contenido } = body

    if (!nombre || !contenido) {
      return NextResponse.json({ error: 'nombre y contenido son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    const { data, error } = await admin
      .from('respuestas_rapidas_correo')
      .insert({
        empresa_id: empresaId,
        nombre,
        categoria: body.categoria || null,
        asunto: body.asunto || null,
        contenido,
        contenido_html: body.contenido_html || null,
        variables: body.variables || [],
        modulos: body.modulos || [],
        disponible_para: body.disponible_para || 'todos',
        roles_permitidos: body.roles_permitidos || [],
        usuarios_permitidos: body.usuarios_permitidos || [],
        orden: body.orden ?? 0,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data }, { status: 201 })
  } catch (err) {
    console.error('Error al crear respuesta de correo:', err)
    return NextResponse.json({ error: 'Error al crear respuesta' }, { status: 500 })
  }
}
