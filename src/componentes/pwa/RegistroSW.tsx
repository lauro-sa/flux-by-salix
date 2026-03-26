'use client'

import { useEffect } from 'react'

/**
 * RegistroSW — Registra el service worker para PWA.
 * Se monta en el layout raíz, solo en producción.
 */
export function RegistroSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silenciar errores de registro en desarrollo
      })
    }
  }, [])

  return null
}
