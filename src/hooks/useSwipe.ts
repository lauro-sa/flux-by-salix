'use client'

import { useRef, useCallback, type RefObject } from 'react'

interface OpcionesSwipe {
  /** Callback cuando se hace swipe a la izquierda */
  onSwipeIzquierda?: () => void
  /** Callback cuando se hace swipe a la derecha */
  onSwipeDerecha?: () => void
  /** Distancia mínima en px para considerar swipe (default: 50) */
  umbral?: number
}

/**
 * useSwipe — Hook para detectar gestos de swipe en elementos.
 * Se usa en el drawer del sidebar para cerrar con swipe hacia la izquierda.
 */
export function useSwipe({ onSwipeIzquierda, onSwipeDerecha, umbral = 50 }: OpcionesSwipe) {
  const inicioX = useRef(0)
  const inicioY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    inicioX.current = e.touches[0].clientX
    inicioY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const finX = e.changedTouches[0].clientX
    const finY = e.changedTouches[0].clientY
    const diffX = finX - inicioX.current
    const diffY = finY - inicioY.current

    // Solo considerar swipe horizontal (más horizontal que vertical)
    if (Math.abs(diffX) < umbral || Math.abs(diffX) < Math.abs(diffY)) return

    if (diffX < 0 && onSwipeIzquierda) onSwipeIzquierda()
    if (diffX > 0 && onSwipeDerecha) onSwipeDerecha()
  }, [onSwipeIzquierda, onSwipeDerecha, umbral])

  return { onTouchStart, onTouchEnd }
}
