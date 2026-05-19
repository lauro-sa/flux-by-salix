'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  obtenerMinimizados,
  obtenerMinimizadosSSR,
  suscribirPaneles,
} from '@/lib/paneles-flotantes/gestor-paneles-flotantes'

/**
 * useMinimizable — Para cada host de panel lateral (BotonFlotanteSalixIA,
 * BotonFlotanteNotas, BotonFlotanteRecordatorios, EditorPresupuesto del
 * armador). Reacciona a los eventos globales `flux:minimizar-paneles` y
 * `flux:restaurar-paneles` que emite el gestor cuando el usuario hace
 * doble click afuera o toca el FAB con minimizados pendientes.
 *
 * Comportamiento:
 *  - Si llega "minimizar" con un id que matchea: setAbierto(false) para
 *    cerrar visualmente el panel sin disparar su `onCerrar` permanente.
 *  - Si llega "restaurar" con un id que matchea: setAbierto(true) para
 *    reabrir el panel.
 *
 * Uso típico en un host:
 *   const [abierto, setAbierto] = useState(false)
 *   useMinimizable({ id: 'salix-chat', setAbierto })
 */

interface OpcionesMinimizable {
  id: string
  setAbierto: (abierto: boolean) => void
}

export function useMinimizable({ id, setAbierto }: OpcionesMinimizable) {
  useEffect(() => {
    const onMinimizar = (e: Event) => {
      const detalle = (e as CustomEvent<string[]>).detail
      if (Array.isArray(detalle) && detalle.includes(id)) {
        setAbierto(false)
      }
    }
    const onRestaurar = (e: Event) => {
      const detalle = (e as CustomEvent<string[]>).detail
      if (Array.isArray(detalle) && detalle.includes(id)) {
        setAbierto(true)
      }
    }
    window.addEventListener('flux:minimizar-paneles', onMinimizar)
    window.addEventListener('flux:restaurar-paneles', onRestaurar)
    return () => {
      window.removeEventListener('flux:minimizar-paneles', onMinimizar)
      window.removeEventListener('flux:restaurar-paneles', onRestaurar)
    }
  }, [id, setAbierto])
}

/** Hook para que el FAB sepa si hay paneles minimizados pendientes
 *  (para mostrar un indicador visual y, al clickear, restaurarlos). */
export function useMinimizadosFlotantes() {
  return useSyncExternalStore(
    suscribirPaneles,
    obtenerMinimizados,
    obtenerMinimizadosSSR,
  )
}
