'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useToast } from '@/componentes/feedback/Toast'

const HEARTBEAT_MS = 5 * 60 * 1000       // enviar heartbeat cada 5 min si hay actividad
const INACTIVIDAD_MS = 30 * 60 * 1000    // 30 min sin actividad = inactivo
const ACTIVIDAD_DEBOUNCE_MS = 30 * 1000  // registrar actividad cada 30s máximo

/**
 * useHeartbeatAsistencia — Sistema de fichaje automático inteligente.
 *
 * Detecta actividad real del usuario (mouse, teclado, scroll, clicks) y:
 * 1. Envía heartbeats al servidor cada 5 min mientras hay actividad
 * 2. El servidor crea entrada automática en el primer heartbeat del día
 * 3. Cada heartbeat actualiza hora_salida de forma rolling (salida provisoria)
 * 4. Si pasan 30 min sin actividad, deja de enviar heartbeats → la última
 *    hora_salida queda como salida provisoria
 * 5. Si el usuario vuelve a interactuar, reanuda los heartbeats
 * 6. Muestra notificación toast cuando se ficha la entrada automáticamente
 *
 * Se monta una sola vez en PlantillaApp.
 */
export function useHeartbeatAsistencia() {
  const { mostrar } = useToast()

  // Refs para estado persistente entre renders
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enviadoLoginRef = useRef(false)
  const ultimaActividadRef = useRef(Date.now())
  const ultimoDebounceRef = useRef(0)
  const entradaCreadaHoyRef = useRef(false)
  const estaActivoRef = useRef(true) // si el usuario está activo (no inactivo 30min)

  // Enviar heartbeat al servidor
  const enviarHeartbeat = useCallback(async (
    tipo: 'heartbeat' | 'login' | 'beforeunload' | 'visibility' = 'heartbeat'
  ) => {
    try {
      const tiempoDesdeUltimaActividad = Date.now() - ultimaActividadRef.current

      const res = await fetch('/api/asistencias/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          metadata: {
            navegador: navigator.userAgent.includes('Chrome') ? 'Chrome' :
              navigator.userAgent.includes('Firefox') ? 'Firefox' :
              navigator.userAgent.includes('Safari') ? 'Safari' : 'Otro',
            pestana_visible: document.visibilityState === 'visible',
            ultimo_input_hace_ms: tiempoDesdeUltimaActividad,
          },
        }),
        keepalive: tipo === 'beforeunload',
      })

      // Si no es beforeunload, leer la respuesta para saber si se creó entrada
      if (tipo !== 'beforeunload' && res.ok) {
        const data = await res.json()

        if (data.accion === 'entrada_creada' && !entradaCreadaHoyRef.current) {
          entradaCreadaHoyRef.current = true

          // Formatear la hora de entrada para el toast
          const horaEntrada = new Date(data.hora_entrada)
          const horaStr = horaEntrada.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          })

          // Mostrar toast de fichaje (duración larga: 40 segundos para que la vea)
          mostrar(
            'exito',
            `Entrada registrada a las ${horaStr}. Tu jornada fue fichada automáticamente.`,
            40000
          )
        }

        // Retorno automático de almuerzo/trámite
        if (data.accion === 'retorno_automatico') {
          const etiqueta = data.retorno_de === 'almuerzo' ? 'almuerzo' : 'trámite'
          mostrar('info', `Retorno de ${etiqueta} registrado automáticamente.`, 10000)
        }
      }
    } catch {
      // Silenciar errores de heartbeat — no es crítico
    }
  }, [mostrar])

  useEffect(() => {
    // Registrar actividad del usuario (debounced)
    const registrarActividad = () => {
      const ahora = Date.now()
      ultimaActividadRef.current = ahora

      // Si estaba inactivo, marcar como activo de nuevo
      if (!estaActivoRef.current) {
        estaActivoRef.current = true
        // Enviar heartbeat inmediato al reactivarse (reanuda la salida rolling)
        enviarHeartbeat('visibility')
      }

      // Debounce: no registrar más de 1 vez cada 30 segundos
      if (ahora - ultimoDebounceRef.current < ACTIVIDAD_DEBOUNCE_MS) return
      ultimoDebounceRef.current = ahora
    }

    // Eventos de actividad real del usuario
    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const
    for (const evento of eventos) {
      document.addEventListener(evento, registrarActividad, { passive: true })
    }

    // Enviar login al montar (primera vez del día)
    if (!enviadoLoginRef.current) {
      enviadoLoginRef.current = true
      enviarHeartbeat('login')
    }

    // Intervalo cada 5 minutos
    intervaloRef.current = setInterval(() => {
      const tiempoInactivo = Date.now() - ultimaActividadRef.current

      if (tiempoInactivo >= INACTIVIDAD_MS) {
        // Más de 30 min sin actividad → no enviar heartbeat
        // La última hora_salida en el servidor queda como salida provisoria
        estaActivoRef.current = false
        return
      }

      // Solo enviar si la pestaña está visible Y hay actividad reciente
      if (document.visibilityState === 'visible') {
        enviarHeartbeat('heartbeat')
      }
    }, HEARTBEAT_MS)

    // Listener de visibilidad (cuando vuelve a la pestaña)
    const onVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        // Registrar como actividad
        ultimaActividadRef.current = Date.now()
        estaActivoRef.current = true
        enviarHeartbeat('visibility')
      }
    }
    document.addEventListener('visibilitychange', onVisibilidad)

    // Listener de cierre de pestaña
    const onBeforeUnload = () => {
      enviarHeartbeat('beforeunload')
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // Reset diario: cuando cambia el día, resetear la flag de entrada creada
    const checkDiario = setInterval(() => {
      const hora = new Date().getHours()
      if (hora === 0) {
        entradaCreadaHoyRef.current = false
      }
    }, 60 * 60 * 1000) // verificar cada hora

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      clearInterval(checkDiario)
      document.removeEventListener('visibilitychange', onVisibilidad)
      window.removeEventListener('beforeunload', onBeforeUnload)
      for (const evento of eventos) {
        document.removeEventListener(evento, registrarActividad)
      }
    }
  }, [enviarHeartbeat])
}
