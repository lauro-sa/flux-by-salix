'use client'

/**
 * useGuardPermiso — guard reactivo de página.
 *
 * Funcionalidad:
 * 1. Mientras los permisos están cargando (primera request), devuelve
 *    `bloqueado: true` para que la página NO renderice contenido sensible.
 * 2. Una vez cargados, si el usuario no tiene el permiso requerido, redirige
 *    al dashboard con toast y mantiene `bloqueado: true`.
 * 3. Si tiene permiso, `bloqueado: false` y la página se renderiza.
 * 4. Reacciona en vivo: si un admin quita el permiso mientras el usuario
 *    está en la página, se activa `bloqueado` y se dispara el redirect.
 *
 * Uso típico al inicio de un ContenidoXxx client component:
 *
 * ```
 * const { bloqueado } = useGuardPermiso('presupuestos')
 * if (bloqueado) return null  // o un loader
 * ```
 */

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRol } from './useRol'
import { usePermisosActuales } from './usePermisosActuales'
import { useToast } from '@/componentes/feedback/Toast'
import { ACCIONES_POR_MODULO, ETIQUETAS_MODULO } from '@/tipos/permisos'
import type { Modulo, Accion } from '@/tipos/permisos'

interface OpcionesGuard {
  /** Acción específica requerida. Si no, verifica que tenga alguna de "ver". */
  accion?: Accion
  /** A dónde redirigir si pierde acceso. Default: '/'. */
  redirigirA?: string
}

interface ResultadoGuard {
  /** true mientras se cargan permisos o si el usuario no tiene permiso. */
  bloqueado: boolean
  /** true durante la primera carga de permisos. */
  cargando: boolean
}

export function useGuardPermiso(modulo: Modulo, opciones: OpcionesGuard = {}): ResultadoGuard {
  const { accion, redirigirA = '/' } = opciones
  const { tienePermiso } = useRol()
  const { cargando } = usePermisosActuales()
  const router = useRouter()
  const toast = useToast()
  const yaRedirigio = useRef(false)

  // Chequeo sincrónico del permiso: válido solo cuando ya se cargaron los
  // permisos; durante la carga inicial lo tratamos como false para no
  // renderizar contenido que después habría que ocultar.
  const puede = useMemo(() => {
    if (cargando) return false
    return accion ? tienePermiso(modulo, accion) : tieneAlgunVer(modulo, tienePermiso)
  }, [cargando, modulo, accion, tienePermiso])

  useEffect(() => {
    if (cargando) return
    if (yaRedirigio.current) return
    if (puede) return

    yaRedirigio.current = true
    const etiqueta = ETIQUETAS_MODULO[modulo] || modulo
    toast.mostrar('advertencia', `Ya no tenés permiso para ver ${etiqueta}.`)
    router.replace(redirigirA)
  }, [cargando, puede, modulo, redirigirA, router, toast])

  return { bloqueado: cargando || !puede, cargando }
}

/** ¿Tiene el usuario alguna de las acciones de "ver" para este módulo? */
function tieneAlgunVer(
  modulo: Modulo,
  tienePermiso: (m: Modulo, a: Accion) => boolean,
): boolean {
  const posibles = ACCIONES_POR_MODULO[modulo] || []
  if (posibles.includes('ver_todos') && tienePermiso(modulo, 'ver_todos')) return true
  if (posibles.includes('ver_propio') && tienePermiso(modulo, 'ver_propio')) return true
  if (posibles.includes('ver') && tienePermiso(modulo, 'ver')) return true
  return false
}
