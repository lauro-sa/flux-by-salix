'use client'

import { useState, useEffect } from 'react'

/**
 * Hook que detecta si el usuario prefiere movimiento reducido.
 * Útil para desactivar animaciones en móviles lentos o usuarios con sensibilidad.
 * También detecta dispositivos touch para reducir hover animations.
 * Se usa en: componentes del calendario y otros con animaciones pesadas.
 */
function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const manejar = (e: MediaQueryListEvent) => setReducido(e.matches)
    mq.addEventListener('change', manejar)
    return () => mq.removeEventListener('change', manejar)
  }, [])

  return reducido
}

/** Detecta si el dispositivo es touch (no tiene hover preciso) */
function useSoportaHover(): boolean {
  const [soporta, setSoporta] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(hover: hover)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    const manejar = (e: MediaQueryListEvent) => setSoporta(e.matches)
    mq.addEventListener('change', manejar)
    return () => mq.removeEventListener('change', manejar)
  }, [])

  return soporta
}

export { useMovimientoReducido, useSoportaHover }
