'use client'

/**
 * GuardPagina — wrapper que protege el render del contenido según permisos.
 *
 * Llama `useGuardPermiso` internamente. Mientras los permisos cargan o si el
 * usuario no tiene acceso al módulo, renderiza null (y redirige al dashboard
 * con toast si pierde el permiso). Solo cuando el acceso está confirmado,
 * monta los children.
 *
 * IMPORTANTE: siempre envolver al contenido desde afuera, nunca hacer
 * `const { bloqueado } = useGuardPermiso(...); if (bloqueado) return null`
 * en medio de otros hooks. Ese antipatrón rompe las Rules of Hooks porque el
 * número de hooks del componente cambia entre renders (cuando `bloqueado`
 * transiciona de true a false al llegar los permisos, o viceversa en
 * Realtime), causando errores #310 y #300 de React en producción.
 *
 * Uso típico:
 * ```
 * function ContenidoXxxInterno() { ...hooks del módulo... }
 * export default function ContenidoXxx() {
 *   return <GuardPagina modulo="presupuestos"><ContenidoXxxInterno /></GuardPagina>
 * }
 * ```
 */

import type { ReactNode } from 'react'
import { useGuardPermiso } from '@/hooks/useGuardPermiso'
import type { Modulo, Accion } from '@/tipos/permisos'

interface PropsGuardPagina {
  modulo: Modulo
  accion?: Accion
  redirigirA?: string
  children: ReactNode
}

export function GuardPagina({ modulo, accion, redirigirA, children }: PropsGuardPagina) {
  const { bloqueado } = useGuardPermiso(modulo, { accion, redirigirA })
  if (bloqueado) return null
  return <>{children}</>
}
