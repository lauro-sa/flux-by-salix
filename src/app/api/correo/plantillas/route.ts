import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/correo/plantillas — Listar plantillas de correo electrónico.
 * Tabla independiente de las respuestas rápidas de WhatsApp/inbox.
 */
export async function GET() {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('plantillas_correo')
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
    console.error('Error al obtener plantillas de correo:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

/**
 * POST /api/correo/plantillas — Crear plantilla de correo.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { nombre, contenido } = body

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del creador para auditoría
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    const { data, error } = await admin
      .from('plantillas_correo')
      .insert({
        empresa_id: empresaId,
        nombre,
        categoria: body.categoria || null,
        asunto: body.asunto || '',
        contenido: contenido || (body.contenido_html || '').replace(/<[^>]*>/g, '').trim(),
        contenido_html: body.contenido_html || '',
        variables: body.variables || [],
        modulos: body.modulos || [],
        disponible_para: body.disponible_para || 'todos',
        roles_permitidos: body.roles_permitidos || [],
        usuarios_permitidos: body.usuarios_permitidos || [],
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data }, { status: 201 })
  } catch (err) {
    console.error('Error al crear plantilla de correo:', err)
    return NextResponse.json({ error: 'Error al crear plantilla de correo' }, { status: 500 })
  }
}
