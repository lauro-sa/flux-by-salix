'use client'

/**
 * useSalixIA — Hook para gestionar el estado del chat con Salix IA.
 * Maneja: streaming SSE, mensajes, loading, conversación actual.
 */

import { useState, useCallback, useRef } from 'react'

interface MensajeChat {
  id: string
  rol: 'usuario' | 'asistente'
  contenido: string
  timestamp: string
  herramientas?: string[]
  cargando?: boolean
}

interface EstadoSalixIA {
  mensajes: MensajeChat[]
  cargando: boolean
  conversacion_id: string | null
  error: string | null
}

export function useSalixIA() {
  const [estado, setEstado] = useState<EstadoSalixIA>({
    mensajes: [],
    cargando: false,
    conversacion_id: null,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  /** Enviar un mensaje a Salix IA */
  const enviarMensaje = useCallback(async (texto: string) => {
    if (!texto.trim() || estado.cargando) return

    // Cancelar solicitud anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    const idMensajeUsuario = `msg-${Date.now()}`
    const idMensajeAsistente = `msg-${Date.now() + 1}`

    // Agregar mensaje del usuario + placeholder del asistente
    setEstado((prev) => ({
      ...prev,
      cargando: true,
      error: null,
      mensajes: [
        ...prev.mensajes,
        {
          id: idMensajeUsuario,
          rol: 'usuario',
          contenido: texto,
          timestamp: new Date().toISOString(),
        },
        {
          id: idMensajeAsistente,
          rol: 'asistente',
          contenido: '',
          timestamp: new Date().toISOString(),
          cargando: true,
        },
      ],
    }))

    try {
      const res = await fetch('/api/salix-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: texto,
          conversacion_id: estado.conversacion_id,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al comunicarse con Salix IA')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Sin stream de respuesta')

      const decoder = new TextDecoder()
      let buffer = ''
      let textoAcumulado = ''
      let herramientasUsadas: string[] = []
      let nuevoConvId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parsear eventos SSE del buffer
        const lineas = buffer.split('\n')
        buffer = lineas.pop() || ''

        for (const linea of lineas) {
          if (!linea.startsWith('data: ')) continue

          try {
            const evento = JSON.parse(linea.slice(6))

            switch (evento.tipo) {
              case 'texto':
                textoAcumulado = evento.datos.contenido
                setEstado((prev) => ({
                  ...prev,
                  mensajes: prev.mensajes.map((m) =>
                    m.id === idMensajeAsistente
                      ? { ...m, contenido: textoAcumulado, cargando: false }
                      : m
                  ),
                }))
                break

              case 'herramienta_inicio':
                setEstado((prev) => ({
                  ...prev,
                  mensajes: prev.mensajes.map((m) =>
                    m.id === idMensajeAsistente
                      ? { ...m, contenido: evento.datos.mensaje || 'Procesando...', cargando: true }
                      : m
                  ),
                }))
                break

              case 'herramienta_resultado':
                herramientasUsadas = evento.datos.herramientas || []
                break

              case 'fin':
                nuevoConvId = evento.datos.conversacion_id
                break

              case 'error':
                throw new Error(evento.datos.mensaje)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      // Actualizar estado final
      setEstado((prev) => ({
        ...prev,
        cargando: false,
        conversacion_id: nuevoConvId || prev.conversacion_id,
        mensajes: prev.mensajes.map((m) =>
          m.id === idMensajeAsistente
            ? { ...m, contenido: textoAcumulado, cargando: false, herramientas: herramientasUsadas }
            : m
        ),
      }))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      setEstado((prev) => ({
        ...prev,
        cargando: false,
        error: (err as Error).message,
        mensajes: prev.mensajes.filter((m) => m.id !== idMensajeAsistente),
      }))
    }
  }, [estado.cargando, estado.conversacion_id])

  /** Iniciar nueva conversación */
  const nuevaConversacion = useCallback(() => {
    setEstado({
      mensajes: [],
      cargando: false,
      conversacion_id: null,
      error: null,
    })
  }, [])

  /** Cargar conversación existente */
  const cargarConversacion = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/salix-ia/conversaciones/${id}`)
      if (!res.ok) return

      const data = await res.json()
      const mensajes: MensajeChat[] = (data.mensajes || []).map(
        (m: { role: string; content: string; timestamp?: string }, i: number) => ({
          id: `hist-${i}`,
          rol: m.role === 'user' ? 'usuario' : 'asistente',
          contenido: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          timestamp: m.timestamp || data.creado_en,
        })
      )

      setEstado({
        mensajes,
        cargando: false,
        conversacion_id: id,
        error: null,
      })
    } catch {
      // Si falla, simplemente no carga
    }
  }, [])

  return {
    ...estado,
    enviarMensaje,
    nuevaConversacion,
    cargarConversacion,
  }
}
