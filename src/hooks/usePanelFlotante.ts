'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  obtenerStackPaneles,
  obtenerStackPanelesSSR,
  obtenerMinimizados,
  obtenerMinimizadosSSR,
  suscribirPaneles,
  registrarPanel,
  promoverPanel,
  cerrarPanel,
  type PanelFlotanteRegistrado,
} from '@/lib/paneles-flotantes/gestor-paneles-flotantes'

/**
 * usePanelFlotante — Hook que cada panel lateral derecho usa para integrarse
 * a la cascada de paneles flotantes.
 *
 * Comportamiento:
 *  - Cuando `abierto=true`, registra el panel en el stack global. Al desmontar
 *    o cerrar, lo desregistra automáticamente.
 *  - Devuelve `posicion`, `total`, `esFrente`, y `traerAlFrente` para que el
 *    panel calcule su layout: si es frente va pegado al borde derecho; si
 *    está atrás se escalona y muestra un borde clickeable.
 *
 * Constantes visuales:
 *  - ANCHO_PANEL: 460px (mismo ancho de todos los paneles flotantes)
 *  - OFFSET_BORDE: 14px (cuánto asoma cada panel atrás por la izquierda
 *    del que tiene adelante — el borde clickeable)
 */

export const ANCHO_PANEL = 460
// OFFSET_BORDE: cuánto asoma cada panel atrás por la izquierda del que
// tiene adelante. También define el ancho de la solapa clickeable y el
// "aire" que tiene el texto vertical respecto a la línea de color. Subir
// este valor da más padding al texto pero hace que la cascada ocupe más
// espacio horizontal.
export const OFFSET_BORDE = 22

interface OpcionesPanelFlotante {
  id: string
  etiqueta: string
  /** Color de acento (clase Tailwind o valor CSS) para el borde clickeable
   *  cuando este panel está atrás. */
  colorAcento: string
  /** ¿El panel está abierto? Cuando pasa a true se registra; a false, se
   *  desregistra. */
  abierto: boolean
}

interface DatosPanelFlotante {
  /** Índice en el stack. 0 = frente, 1 = uno atrás, 2 = dos atrás, etc.
   *  -1 cuando el panel no está en stack (está minimizado o cerrado). */
  posicion: number
  /** Cantidad total de paneles en el stack (no incluye minimizados). */
  total: number
  /** ¿Este panel está al frente del stack? */
  esFrente: boolean
  /** ¿Este panel está actualmente registrado en el stack? */
  enStack: boolean
  /** ¿Está actualmente minimizado (oculto pero preserva su estado)? */
  minimizado: boolean
  /** Promueve este panel al frente. */
  traerAlFrente: () => void
  /** Cierra este panel definitivamente (lo saca del stack Y de minimizados). */
  cerrar: () => void
  /** Lista de todos los paneles atrás de este, en orden visual (el primero
   *  es el que está justo atrás). Útil para renderear las solapas/bordes. */
  panelesAtras: PanelFlotanteRegistrado[]
  /** El stack completo, por si el panel quiere usarlo para algo. */
  stack: PanelFlotanteRegistrado[]
}

export function usePanelFlotante({ id, etiqueta, colorAcento, abierto }: OpcionesPanelFlotante): DatosPanelFlotante {
  const stack = useSyncExternalStore(
    suscribirPaneles,
    obtenerStackPaneles,
    obtenerStackPanelesSSR,
  )
  const minimizados = useSyncExternalStore(
    suscribirPaneles,
    obtenerMinimizados,
    obtenerMinimizadosSSR,
  )

  // Registrar / desregistrar según abierto. Se reagrupa cuando cambia
  // etiqueta o color (raro, pero soportado).
  useEffect(() => {
    if (!abierto) return
    const cleanup = registrarPanel({ id, etiqueta, colorAcento })
    return cleanup
  }, [id, etiqueta, colorAcento, abierto])

  const posicion = stack.findIndex(p => p.id === id)
  const enStack = posicion >= 0
  const minimizado = minimizados.some(p => p.id === id)

  return {
    posicion: enStack ? posicion : -1,
    total: stack.length,
    esFrente: posicion === 0,
    enStack,
    minimizado,
    traerAlFrente: () => promoverPanel(id),
    cerrar: () => cerrarPanel(id),
    panelesAtras: enStack ? stack.slice(posicion + 1) : [],
    stack,
  }
}
