'use client'

/**
 * useGuardPermiso — Redirige en vivo si el usuario pierde acceso al módulo
 * de la página actual.
 *
 * Escucha al contexto reactivo de permisos (`useRol`). Si el permiso requerido
 * deja de estar activo, empuja al usuario al dashboard y muestra un toast —
 * nunca queda viendo una pantalla sin autorización.
 *
 * Uso: invocarlo al inicio de cada página protegida con el módulo/acción
 * mínimos requeridos. Ej: en `/presupuestos` → `useGuardPermiso('presupuestos')`.
 *
 * Por default chequea "alguna forma de ver" (ver_propio, ver_todos o ver).
 * Si necesitás una acción específica, pasala como segundo argumento.
 */

import { useEffect, useRef } from 'react'
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

export function useGuardPermiso(modulo: Modulo, opciones: OpcionesGuard = {}) {
  const { accion, redirigirA = '/' } = opciones
  const { tienePermiso } = useRol()
  const { cargando } = usePermisosActuales()
  const router = useRouter()
  const toast = useToast()
  // Evita disparar el redirect mientras todavía no cargamos los permisos
  // frescos (entre el mount y el primer fetch el hook devuelve `cargando`).
  const yaRedirigio = useRef(false)

  useEffect(() => {
    if (cargando) return
    if (yaRedirigio.current) return

    const puede = accion
      ? tienePermiso(modulo, accion)
      : tieneAlgunVer(modulo, tienePermiso)

    if (!puede) {
      yaRedirigio.current = true
      const etiqueta = ETIQUETAS_MODULO[modulo] || modulo
      toast.mostrar('advertencia', `Ya no tenés permiso para ver ${etiqueta}.`)
      router.replace(redirigirA)
    }
  }, [cargando, modulo, accion, redirigirA, tienePermiso, router, toast])
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
