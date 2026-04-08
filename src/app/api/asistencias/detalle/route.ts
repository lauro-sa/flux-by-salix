import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/detalle?id=xxx — Obtener un registro por ID.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const admin = crearClienteAdmin()

    const { data: registro } = await admin
      .from('asistencias')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!registro) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Obtener nombre del miembro
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', registro.miembro_id)
      .single()

    let miembroNombre = 'Sin nombre'
    if (miembro) {
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', miembro.usuario_id)
        .single()
      if (perfil) miembroNombre = `${perfil.nombre} ${perfil.apellido}`
    }

    return NextResponse.json({ ...registro, miembro_nombre: miembroNombre })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
