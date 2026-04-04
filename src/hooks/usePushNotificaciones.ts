'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * usePushNotificaciones — Registrar y desregistrar push notifications (Web Push API).
 *
 * iOS requiere:
 * - La app DEBE estar instalada como PWA (standalone)
 * - El permiso se pide DENTRO de la PWA (no desde Safari browser)
 * - iOS 16.4+ soporta Web Push en PWAs standalone
 *
 * Se usa en: SeccionNotificaciones (Mi Cuenta).
 */

interface EstadoPush {
  soportado: boolean
  permiso: NotificationPermission | 'no_soportado'
  suscrito: boolean
  cargando: boolean
  /** true si es iOS y NO está en standalone → push no va a funcionar */
  requiereInstalacion: boolean
}

function usePushNotificaciones() {
  const [estado, setEstado] = useState<EstadoPush>(() => ({
    soportado: false,
    permiso: 'no_soportado',
    suscrito: false,
    cargando: false,
    requiereInstalacion: false,
  }))

  // Inicializar post-mount (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tieneNotification = 'Notification' in window
    const tieneSW = 'serviceWorker' in navigator

    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream
    const esStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    // iOS necesita estar instalada como PWA para push
    const requiereInstalacion = esIOS && !esStandalone

    const soportado = tieneNotification && tieneSW && !requiereInstalacion

    setEstado({
      soportado,
      permiso: tieneNotification ? Notification.permission : 'no_soportado',
      suscrito: false,
      cargando: false,
      requiereInstalacion,
    })
  }, [])

  /** Verificar si ya hay suscripción activa */
  const verificar = useCallback(async () => {
    if (!estado.soportado) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      const suscrito = !!sub
      setEstado(prev => ({ ...prev, suscrito, permiso: Notification.permission }))
      return suscrito
    } catch {
      return false
    }
  }, [estado.soportado])

  /** Suscribirse a push notifications */
  const suscribir = useCallback(async (): Promise<boolean> => {
    if (!estado.soportado) return false
    setEstado(prev => ({ ...prev, cargando: true }))

    try {
      // Solicitar permiso (con timeout para iOS que puede colgarse)
      const permiso = await Promise.race([
        Notification.requestPermission(),
        new Promise<NotificationPermission>((_, reject) =>
          setTimeout(() => reject(new Error('Permission timeout')), 15000)
        ),
      ])
      setEstado(prev => ({ ...prev, permiso }))
      if (permiso !== 'granted') {
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Obtener VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada')
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Esperar service worker con timeout (15s)
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SW timeout')), 15000)
        ),
      ])

      // Suscribirse al push
      const suscripcion = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      // Enviar al servidor
      const keys = suscripcion.toJSON().keys as { p256dh: string; auth: string }
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: suscripcion.endpoint,
          keys,
        }),
      })

      if (!res.ok) throw new Error('Error al registrar push')

      setEstado(prev => ({ ...prev, suscrito: true, cargando: false }))
      return true
    } catch (err) {
      console.error('Error suscribiendo push:', err)
      setEstado(prev => ({ ...prev, cargando: false }))
      return false
    }
  }, [estado.soportado])

  /** Desuscribirse */
  const desuscribir = useCallback(async (): Promise<boolean> => {
    if (!estado.soportado) return false
    setEstado(prev => ({ ...prev, cargando: true }))

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        // Eliminar del servidor
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        // Desuscribir localmente
        await sub.unsubscribe()
      }

      setEstado(prev => ({ ...prev, suscrito: false, cargando: false }))
      return true
    } catch (err) {
      console.error('Error desuscribiendo push:', err)
      setEstado(prev => ({ ...prev, cargando: false }))
      return false
    }
  }, [estado.soportado])

  return { ...estado, verificar, suscribir, desuscribir }
}

/** Convierte VAPID key de base64 a Uint8Array para pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export { usePushNotificaciones }
