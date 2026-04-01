'use client'

import { useState, useCallback } from 'react'

/**
 * usePushNotificaciones — Registrar y desregistrar push notifications (Web Push API).
 * Registra el service worker, solicita permiso, obtiene suscripción y la envía al servidor.
 * Se usa en: SeccionNotificaciones (Mi Cuenta).
 */

interface EstadoPush {
  soportado: boolean
  permiso: NotificationPermission | 'no_soportado'
  suscrito: boolean
  cargando: boolean
}

function usePushNotificaciones() {
  const [estado, setEstado] = useState<EstadoPush>(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return { soportado: false, permiso: 'no_soportado', suscrito: false, cargando: false }
    }
    return {
      soportado: true,
      permiso: Notification.permission,
      suscrito: false,
      cargando: false,
    }
  })

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
      // Solicitar permiso
      const permiso = await Notification.requestPermission()
      setEstado(prev => ({ ...prev, permiso }))
      if (permiso !== 'granted') {
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Obtener VAPID public key del servidor
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada')
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Registrar service worker si no está registrado
      const reg = await navigator.serviceWorker.ready

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
