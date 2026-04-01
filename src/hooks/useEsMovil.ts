'use client'

/**
 * useEsMovil — Detecta si el dispositivo es móvil/táctil.
 * Usa la misma lógica que los tokens CSS: (pointer: coarse) OR (max-width: 768px).
 * Se actualiza en tiempo real si cambia el viewport (ej: rotar tablet).
 *
 * SSR-safe: devuelve false durante SSR e hydration, luego sincroniza en mount.
 * Esto evita hydration mismatch porque el primer render siempre es desktop (Modal),
 * y en el siguiente tick se actualiza a mobile (BottomSheet) si corresponde.
 *
 * Se usa en: ModalAdaptable, PopoverAdaptable, layouts responsivos.
 */

import { useState, useEffect } from 'react'

const QUERY = '(pointer: coarse), (max-width: 768px)'

export function useEsMovil(): boolean {
  // Siempre arranca en false para evitar hydration mismatch con SSR
  const [esMovil, setEsMovil] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    // Sincronizar valor real post-mount
    setEsMovil(mql.matches)

    const manejar = (e: MediaQueryListEvent) => setEsMovil(e.matches)
    mql.addEventListener('change', manejar)
    return () => mql.removeEventListener('change', manejar)
  }, [])

  return esMovil
}
