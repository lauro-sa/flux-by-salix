'use client'

/**
 * GuardPagina — redirige al dashboard si el usuario pierde acceso al módulo
 * de la página actual. Reacciona en vivo al contexto reactivo de permisos.
 *
 * Es un hook + componente invisible que se invoca al inicio de cada ContenidoXxx.
 * No bloquea el render aquí mismo: el bloqueo lo hace `useGuardPermiso` vía
 * `bloqueado` que devuelve. Los ContenidoXxx lo usan así:
 *
 * ```
 * const { bloqueado } = useGuardPermiso('presupuestos')
 * if (bloqueado) return null
 * ```
 *
 * O más cómodo, con el wrapper `<ProtegerPagina modulo="...">{children}</ProtegerPagina>`.
 */

import { useGuardPermiso } from '@/hooks/useGuardPermiso'
import type { Modulo, Accion } from '@/tipos/permisos'

interface PropsGuardPagina {
  modulo: Modulo
  accion?: Accion
  redirigirA?: string
}

export function GuardPagina({ modulo, accion, redirigirA }: PropsGuardPagina) {
  useGuardPermiso(modulo, { accion, redirigirA })
  return null
}
