import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/lib/permisos-constantes'
import type { Modulo, Accion, PermisosMapa } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { NextResponse } from 'next/server'

/**
 * Verificación de permisos server-side para API routes.
 * Replica la lógica de useRol pero sin depender de hooks de React.
 * Se usa en: API routes que necesitan validar permisos por acción.
 */

interface DatosMiembro {
  rol: Rol
  permisos_custom: PermisosMapa | null
}

/** Verifica si un rol+permisos tiene acceso a modulo+accion */
export function verificarPermiso(
  miembro: DatosMiembro,
  modulo: Modulo,
  accion: Accion
): boolean {
  const { rol, permisos_custom } = miembro

  // Propietario tiene acceso total
  if (rol === 'propietario') return true

  // Administrador: acceso amplio con restricciones
  if (rol === 'administrador') {
    const restricciones = RESTRICCIONES_ADMIN[modulo]
    if (restricciones?.includes(accion)) return false
    const permisosAdmin = PERMISOS_POR_ROL.administrador[modulo]
    if (permisosAdmin) return permisosAdmin.includes(accion)
    return false
  }

  // Permisos custom tienen prioridad total
  if (permisos_custom) {
    const accionesModulo = permisos_custom[modulo]
    if (!accionesModulo) return false
    return accionesModulo.includes(accion)
  }

  // Defaults del rol
  const permisosRol = PERMISOS_POR_ROL[rol]
  const accionesModulo = permisosRol?.[modulo]
  if (!accionesModulo) return false
  return accionesModulo.includes(accion)
}

/** Obtiene el miembro actual y verifica permiso en una sola llamada */
export async function obtenerYVerificarPermiso(
  usuarioId: string,
  empresaId: string,
  modulo: Modulo,
  accion: Accion
): Promise<{ permitido: boolean; miembro: DatosMiembro | null }> {
  const datos = await obtenerDatosMiembro(usuarioId, empresaId)
  if (!datos) return { permitido: false, miembro: null }
  return {
    permitido: verificarPermiso(datos, modulo, accion),
    miembro: datos,
  }
}

/**
 * Obtiene datos del miembro una sola vez para verificar múltiples permisos.
 * Evita hacer N queries a miembros cuando se necesitan verificar ver_todos + ver_propio.
 */
export async function obtenerDatosMiembro(
  usuarioId: string,
  empresaId: string
): Promise<DatosMiembro | null> {
  const admin = crearClienteAdmin()
  const { data: miembro } = await admin
    .from('miembros')
    .select('rol, permisos_custom')
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .single()

  if (!miembro) return null

  return {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom as PermisosMapa | null,
  }
}

/**
 * Guard completo para API routes: autentica usuario y verifica permiso.
 *
 * Uso típico:
 * ```
 * const guard = await requerirPermisoAPI('asistencias', 'ver_todos')
 * if ('respuesta' in guard) return guard.respuesta
 * const { user, empresaId, miembro } = guard
 * ```
 *
 * Devuelve `{ respuesta }` con NextResponse 401/403 si falla, o `{ user, empresaId, miembro }` si pasa.
 * Se ahorra ~8 líneas por endpoint y homogeniza las respuestas de error.
 */
export async function requerirPermisoAPI(
  modulo: Modulo,
  accion: Accion,
): Promise<
  | { respuesta: NextResponse }
  | { user: { id: string; app_metadata?: { empresa_activa_id?: string } }; empresaId: string; miembro: DatosMiembro }
> {
  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return { respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return { respuesta: NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 }) }
  }

  const { permitido, miembro } = await obtenerYVerificarPermiso(user.id, empresaId, modulo, accion)
  if (!permitido || !miembro) {
    return { respuesta: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }

  return { user: user as { id: string; app_metadata?: { empresa_activa_id?: string } }, empresaId, miembro }
}

/**
 * Verifica permisos de visibilidad (ver_todos vs ver_propio) con una sola query a BD.
 * Retorna { verTodos, soloPropio, miembro } o null si no tiene ningún permiso.
 */
export async function verificarVisibilidad(
  usuarioId: string,
  empresaId: string,
  modulo: Modulo
): Promise<{ verTodos: boolean; soloPropio: boolean; miembro: DatosMiembro } | null> {
  const miembro = await obtenerDatosMiembro(usuarioId, empresaId)
  if (!miembro) return null

  const verTodos = verificarPermiso(miembro, modulo, 'ver_todos')
  if (verTodos) return { verTodos: true, soloPropio: false, miembro }

  const verPropio = verificarPermiso(miembro, modulo, 'ver_propio')
  if (verPropio) return { verTodos: false, soloPropio: true, miembro }

  return null
}
