import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'

/**
 * GET /api/miembros — Lista de miembros de la empresa activa con datos de perfil.
 *
 * Por default retorna solo miembros ACTIVOS con cuenta Flux (usuario_id != null).
 * Para el listado completo (incluye empleados "solo kiosco" sin cuenta y desactivados)
 * consumir directamente la tabla `miembros` desde la página /usuarios con supabase.
 *
 * Query params:
 *   - incluir_inactivos=true  → también trae los desactivados (para admins)
 *   - incluir_sin_cuenta=true → también trae empleados "solo kiosco" (usuario_id IS NULL)
 *
 * Retorna: { miembros: Array<{
 *     id, usuario_id, rol, activo, puesto_nombre, sector,
 *     perfil: { nombre, apellido, correo, avatar_url } | null,
 *     nombre, apellido  // campos flat de acceso rápido
 *   }> }
 *
 * Consumidores típicos:
 *   - Filtro "Responsable" / "Asignado a" / "Creado por" en listados
 *   - Selectores de miembro en modales (asignar actividad, etc.)
 *   - Menú de conversaciones (mensajería interna)
 *
 * Patrón de query: son 2 queries secuenciales (miembros → perfiles) en vez de
 * un JOIN porque la FK entre ambas no está declarada en Drizzle (las uniones
 * con `select('*, perfil:perfiles(...)')` quedan ambiguas y pueden devolver null).
 * El "costo" de las 2 queries es despreciable — con cache de React Query son ~1ms.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const params = request.nextUrl.searchParams
    const incluirInactivos = params.get('incluir_inactivos') === 'true'
    const incluirSinCuenta = params.get('incluir_sin_cuenta') === 'true'

    const admin = crearClienteAdmin()

    // 1) Traer miembros de la empresa
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, rol, activo, puesto_nombre, sector')
      .eq('empresa_id', empresaId)

    if (!incluirInactivos) queryMiembros = queryMiembros.eq('activo', true)
    if (!incluirSinCuenta) queryMiembros = queryMiembros.not('usuario_id', 'is', null)

    const { data: miembrosData, error } = await queryMiembros

    if (error) {
      registrarError(error, { ruta: '/api/miembros', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al listar miembros' }, { status: 500 })
    }

    // 2) Enriquecer con perfil en query separada (solo para los que tienen usuario_id)
    const usuarioIds = (miembrosData || []).map(m => m.usuario_id).filter(Boolean)
    const perfilesMap = new Map<string, { nombre: string; apellido: string | null; correo: string | null; avatar_url: string | null }>()
    if (usuarioIds.length > 0) {
      const { data: perfilesData } = await admin
        .from('perfiles')
        .select('id, nombre, apellido, correo, avatar_url')
        .in('id', usuarioIds)
      for (const p of (perfilesData || [])) {
        perfilesMap.set(p.id, { nombre: p.nombre, apellido: p.apellido, correo: p.correo, avatar_url: p.avatar_url })
      }
    }

    const miembros = (miembrosData || []).map(m => {
      const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
      return {
        id: m.id,
        usuario_id: m.usuario_id,
        rol: m.rol,
        activo: m.activo,
        puesto_nombre: m.puesto_nombre,
        sector: m.sector,
        perfil: perfil || null,
        // Campos flat de acceso rápido (algunos consumidores los usan directo)
        nombre: perfil?.nombre || null,
        apellido: perfil?.apellido || null,
      }
    })

    return NextResponse.json({ miembros })
  } catch (err) {
    registrarError(err, { ruta: '/api/miembros', accion: 'listar' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
