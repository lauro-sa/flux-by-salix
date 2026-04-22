import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/lib/permisos-constantes'
import type { Modulo, Accion, PermisosMapa } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'

/**
 * Lógica pura de resolución de permisos. Sin dependencias de React ni de Supabase.
 * Fuente única de verdad: tanto el cliente (useRol) como el servidor
 * (permisos-servidor) importan esta función para garantizar que la misma entrada
 * da el mismo resultado en ambos lados.
 *
 * Orden de evaluación:
 *   1. Superadmin de Salix (soporte interno) → true.
 *   2. Propietario → true.
 *   3. Administrador:
 *      - RESTRICCIONES_ADMIN por acción → false (gana la restricción).
 *      - Si hay permisos_custom → esos son el override completo.
 *      - Sino → defaults del rol administrador.
 *   4. Resto de roles:
 *      - Si hay permisos_custom → override completo.
 *      - Sino → defaults del rol.
 */

export interface ContextoPermisos {
  rol: Rol | null
  permisosCustom: PermisosMapa | null
  esPropietario: boolean
  esSuperadmin: boolean
}

export function resolverPermiso(
  ctx: ContextoPermisos,
  modulo: Modulo,
  accion: Accion,
): boolean {
  if (ctx.esSuperadmin) return true
  if (ctx.esPropietario) return true
  if (!ctx.rol) return false

  if (ctx.rol === 'administrador') {
    const restricciones = RESTRICCIONES_ADMIN[modulo]
    if (restricciones?.includes(accion)) return false
    if (ctx.permisosCustom) {
      const acciones = ctx.permisosCustom[modulo]
      if (!acciones) return false
      return acciones.includes(accion)
    }
    const permisosAdmin = PERMISOS_POR_ROL.administrador[modulo]
    if (permisosAdmin) return permisosAdmin.includes(accion)
    return false
  }

  if (ctx.permisosCustom) {
    const acciones = ctx.permisosCustom[modulo]
    if (!acciones) return false
    return acciones.includes(accion)
  }

  const permisosRol = PERMISOS_POR_ROL[ctx.rol]
  const acciones = permisosRol?.[modulo]
  if (!acciones) return false
  return acciones.includes(accion)
}
