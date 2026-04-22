import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverNombresMiembros } from '@/lib/miembros/nombres'

/**
 * GET /api/asistencias/matriz — Datos para vista calendario.
 * Query params: desde (YYYY-MM-DD), hasta (YYYY-MM-DD)
 *
 * Visibilidad:
 * - ver_todos: todos los miembros activos con sus asistencias.
 * - ver_propio: solo la fila del usuario autenticado. No se expone al equipo.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const vis = await verificarVisibilidad(user.id, empresaId, 'asistencias')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Miembros: si solo tiene ver_propio, devolvemos solo su fila. Si ver_todos,
    // todos los activos. Así la matriz siempre tiene sentido y nunca expone
    // datos del equipo a quien no puede verlos.
    let miembrosQuery = admin
      .from('miembros')
      .select('id, activo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (vis.soloPropio) {
      miembrosQuery = miembrosQuery.eq('usuario_id', user.id)
    }

    const { data: miembrosData } = await miembrosQuery

    const idsPermitidos = (miembrosData || []).map((m: { id: string }) => m.id)
    const nombresMapa = await resolverNombresMiembros(admin, empresaId)

    const miembros = (miembrosData || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      nombre: nombresMapa.get(m.id as string) || 'Sin nombre',
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))

    // Sin miembros permitidos (ver_propio sin fila) → respuesta vacía.
    if (idsPermitidos.length === 0) {
      return NextResponse.json({ miembros: [], asistencias: {} })
    }

    // Obtener asistencias del rango, restringido a los miembros permitidos.
    const { data: asistencias } = await admin
      .from('asistencias')
      .select('id, miembro_id, fecha, estado, tipo, hora_entrada, hora_salida, metodo_registro, puntualidad_min, cierre_automatico, editado_por')
      .eq('empresa_id', empresaId)
      .in('miembro_id', idsPermitidos)
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
