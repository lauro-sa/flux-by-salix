'use client'

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/lib/permisos-constantes'
import type { Modulo, Accion, Rol, PermisosMapa } from '@/tipos'

/**
 * Hook para verificar permisos del usuario actual.
 * Lee el rol y permisos_custom del JWT y expone helpers para chequear acceso.
 * Se usa en: guards de paginas, botones condicionales, filtros de datos.
 *
 * Logica de resolucion:
 * 1. Propietario -> acceso total siempre (hardcodeado)
 * 2. Si tiene permisos_custom en el miembro -> usa esos (override completo)
 * 3. Si no -> usa defaults del rol
 * 4. Administrador tiene restricciones especificas en admin/config
 */

// Permisos importados de lib/permisos-constantes.ts (compartido con servidor)

/** Decodifica el payload de un JWT sin verificar firma */
function decodificarJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

// RESTRICCIONES_ADMIN importado de lib/permisos-constantes.ts

function useRol() {
  const { sesion } = useAuth()

  // El rol viene de los claims del JWT (inyectado por custom_access_token_hook)
  const claims = sesion?.access_token ? decodificarJwt(sesion.access_token) : {}
  const rol = (claims.rol as Rol) || null
  const esPropietario = rol === 'propietario'
  const esAdmin = rol === 'administrador'
  // permisos_custom viene como claim del JWT o se carga del miembro
  const permisosCustom = (claims.permisos_custom as PermisosMapa | undefined) || null

  const tienePermiso = useMemo(() => {
    return (modulo: Modulo, accion: Accion): boolean => {
      // Propietario tiene acceso total siempre
      if (esPropietario) return true

      if (!rol) return false

      // Administrador: acceso amplio pero con restricciones especificas
      if (esAdmin) {
        const restricciones = RESTRICCIONES_ADMIN[modulo]
        if (restricciones?.includes(accion)) return false
        // Si el modulo tiene permisos definidos para admin, verificar
        const permisosAdmin = PERMISOS_POR_ROL.administrador[modulo]
        if (permisosAdmin) return permisosAdmin.includes(accion)
        // Modulos no listados en admin = sin acceso
        return false
      }

      // Si tiene permisos custom, esos son el override completo
      if (permisosCustom) {
        const accionesModulo = permisosCustom[modulo]
        if (!accionesModulo) return false
        return accionesModulo.includes(accion)
      }

      // Usar defaults del rol
      const permisosRol = PERMISOS_POR_ROL[rol]
      const accionesModulo = permisosRol?.[modulo]
      if (!accionesModulo) return false
      return accionesModulo.includes(accion)
    }
  }, [rol, esPropietario, esAdmin, permisosCustom])

  /** Verificar permiso en modulos de configuracion (config_*) */
  const tienePermisoConfig = useMemo(() => {
    return (moduloBase: string, accion: 'ver' | 'editar'): boolean => {
      const moduloConfig = `config_${moduloBase}` as Modulo
      return tienePermiso(moduloConfig, accion)
    }
  }, [tienePermiso])

  return {
    rol,
    esPropietario,
    esAdmin,
    esGestor: rol === 'gestor',
    esSupervisor: rol === 'supervisor',
    esColaborador: !!rol && !esPropietario && !esAdmin,
    tienePermiso,
    tienePermisoConfig,
  }
}

export { useRol, PERMISOS_POR_ROL, RESTRICCIONES_ADMIN }
