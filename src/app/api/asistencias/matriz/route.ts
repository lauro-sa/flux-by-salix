import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/matriz — Datos para vista calendario.
 * Query params: desde (YYYY-MM-DD), hasta (YYYY-MM-DD)
 * Devuelve: miembros con sus asistencias en el rango.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener miembros activos con nombres
    const { data: miembrosData } = await admin
      .from('miembros')
      .select('id, usuario_id, activo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')

    const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))

    const miembros = (miembrosData || []).map((m: Record<string, unknown>) => {
      const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
      return {
        id: m.id,
        nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sin nombre',
      }
    }).sort((a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre))

    // Obtener asistencias del rango
    const { data: asistencias } = await admin
      .from('asistencias')
      .select('id, miembro_id, fecha, estado, tipo, hora_entrada, hora_salida, metodo_registro, puntualidad_min, cierre_automatico, editado_por')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    // Agrupar por miembro_id → fecha
    const mapa: Record<string, Record<string, Record<string, unknown>>> = {}
    for (const a of (asistencias || [])) {
      const r = a as Record<string, unknown>
      const mid = r.miembro_id as string
      const fecha = r.fecha as string
      if (!mapa[mid]) mapa[mid] = {}
      mapa[mid][fecha] = r
    }

    return NextResponse.json({ miembros, asistencias: mapa })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
