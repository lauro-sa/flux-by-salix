import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// GET /api/inbox/respuestas-whatsapp — listar respuestas rápidas de WhatsApp
export async function GET() {
  try {
    const guard = await requerirPermisoAPI('config_whatsapp', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('respuestas_rapidas_whatsapp')
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
    console.error('Error al obtener respuestas de WhatsApp:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

// POST /api/inbox/respuestas-whatsapp — crear respuesta rápida de WhatsApp
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_whatsapp', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

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
      .from('respuestas_rapidas_whatsapp')
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
    console.error('Error al crear respuesta de WhatsApp:', err)
    return NextResponse.json({ error: 'Error al crear respuesta' }, { status: 500 })
  }
}
