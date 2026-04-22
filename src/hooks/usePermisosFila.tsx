'use client'

import { useMemo } from 'react'
import { useRol } from '@/hooks/useRol'
import { useAuth } from '@/hooks/useAuth'
import type { Modulo } from '@/tipos'

/**
 * usePermisosFila — Hook compartido para decidir qué botones mostrar
 * sobre un registro dado (fila de tabla, tarjeta, detalle, etc.).
 *
 * Por qué existe:
 * Si cada componente calcula "puedo editar esto" combinando `tienePermiso`
 * + ownership a mano, la lógica se duplica y se desalinea. Este hook
 * centraliza el cálculo: `tienePermiso(modulo, accion)` + ownership del
 * registro (creador, asignados, responsables). Si mañana cambia el criterio,
 * se cambia acá y se actualiza toda la UI.
 *
 * No reemplaza el check del servidor: el backend siempre vuelve a verificar
 * al recibir la mutación. Un botón expuesto por error se rechaza igual.
 *
 * Forma del registro esperada (todos opcionales):
 *  - `creado_por`            — uuid del creador.
 *  - `asignado_a`            — uuid del único asignado (visitas, calendario).
 *  - `asignados_ids`         — array de uuids (actividades, calendario).
 *  - `asignados`             — array de { usuario_id } (OTs).
 *  - `responsables`          — array de { usuario_id } (contactos).
 *
 * Uso típico:
 * ```tsx
 * const permisos = usePermisosFila('actividades', actividad)
 * {permisos.puedeEditar && <Boton onClick={editar}>Editar</Boton>}
 * ```
 */

export interface RegistroConOwnership {
  creado_por?: string | null
  asignado_a?: string | null
  asignados_ids?: string[] | null
  asignados?: { usuario_id: string }[] | null
  responsables?: { usuario_id: string }[] | null
}

export interface PermisosFila {
  /** Usuario es dueño (creador o asignado/responsable) del registro. */
  tieneOwnership: boolean
  /** Admin/propietario/superadmin o rol que ve-todos. */
  esGestorGlobal: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
  /** Solo para módulos con la acción `completar`. */
  puedeCompletar: boolean
  /** Solo para módulos con la acción `enviar` (documentos, inbox). */
  puedeEnviar: boolean
  /** Solo para módulos con la acción `asignar` (visitas). */
  puedeAsignar: boolean
}

export function usePermisosFila(
  modulo: Modulo,
  registro: RegistroConOwnership | null | undefined,
): PermisosFila {
  const { tienePermiso, esAdmin, esPropietario } = useRol()
  const { usuario } = useAuth()
  const usuarioId = usuario?.id ?? null

  return useMemo<PermisosFila>(() => {
    const esGestorGlobal = esAdmin || esPropietario

    if (!registro || !usuarioId) {
      return {
        tieneOwnership: false,
        esGestorGlobal,
        puedeEditar: esGestorGlobal && tienePermiso(modulo, 'editar'),
        puedeEliminar: esGestorGlobal && tienePermiso(modulo, 'eliminar'),
        puedeCompletar: esGestorGlobal && tienePermiso(modulo, 'completar'),
        puedeEnviar: esGestorGlobal && tienePermiso(modulo, 'enviar'),
        puedeAsignar: esGestorGlobal && tienePermiso(modulo, 'asignar'),
      }
    }

    // Computar ownership según la forma del registro.
    const esCreador = registro.creado_por === usuarioId
    const esAsignadoUnico = registro.asignado_a === usuarioId
    const enAsignadosIds = (registro.asignados_ids ?? []).includes(usuarioId)
    const enAsignados = (registro.asignados ?? []).some(a => a.usuario_id === usuarioId)
    const enResponsables = (registro.responsables ?? []).some(r => r.usuario_id === usuarioId)
    const tieneOwnership = esCreador || esAsignadoUnico || enAsignadosIds || enAsignados || enResponsables

    // Criterio estándar:
    //  - editar/eliminar/enviar/asignar: basta con tener el permiso del módulo.
    //    El servidor valida de nuevo al recibir la mutación.
    //  - completar: además exige ownership (quien hace el trabajo lo marca).
    const puedeEditar = tienePermiso(modulo, 'editar')
    const puedeEliminar = tienePermiso(modulo, 'eliminar')
    const puedeCompletar = tienePermiso(modulo, 'completar') && (esGestorGlobal || tieneOwnership)
    const puedeEnviar = tienePermiso(modulo, 'enviar')
    const puedeAsignar = tienePermiso(modulo, 'asignar')

    return {
      tieneOwnership,
      esGestorGlobal,
      puedeEditar,
      puedeEliminar,
      puedeCompletar,
      puedeEnviar,
      puedeAsignar,
    }
  }, [modulo, registro, usuarioId, tienePermiso, esAdmin, esPropietario])
}
