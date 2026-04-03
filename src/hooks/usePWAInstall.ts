'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * usePWAInstall — Detecta si la app se puede instalar como PWA.
 *
 * - Android/Chrome: captura el evento `beforeinstallprompt` para mostrar prompt nativo.
 * - iOS Safari: detecta si se puede agregar a Home Screen (no hay API nativa).
 * - Si ya está instalada (standalone), no muestra nada.
 *
 * Se usa en: BannerInstalacion y cualquier lugar donde se quiera sugerir instalar.
 */

interface EstadoInstalacion {
  /** true si se puede mostrar el banner */
  puedeInstalar: boolean
  /** true si ya está instalada como PWA */
  yaInstalada: boolean
  /** true si es iOS y se debe mostrar instrucciones manuales */
  esIOS: boolean
  /** Dispara el prompt nativo de instalación (solo Chrome/Android) */
  instalar: () => Promise<void>
  /** Oculta el banner (el usuario lo descartó) */
  descartar: () => void
}

const CLAVE_DESCARTADO = 'flux_pwa_descartado'

export function usePWAInstall(): EstadoInstalacion {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [descartado, setDescartado] = useState(false)

  // Detectar si ya está instalada
  const yaInstalada = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )

  // Detectar iOS
  const esIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream

  // Verificar si fue descartado antes
  useEffect(() => {
    try {
      const valor = localStorage.getItem(CLAVE_DESCARTADO)
      if (valor) {
        const ts = parseInt(valor, 10)
        // Mostrar de nuevo después de 7 días
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
          setDescartado(true)
        }
      }
    } catch { /* localStorage no disponible */ }
  }, [])

  // Capturar beforeinstallprompt (Chrome/Android)
  useEffect(() => {
    if (yaInstalada) return

    const manejar = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', manejar)
    return () => window.removeEventListener('beforeinstallprompt', manejar)
  }, [yaInstalada])

  const instalar = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  const descartar = useCallback(() => {
    setDescartado(true)
    try {
      localStorage.setItem(CLAVE_DESCARTADO, String(Date.now()))
    } catch { /* silenciar */ }
  }, [])

  const puedeInstalar = !yaInstalada && !descartado && (!!deferredPrompt || esIOS)

  return { puedeInstalar, yaInstalada, esIOS, instalar, descartar }
}

/* Tipo del evento beforeinstallprompt (no es estándar, no está en lib.dom) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
