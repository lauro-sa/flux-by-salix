'use client'

import { useEffect, useRef } from 'react'

const HEARTBEAT_MS = 5 * 60 * 1000 // cada 5 minutos

/**
 * useHeartbeatAsistencia — Envía heartbeats de actividad cada 5 min
 * solo si la pestaña está visible. Para fichaje automático y tracking.
 * Se monta una sola vez en el layout principal.
 */
export function useHeartbeatAsistencia() {
  const intervaloRef = useRef<ReturnType<typeof setInterval>>(null)
  const enviadoLoginRef = useRef(false)

  useEffect(() => {
    const enviarHeartbeat = async (tipo: 'heartbeat' | 'login' | 'beforeunload' | 'visibility' = 'heartbeat') => {
      try {
        await fetch('/api/asistencias/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo,
            metadata: {
              navegador: navigator.userAgent.includes('Chrome') ? 'Chrome' :
                navigator.userAgent.includes('Firefox') ? 'Firefox' :
                navigator.userAgent.includes('Safari') ? 'Safari' : 'Otro',
              pestana_visible: document.visibilityState === 'visible',
            },
          }),
          // No esperar respuesta para no bloquear
          keepalive: true,
        })
      } catch {
        // Silenciar errores de heartbeat
      }
    }

    // Enviar login al montar (primera vez)
    if (!enviadoLoginRef.current) {
      enviadoLoginRef.current = true
      enviarHeartbeat('login')
    }

    // Intervalo cada 5 minutos (solo si visible)
    intervaloRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        enviarHeartbeat('heartbeat')
      }
    }, HEARTBEAT_MS)

    // Listener de visibilidad
    const onVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        enviarHeartbeat('visibility')
      }
    }
    document.addEventListener('visibilitychange', onVisibilidad)

    // Listener de cierre de pestaña
    const onBeforeUnload = () => {
      enviarHeartbeat('beforeunload')
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      document.removeEventListener('visibilitychange', onVisibilidad)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])
}
