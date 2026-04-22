'use client'

/**
 * GuardPagina — componente invisible que redirige al dashboard si el usuario
 * pierde permiso al módulo actual mientras está en la página.
 *
 * Uso: `<GuardPagina modulo="presupuestos" />` al inicio del render de cada
 * ContenidoXxx. Reacciona en vivo a cambios de permisos propagados por
 * ProveedorPermisos (suscripción realtime a la fila del miembro).
 *
 * Se provee además `accion` si la página requiere una acción distinta de
 * "alguna forma de ver".
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
