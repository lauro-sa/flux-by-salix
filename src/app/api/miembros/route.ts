import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'

/**
 * GET /api/miembros — Lista de empleados (miembros) de la empresa activa.
 *
 * Un "miembro" es un empleado de la empresa, tenga o no cuenta de Flux.
 * Los empleados sin cuenta (cargados manualmente, sin invitación) son válidos:
 * pueden fichar, cobrar nómina, asignarse a actividades, etc. Por eso por
 * defecto se devuelven todos. Los datos personales se resuelven así:
 *   - con cuenta → desde `perfiles` (vía `usuario_id`).
 *   - sin cuenta → desde `contactos` (contacto-equipo, vía `contactos.miembro_id`).
 *
 * Query params:
 *   - `incluir_inactivos=true` → incluye miembros desactivados (default: false).
 *   - `incluir_sin_cuenta=false` → excluye empleados sin cuenta de Flux
 *      (default: true). Útil cuando el flujo realmente requiere autenticación
 *      (ej. asignar agentes a un canal de WhatsApp).
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
 *     id, usuario_id, rol, activo, puesto, sector,
 *     perfil: { nombre, apellido, correo, avatar_url } | null,
 *     nombre, apellido  // campos flat de acceso rápido
 *   }> }
 * `puesto` y `sector` se resuelven vía FK (puestos) y miembros_sectores → sectores.
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
    // "miembro" = empleado de la empresa; puede tener o no cuenta activa en Flux.
    // Default: incluir sin cuenta — porque un empleado sin cuenta sigue siendo
    // un empleado válido (puede fichar, cobrar nómina, asistir, etc.).
    // Los lugares que quieran solo "agentes con cuenta" pueden pasar
    // ?incluir_sin_cuenta=false explícitamente.
    const incluirSinCuentaParam = params.get('incluir_sin_cuenta')
    const incluirSinCuenta = incluirSinCuentaParam === null
      ? true
      : incluirSinCuentaParam === 'true'

    const admin = crearClienteAdmin()

    // 1) Traer miembros de la empresa
    let queryMiembros = admin
      .from('miembros')
      .select('id, usuario_id, rol, activo, puesto_id, permisos_custom')
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

    // 2b) Para miembros sin cuenta, los datos personales viven en la tabla
    //     `contactos` (contacto-equipo creado al cargar el empleado manualmente).
    //     Lo cargamos para que aparezcan con nombre/correo igual que los demás.
    const miembrosSinPerfil = (miembrosData || []).filter(m => !m.usuario_id).map(m => m.id)
    const contactoEquipoMap = new Map<string, { nombre: string | null; apellido: string | null; correo: string | null }>()
    if (miembrosSinPerfil.length > 0) {
      const { data: contactosData } = await admin
        .from('contactos')
        .select('miembro_id, nombre, apellido, correo')
        .in('miembro_id', miembrosSinPerfil)
        .eq('empresa_id', empresaId)
      for (const c of (contactosData || [])) {
        if (c.miembro_id) contactoEquipoMap.set(c.miembro_id, { nombre: c.nombre, apellido: c.apellido, correo: c.correo })
      }
    }

    // 3) Etiquetas (puesto + sector) resueltas desde FK + miembros_sectores
    const etiquetas = await cargarEtiquetasMiembros(admin, (miembrosData || []).map(m => ({ id: m.id, puesto_id: m.puesto_id })))

    const miembros = (miembrosData || []).map(m => {
      const perfilCuenta = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
      const contactoEq = !m.usuario_id ? contactoEquipoMap.get(m.id) : null
      // Datos efectivos: priorizamos perfil de cuenta, fallback a contacto-equipo.
      const nombre = perfilCuenta?.nombre || contactoEq?.nombre || null
      const apellido = perfilCuenta?.apellido || contactoEq?.apellido || null
      const correo = perfilCuenta?.correo || contactoEq?.correo || null
      const et = etiquetas.get(m.id)
      // perfil unificado: el shape esperado por consumidores no cambia.
      const perfil = (nombre || apellido || correo)
        ? { nombre: nombre || '', apellido, correo, avatar_url: perfilCuenta?.avatar_url || null }
        : null
      return {
        id: m.id,
        usuario_id: m.usuario_id,
        rol: m.rol,
        activo: m.activo,
        permisos_custom: m.permisos_custom ?? null,
        puesto: et?.puesto ?? null,
        sector: et?.sector ?? null,
        perfil,
        // Campos flat de acceso rápido (algunos consumidores los usan directo)
        nombre,
        apellido,
      }
    })

    return NextResponse.json({ miembros })
  } catch (err) {
    registrarError(err, { ruta: '/api/miembros', accion: 'listar' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
