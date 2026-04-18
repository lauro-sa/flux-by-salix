import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

// GET /api/correo/config — config del módulo correo
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_correo', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: config } = await admin
      .from('config_correo')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    return NextResponse.json({ config: config || null })
  } catch (err) {
    console.error('Error al obtener config correo:', err)
    return NextResponse.json({ config: null })
  }
}

// PUT /api/correo/config — guardar config del módulo correo
export async function PUT(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_correo', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('config_correo')
      .upsert({
        empresa_id: empresaId,
        ...body,
        actualizado_en: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (err) {
    console.error('Error al guardar config correo:', err)
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
  }
}
