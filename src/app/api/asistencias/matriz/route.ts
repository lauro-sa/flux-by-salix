import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverNombresMiembros } from '@/lib/miembros/nombres'

/**
 * GET /api/asistencias/matriz — Datos para vista calendario.
 * Query params: desde (YYYY-MM-DD), hasta (YYYY-MM-DD)
 * Devuelve: miembros con sus asistencias en el rango.
 */
export async function GET(request: NextRequest) {
  try {
    // Vista matriz = todos los miembros del equipo → requiere ver_todos
    const guard = await requerirPermisoAPI('asistencias', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Miembros activos con nombres (perfil con fallback a contacto equipo)
    const { data: miembrosData } = await admin
      .from('miembros')
      .select('id, activo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    const nombresMapa = await resolverNombresMiembros(admin, empresaId)

    const miembros = (miembrosData || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      nombre: nombresMapa.get(m.id as string) || 'Sin nombre',
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))

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
