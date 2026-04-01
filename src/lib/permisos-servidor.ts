import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/hooks/useRol'
import type { Modulo, Accion, PermisosMapa } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'
import { crearClienteAdmin } from '@/lib/supabase/admin'

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
  const admin = crearClienteAdmin()

  const { data: miembro } = await admin
    .from('miembros')
    .select('rol, permisos_custom')
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .single()

  if (!miembro) return { permitido: false, miembro: null }

  const datosMiembro: DatosMiembro = {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom as PermisosMapa | null,
  }

  return {
    permitido: verificarPermiso(datosMiembro, modulo, accion),
    miembro: datosMiembro,
  }
}
