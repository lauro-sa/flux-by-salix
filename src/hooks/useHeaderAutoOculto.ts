'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useHeaderAutoOculto — Oculta el header al scrollear hacia abajo, lo muestra al scrollear hacia arriba.
 *
 * Patrón tipo Twitter/Instagram para ganar espacio en móvil.
 * Solo funciona cuando el scroll es del documento (mobile browser).
 * En desktop/PWA (layout fijo con overflow:hidden) el scroll no es del window → no aplica.
 *
 * Retorna `oculto: boolean` que se usa para aplicar una clase CSS con transform.
 */

/** Distancia mínima de scroll para activar hide/show (evita micro-scrolls) */
const UMBRAL = 10

export function useHeaderAutoOculto(): boolean {
  const [oculto, setOculto] = useState(false)
  const ultimoScrollRef = useRef(0)
  const rafRef = useRef<number>(0)

  const manejarScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const scrollY = window.scrollY
      const diferencia = scrollY - ultimoScrollRef.current

      if (diferencia > UMBRAL) {
        // Scrolleando hacia abajo → ocultar
        setOculto(true)
        ultimoScrollRef.current = scrollY
      } else if (diferencia < -UMBRAL) {
        // Scrolleando hacia arriba → mostrar
        setOculto(false)
        ultimoScrollRef.current = scrollY
      }

      // Si estamos arriba del todo, siempre mostrar
      if (scrollY <= 0) {
        setOculto(false)
        ultimoScrollRef.current = 0
      }
    })
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', manejarScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', manejarScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [manejarScroll])

  return oculto
}
