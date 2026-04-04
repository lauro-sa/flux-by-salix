'use client'

import { useEffect } from 'react'

/**
 * RegistroSW — Registra el service worker para PWA.
 * Se monta en el layout raíz, solo en producción.
 */
export function RegistroSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silenciar errores — en dev puede fallar por HMR
      })
    }
  }, [])

  return null
}
