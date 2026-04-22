'use client'

import { useMemo } from 'react'
import { usePermisosActuales } from './usePermisosActuales'
import { PERMISOS_POR_ROL, RESTRICCIONES_ADMIN } from '@/lib/permisos-constantes'
import { resolverPermiso } from '@/lib/permisos-logica'
import type { Modulo, Accion } from '@/tipos'

/**
 * Hook para verificar permisos del usuario actual.
 *
 * La lógica de resolución vive en `permisos-logica.ts` (fuente única compartida
 * con el servidor). Este hook solo se encarga de obtener el contexto reactivo
 * desde `usePermisosActuales` y delegar en esa función pura.
 *
 * Fuente: `usePermisosActuales` → contexto con suscripción realtime a la fila
 * del miembro en DB. Cualquier cambio que haga un admin en los permisos_custom
 * se refleja al instante en sidebar, botones y guards.
 */

function useRol() {
  const { rol, permisosCustom, esPropietario, esSuperadmin, cargando } = usePermisosActuales()
  const esAdmin = rol === 'administrador'

  const tienePermiso = useMemo(() => {
    return (modulo: Modulo, accion: Accion): boolean => {
      return resolverPermiso({
        rol,
        permisosCustom,
        esPropietario,
        esSuperadmin,
      }, modulo, accion)
    }
  }, [rol, esPropietario, esSuperadmin, permisosCustom])

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
    esColaborador: rol === 'colaborador',
    cargando,
    tienePermiso,
    tienePermisoConfig,
  }
}

export { useRol, PERMISOS_POR_ROL, RESTRICCIONES_ADMIN }
