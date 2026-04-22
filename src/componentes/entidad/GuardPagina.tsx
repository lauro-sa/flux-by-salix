'use client'

/**
 * GuardPagina — wrapper que protege el render del contenido según permisos.
 *
 * Comportamiento:
 *  - Mientras cargan los permisos: renderiza null (evita flash de contenido).
 *  - Si el usuario no tiene el permiso requerido: renderiza <SinPermiso>,
 *    una pantalla explícita con botón "Volver al inicio". NO redirige
 *    silenciosamente.
 *  - Si tiene permiso: monta los children.
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
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import type { Modulo, Accion } from '@/tipos/permisos'

interface PropsGuardPagina {
  modulo: Modulo
  accion?: Accion
  redirigirA?: string
  children: ReactNode
}

export function GuardPagina({ modulo, accion, redirigirA, children }: PropsGuardPagina) {
  const { cargando, sinPermiso } = useGuardPermiso(modulo, { accion, redirigirA })
  if (cargando) return null
  if (sinPermiso) return <SinPermiso />
  return <>{children}</>
}
