'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * usePushNotificaciones — Registrar y desregistrar push notifications via FCM.
 *
 * Usa Firebase Cloud Messaging que internamente enruta a APNs para iOS.
 * Esto resuelve el problema de web-push directo que Apple descartaba silenciosamente.
 *
 * iOS requiere:
 * - La app DEBE estar instalada como PWA (standalone)
 * - El permiso se pide DENTRO de la PWA (no desde Safari browser)
 *
 * Se usa en: SeccionNotificaciones (Mi Cuenta).
 */

// VAPID key de FCM (Cloud Messaging → Web Push certificates)
const FCM_VAPID_KEY = 'BFFijjNwAopPTNWvLV8sGAn3cy1O00rp3Af3GFjVSRDzYUzcYqYe2O8a4Qi3R1D8F6eWpbb5e4FW3ChDwGzUWS4'

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

  /**
   * Verificar si ya hay token FCM guardado.
   * Si el token cambió (nuevo deploy, nuevo SW), re-registra automáticamente.
   */
  const verificar = useCallback(async () => {
    if (!estado.soportado) return false
    if (Notification.permission !== 'granted') return false

    try {
      const tokenGuardado = localStorage.getItem('flux_fcm_token')
      const suscrito = !!tokenGuardado
      setEstado(prev => ({ ...prev, suscrito, permiso: Notification.permission }))
      return suscrito
    } catch {
      return false
    }
  }, [estado.soportado])

  /** Suscribirse a push notifications via FCM */
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

      // Esperar service worker con timeout (15s)
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) =>
          setTimeout(() => reject(new Error('SW timeout')), 15000)
        ),
      ])

      // Asegurar que el SW esté activo (race con skipWaiting)
      if (!reg.active) {
        await new Promise<void>((resolve) => {
          const sw = reg.installing || reg.waiting
          if (!sw) return resolve()
          const onCambio = () => {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', onCambio)
              resolve()
            }
          }
          sw.addEventListener('statechange', onCambio)
          if (sw.state === 'activated') resolve()
        })
      }

      // Importar Firebase Messaging dinámicamente (evita cargar en SSR)
      const { obtenerMensajeria } = await import('@/lib/firebase')
      const { getToken } = await import('firebase/messaging')
      const mensajeria = await obtenerMensajeria()
      if (!mensajeria) {
        console.error('Firebase Messaging no soportado')
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Obtener token FCM usando el SW existente y la VAPID key de FCM
      const token = await getToken(mensajeria, {
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: reg,
      })

      if (!token) {
        console.error('No se obtuvo token FCM')
        setEstado(prev => ({ ...prev, cargando: false }))
        return false
      }

      // Detectar rotación de token: si cambió, eliminar el viejo del servidor
      const tokenAnterior = localStorage.getItem('flux_fcm_token')
      if (tokenAnterior && tokenAnterior !== token) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenAnterior }),
        }).catch(() => {})
      }

      // Enviar token al servidor
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) throw new Error('Error al registrar push')

      // Guardar token para detectar rotación
      localStorage.setItem('flux_fcm_token', token)

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
      const token = localStorage.getItem('flux_fcm_token')
      if (token) {
        // Eliminar del servidor
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      }

      localStorage.removeItem('flux_fcm_token')
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

export { usePushNotificaciones }
