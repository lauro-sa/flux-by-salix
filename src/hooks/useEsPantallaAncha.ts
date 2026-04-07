'use client'

/**
 * useEsPantallaAncha — Detecta si el viewport es >= 1400px.
 * Usado para decidir si el chatter va al costado (lateral) o abajo (inferior).
 * SSR-safe: devuelve false durante SSR.
 * Se usa en: EditorPresupuesto, y cualquier vista con PanelChatter lateral.
 */

import { useState, useEffect } from 'react'

const QUERY = '(min-width: 1400px)'

export function useEsPantallaAncha(): boolean {
  const [ancha, setAncha] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    setAncha(mql.matches)

    const manejar = (e: MediaQueryListEvent) => setAncha(e.matches)
    mql.addEventListener('change', manejar)
    return () => mql.removeEventListener('change', manejar)
  }, [])

  return ancha
}
