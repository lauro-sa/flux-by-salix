'use client'

import { useMemo } from 'react'
import { useRol } from '@/hooks/useRol'
import { useAuth } from '@/hooks/useAuth'
import { calcularPermisosFila, type PermisosFila, type RegistroConOwnership } from '@/lib/permisos-fila'
import type { Modulo } from '@/tipos'

/**
 * usePermisosFila — Hook compartido para decidir qué botones mostrar sobre
 * un registro dado (fila de tabla, tarjeta, detalle, etc.).
 *
 * Thin wrapper de `calcularPermisosFila` (lib/permisos-fila.ts) que le inyecta
 * `tienePermiso` desde useRol y el `usuarioId` desde useAuth. La lógica de
 * ownership y el criterio por acción viven en la función pura — tiene tests
 * propios que no montan providers de React.
 *
 * Uso típico:
 * ```tsx
 * const permisos = usePermisosFila('actividades', actividad)
 * {permisos.puedeEditar && <Boton onClick={editar}>Editar</Boton>}
 * ```
 */

export type { RegistroConOwnership, PermisosFila }

export function usePermisosFila(
  modulo: Modulo,
  registro: RegistroConOwnership | null | undefined,
): PermisosFila {
  const { tienePermiso, esAdmin, esPropietario } = useRol()
  const { usuario } = useAuth()
  const usuarioId = usuario?.id ?? null

  return useMemo<PermisosFila>(
    () => calcularPermisosFila(modulo, registro, usuarioId, tienePermiso, { esAdmin, esPropietario }),
    [modulo, registro, usuarioId, tienePermiso, esAdmin, esPropietario],
  )
}
