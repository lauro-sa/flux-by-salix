'use client'

import { useEffect } from 'react'

/**
 * RegistroSW — Registra el service worker para PWA.
 * Escucha mensajes del SW para navegación al click en notificaciones push.
 * Se monta en el layout raíz, solo en producción.
 */
export function RegistroSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silenciar errores — en dev puede fallar por HMR
    })

    /* Escuchar mensajes del SW (ej. click en notificación push → navegar a URL) */
    const handleMensajeSW = (event: MessageEvent) => {
      if (event.data?.type === 'NAVEGAR' && event.data.url) {
        const url = event.data.url as string
        /* Si es una URL relativa, navegar con el router del navegador */
        if (url.startsWith('/')) {
          window.location.href = url
        } else if (url.startsWith(window.location.origin)) {
          window.location.href = url
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMensajeSW)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMensajeSW)
    }
  }, [])

  return null
}
