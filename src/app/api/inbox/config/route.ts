import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/config — Obtener configuración del inbox de la empresa.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Config del inbox
    const { data: config } = await admin
      .from('config_inbox')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    // Módulos activos
    const { data: modulos } = await admin
      .from('modulos_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .like('modulo', 'inbox_%')

    return NextResponse.json({
      config: config || null,
      modulos: modulos || [],
    })
  } catch (err) {
    console.error('Error al obtener config inbox:', err)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

/**
 * PUT /api/inbox/config — Guardar/actualizar configuración del inbox.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('config_inbox')
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
    console.error('Error al guardar config inbox:', err)
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
  }
}
