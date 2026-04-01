import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/preferencias?dispositivo_id=xxx — Leer preferencias del usuario para este dispositivo.
 * POST /api/preferencias — Guardar/actualizar preferencias.
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const dispositivoId = request.nextUrl.searchParams.get('dispositivo_id')
    if (!dispositivoId) return NextResponse.json({ error: 'dispositivo_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('preferencias_usuario')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('dispositivo_id', dispositivoId)
      .single()

    // Si no hay preferencias, devolver defaults
    if (!data) {
      return NextResponse.json({
        tema: 'sistema',
        efecto: 'solido',
        fondo_cristal: 'aurora',
        escala: 'normal',
        sidebar_orden: null,
        sidebar_ocultos: null,
        sidebar_deshabilitados: null,
        sidebar_colapsado: false,
        sidebar_auto_ocultar: false,
        config_tablas: {},
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { dispositivo_id, ...preferencias } = body

    if (!dispositivo_id) return NextResponse.json({ error: 'dispositivo_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('preferencias_usuario')
      .upsert({
        usuario_id: user.id,
        dispositivo_id,
        ...preferencias,
        actualizado_en: new Date().toISOString(),
      }, {
        onConflict: 'usuario_id,dispositivo_id',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
