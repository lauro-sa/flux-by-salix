'use client'

/**
 * useSalixIA — Hook para gestionar el estado del chat con Salix IA.
 * Maneja: streaming SSE, mensajes, loading, conversación actual, historial.
 * Incluye retry automático en errores transitorios (rate limit, timeout, red).
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

interface ConversacionResumen {
  id: string
  titulo: string
  canal: 'app' | 'whatsapp'
  actualizado_en: string
}

interface EstadoSalixIA {
  mensajes: MensajeChat[]
  cargando: boolean
  conversacion_id: string | null
  error: string | null
  conversaciones: ConversacionResumen[]
}

/** Errores transitorios que justifican un retry automático */
function esErrorTransitorio(mensaje: string): boolean {
  const lower = mensaje.toLowerCase()
  return (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('overloaded') ||
    lower.includes('503') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnreset') ||
    lower.includes('temporarily') ||
    lower.includes('saturado')
  )
}

/** Delay con backoff exponencial: 2s, 4s, 8s */
function delayRetry(intento: number): Promise<void> {
  const ms = Math.min(2000 * Math.pow(2, intento), 8000)
  return new Promise(resolve => setTimeout(resolve, ms))
}

const MAX_REINTENTOS = 2

export function useSalixIA() {
  const [estado, setEstado] = useState<EstadoSalixIA>({
    mensajes: [],
    cargando: false,
    conversacion_id: null,
    error: null,
    conversaciones: [],
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  /** Ejecuta el fetch con retry automático en errores transitorios */
  const fetchConRetry = async (
    texto: string,
    conversacion_id: string | null,
    signal: AbortSignal
  ): Promise<Response> => {
    let ultimoError: Error | null = null

    for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
      try {
        const res = await fetch('/api/salix-ia/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje: texto, conversacion_id }),
          signal,
        })

        if (res.ok) return res

        // Verificar si el error HTTP es transitorio
        if (res.status === 429 || res.status === 503 || res.status === 504) {
          if (intento < MAX_REINTENTOS) {
            await delayRetry(intento)
            continue
          }
        }

        // Error no transitorio — lanzar inmediatamente
        const errorData = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(errorData.error || `Error al comunicarse con Salix IA`)
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err

        ultimoError = err as Error
        if (esErrorTransitorio(ultimoError.message) && intento < MAX_REINTENTOS) {
          await delayRetry(intento)
          continue
        }
        throw ultimoError
      }
    }

    throw ultimoError || new Error('Error inesperado')
  }

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
      const res = await fetchConRetry(texto, estado.conversacion_id, controller.signal)

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
                textoAcumulado += evento.datos.contenido
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.cargando, estado.conversacion_id])

  /** Iniciar nueva conversación */
  const nuevaConversacion = useCallback(() => {
    setEstado((prev) => ({
      ...prev,
      mensajes: [],
      cargando: false,
      conversacion_id: null,
      error: null,
    }))
  }, [])

  /** Cargar conversación existente */
  const cargarConversacion = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/salix-ia/conversaciones/${id}`)
      if (!res.ok) return

      const data = await res.json()

      // Filtrar mensajes: solo mostrar texto del usuario y texto del asistente.
      // Los bloques tool_use/tool_result se persisten para contexto de Claude
      // pero no se muestran al usuario en el panel.
      const mensajes: MensajeChat[] = []
      for (const [i, m] of (data.mensajes || []).entries()) {
        const msg = m as { role: string; content: string | Array<{ type: string; text?: string; name?: string }>; timestamp?: string }

        if (typeof msg.content === 'string') {
          // Mensaje de texto simple — siempre mostrar
          if (msg.content.trim()) {
            mensajes.push({
              id: `hist-${i}`,
              rol: msg.role === 'user' ? 'usuario' : 'asistente',
              contenido: msg.content,
              timestamp: msg.timestamp || data.creado_en,
            })
          }
        } else if (Array.isArray(msg.content)) {
          // Bloques mixtos — extraer solo texto visible, ignorar tool_use/tool_result
          const textos = msg.content
            .filter((b: { type: string }) => b.type === 'text')
            .map((b: { text?: string }) => b.text || '')
            .join('\n')
            .trim()

          // Extraer nombres de herramientas usadas para mostrar badge
          const herramientas = msg.content
            .filter((b: { type: string }) => b.type === 'tool_use')
            .map((b: { name?: string }) => b.name || '')

          if (textos || herramientas.length > 0) {
            mensajes.push({
              id: `hist-${i}`,
              rol: msg.role === 'user' ? 'usuario' : 'asistente',
              contenido: textos || '_(procesando herramientas)_',
              timestamp: msg.timestamp || data.creado_en,
              herramientas: herramientas.length > 0 ? herramientas : undefined,
            })
          }
        }
      }

      setEstado((prev) => ({
        ...prev,
        mensajes,
        cargando: false,
        conversacion_id: id,
        error: null,
      }))
    } catch {
      // Si falla, simplemente no carga
    }
  }, [])

  /** Cargar listado de conversaciones anteriores */
  const cargarConversaciones = useCallback(async () => {
    try {
      const res = await fetch('/api/salix-ia/conversaciones')
      if (!res.ok) return

      const data = await res.json()
      setEstado((prev) => ({
        ...prev,
        conversaciones: (data || []).map((c: { id: string; titulo: string; canal: string; actualizado_en: string }) => ({
          id: c.id,
          titulo: c.titulo || 'Sin título',
          canal: c.canal as 'app' | 'whatsapp',
          actualizado_en: c.actualizado_en,
        })),
      }))
    } catch {
      // Silencioso
    }
  }, [])

  return {
    ...estado,
    enviarMensaje,
    nuevaConversacion,
    cargarConversacion,
    cargarConversaciones,
  }
}
