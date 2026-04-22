'use client'

import { useMemo } from 'react'
import { usePermisosActuales } from './usePermisosActuales'
import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/lib/permisos-constantes'
import type { Modulo, Accion } from '@/tipos'

/**
 * Hook para verificar permisos del usuario actual.
 *
 * Fuente: `usePermisosActuales` → contexto con suscripción realtime a la
 * fila del miembro en DB. Cualquier cambio que haga un admin en los
 * `permisos_custom` del miembro se refleja al instante en todos los
 * consumidores de este hook (sidebar, botones, guards).
 *
 * Lógica de resolución:
 * 1. Propietario → acceso total siempre.
 * 2. Administrador → PERMISOS_POR_ROL['administrador'] con RESTRICCIONES_ADMIN.
 * 3. Si tiene permisos_custom → esos son el override completo.
 * 4. Si no → defaults del rol.
 */

function useRol() {
  const { rol, permisosCustom, esPropietario, esSuperadmin, cargando } = usePermisosActuales()
  const esAdmin = rol === 'administrador'

  const tienePermiso = useMemo(() => {
    return (modulo: Modulo, accion: Accion): boolean => {
      // Superadmin interno de Salix: acceso total (solo para soporte).
      if (esSuperadmin) return true
      // Propietario tiene acceso total siempre
      if (esPropietario) return true

      if (!rol) return false

      // Administrador: acceso amplio, pero si hay permisos_custom esos mandan.
      // Permite a un propietario recortar permisos puntuales a un admin sin cambiar rol.
      if (esAdmin) {
        const restricciones = RESTRICCIONES_ADMIN[modulo]
        if (restricciones?.includes(accion)) return false
        if (permisosCustom) {
          const accionesModulo = permisosCustom[modulo]
          if (!accionesModulo) return false
          return accionesModulo.includes(accion)
        }
        const permisosAdmin = PERMISOS_POR_ROL.administrador[modulo]
        if (permisosAdmin) return permisosAdmin.includes(accion)
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
  }, [rol, esPropietario, esAdmin, esSuperadmin, permisosCustom])

  /** Verificar permiso en módulos de configuración (config_*) */
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
    cargando,
    tienePermiso,
    tienePermisoConfig,
  }
}

export { useRol, PERMISOS_POR_ROL, RESTRICCIONES_ADMIN }
