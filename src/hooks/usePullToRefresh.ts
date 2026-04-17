'use client'

import { useRef, useCallback, useState } from 'react'

/**
 * usePullToRefresh — Gesto de pull-to-refresh para listas en mobile.
 *
 * Retorna handlers para onTouchStart/Move/End y un estado de progreso.
 * El contenedor debe tener overflow-y: auto y estar en scrollTop === 0
 * para que el gesto se active.
 */

interface OpcionesPullToRefresh {
  onRefresh: () => Promise<void>
  /** Umbral en px para activar el refresh (default: 80) */
  umbral?: number
}

export function usePullToRefresh({ onRefresh, umbral = 80 }: OpcionesPullToRefresh) {
  const startYRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refrescando, setRefrescando] = useState(false)
  const activoRef = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const container = e.currentTarget as HTMLElement
    // Solo activar si estamos en el top del scroll
    if (container.scrollTop > 0 || refrescando) return
    startYRef.current = e.touches[0].clientY
    activoRef.current = true
  }, [refrescando])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!activoRef.current) return
    const diff = e.touches[0].clientY - startYRef.current
    if (diff < 0) {
      activoRef.current = false
      setPullDistance(0)
      return
    }
    // Resistencia: cuanto más tire, más resistencia
    const distancia = Math.min(diff * 0.4, 120)
    setPullDistance(distancia)
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!activoRef.current) return
    activoRef.current = false

    if (pullDistance >= umbral) {
      setRefrescando(true)
      setPullDistance(0)
      try {
        await onRefresh()
      } finally {
        setRefrescando(false)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, umbral, onRefresh])

  return {
    pullDistance,
    refrescando,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  }
}
