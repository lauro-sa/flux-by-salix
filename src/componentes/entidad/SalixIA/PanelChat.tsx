'use client'

/**
 * PanelChat — Panel de conversación con Salix IA.
 * Desktop: panel lateral derecho (400px) con animación slide-in.
 * Mobile: pantalla completa con slide-up.
 * Incluye grabación de audio con transcripción via Whisper.
 *
 * Se usa en: BotonFlotante (abre este panel al tocar).
 */

import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Plus, Sparkles, Loader2, Wrench, Mic, ExternalLink, History, MessageSquare, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSalixIA } from '@/hooks/useSalixIA'
import { useEsMovil } from '@/hooks/useEsMovil'
import { GrabadorAudio } from '@/componentes/mensajeria/GrabadorAudio'

interface PropiedadesPanelChat {
  abierto: boolean
  onCerrar: () => void
}

/**
 * Parsea formato WhatsApp (*negrita*, _cursiva_, ~tachado~) y {{link:ruta|texto}} en ReactNode.
 * También convierte saltos de línea en <br/> con espaciado visual.
 */
function parsearContenido(texto: string, onNavegar: (ruta: string) => void): ReactNode {
  // Separar por líneas primero para dar buen espaciado
  const lineas = texto.split('\n')

  return lineas.map((linea, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {/* Línea vacía = espacio visual extra */}
      {linea.trim() === '' ? <span className="block h-1.5" /> : parsearLineaFormato(linea, onNavegar, i)}
    </span>
  ))
}

/** Parsea una línea individual aplicando formato WhatsApp y links internos */
function parsearLineaFormato(linea: string, onNavegar: (ruta: string) => void, lineaIdx: number): ReactNode {
  // Regex combinado: links internos, *negrita*, _cursiva_, ~tachado~
  const regex = /\{\{link:([^|]+)\|([^}]+)\}\}|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g
  const partes: ReactNode[] = []
  let ultimoIndice = 0
  let match

  while ((match = regex.exec(linea)) !== null) {
    // Texto antes del match
    if (match.index > ultimoIndice) {
      partes.push(linea.slice(ultimoIndice, match.index))
    }

    const key = `${lineaIdx}-${match.index}`

    if (match[1] && match[2]) {
      // Link interno: {{link:/ruta|Texto}}
      partes.push(
        <button
          key={key}
          onClick={() => onNavegar(match![1])}
          className="inline-flex items-center gap-1 text-texto-marca underline underline-offset-2 hover:text-texto-marca/80 transition-colors"
        >
          {match[2]}
          <ExternalLink className="size-3" />
        </button>
      )
    } else if (match[3]) {
      // *negrita*
      partes.push(<strong key={key} className="font-semibold">{match[3]}</strong>)
    } else if (match[4]) {
      // _cursiva_
      partes.push(<em key={key} className="italic text-texto-secundario">{match[4]}</em>)
    } else if (match[5]) {
      // ~tachado~
      partes.push(<s key={key} className="line-through text-texto-terciario">{match[5]}</s>)
    }

    ultimoIndice = match.index + match[0].length
  }

  // Texto después del último match
  if (ultimoIndice < linea.length) {
    partes.push(linea.slice(ultimoIndice))
  }

  return partes.length > 0 ? partes : linea
}

function PanelChat({ abierto, onCerrar }: PropiedadesPanelChat) {
  const esMovil = useEsMovil()
  const router = useRouter()
  const {
    mensajes,
    cargando,
    error,
    conversaciones,
    conversacion_id,
    enviarMensaje,
    nuevaConversacion,
    cargarConversacion,
    cargarConversaciones,
  } = useSalixIA()

  const [vistaHistorial, setVistaHistorial] = useState(false)

  // Navegar a una ruta interna — cierra el panel primero
  const navegarDesdeChat = useCallback((ruta: string) => {
    onCerrar()
    router.push(ruta)
  }, [onCerrar, router])

  const [texto, setTexto] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll al fondo cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  // Foco en el input al abrir
  useEffect(() => {
    if (abierto && inputRef.current && !grabando) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [abierto, grabando])

  const handleEnviar = () => {
    if (!texto.trim() || cargando) return
    enviarMensaje(texto.trim())
    setTexto('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  // Callback cuando se completa la grabación de audio
  const handleGrabacionCompleta = useCallback(async (audio: Blob, _duracion: number) => {
    setGrabando(false)
    setTranscribiendo(true)

    try {
      // Enviar audio a transcribir
      const formData = new FormData()
      formData.append('audio', audio, 'audio.webm')

      const res = await fetch('/api/salix-ia/transcribir', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al transcribir')
      }

      const { texto: textoTranscrito } = await res.json()

      if (textoTranscrito) {
        // Enviar el texto transcrito directamente como mensaje
        enviarMensaje(textoTranscrito)
      }
    } catch (err) {
      console.error('[Salix IA] Error transcribiendo audio:', err)
    } finally {
      setTranscribiendo(false)
    }
  }, [enviarMensaje])

  const handleCancelarGrabacion = useCallback(() => {
    setGrabando(false)
  }, [])

  // Cargar conversaciones al abrir el historial
  const abrirHistorial = useCallback(() => {
    setVistaHistorial(true)
    cargarConversaciones()
  }, [cargarConversaciones])

  const seleccionarConversacion = useCallback((id: string) => {
    cargarConversacion(id)
    setVistaHistorial(false)
  }, [cargarConversacion])

  const iniciarNueva = useCallback(() => {
    nuevaConversacion()
    setVistaHistorial(false)
  }, [nuevaConversacion])

  const contenido = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          {vistaHistorial ? (
            <>
              <button
                onClick={() => setVistaHistorial(false)}
                className="p-1 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <h3 className="text-sm font-semibold text-texto-primario">Conversaciones</h3>
            </>
          ) : (
            <>
              <div className="size-8 rounded-card bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
                <Sparkles className="size-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-texto-primario">Salix IA</h3>
                <p className="text-[11px] text-texto-terciario">Tu copiloto en Flux</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!vistaHistorial && (
            <>
              <button
                onClick={abrirHistorial}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
                title="Conversaciones anteriores"
              >
                <History className="size-4" />
              </button>
              <button
                onClick={iniciarNueva}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
                title="Nueva conversación"
              >
                <Plus className="size-4" />
              </button>
            </>
          )}
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Vista de historial de conversaciones */}
      {vistaHistorial ? (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-auto-oculto">
          {/* Botón nueva conversación */}
          <button
            onClick={iniciarNueva}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-card bg-texto-marca/5 border border-texto-marca/20 text-left transition-colors hover:bg-texto-marca/10 mb-2"
          >
            <Plus className="size-4 text-texto-marca shrink-0" />
            <span className="text-sm font-medium text-texto-marca">Nueva conversación</span>
          </button>

          {conversaciones.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="size-8 text-texto-terciario/40 mx-auto mb-2" />
              <p className="text-xs text-texto-terciario">No hay conversaciones anteriores</p>
            </div>
          ) : (
            conversaciones.map((conv) => (
              <button
                key={conv.id}
                onClick={() => seleccionarConversacion(conv.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-card text-left transition-colors hover:bg-white/[0.04] border border-transparent ${
                  conversacion_id === conv.id ? 'bg-white/[0.06] border-white/[0.08]' : ''
                }`}
              >
                <MessageSquare className="size-4 text-texto-terciario shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-texto-primario truncate">{conv.titulo}</p>
                  <p className="text-[11px] text-texto-terciario mt-0.5">
                    {new Date(conv.actualizado_en).toLocaleDateString('es', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {conv.canal === 'whatsapp' && ' · WhatsApp'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-auto-oculto"
      >
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="size-14 rounded-modal bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
              <Sparkles className="size-7 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-texto-primario">¡Hola! Soy Salix IA</p>
              <p className="text-xs text-texto-terciario mt-1 max-w-[240px]">
                Preguntame lo que necesites: consultar asistencias, crear actividades, agendar visitas y más.
              </p>
            </div>
          </div>
        )}

        {mensajes.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-modal px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.rol === 'usuario'
                  ? 'bg-texto-marca text-white rounded-br-md'
                  : 'bg-white/[0.06] text-texto-primario rounded-bl-md'
              }`}
            >
              {msg.cargando ? (
                <div className="flex items-center gap-2 text-texto-terciario">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="text-xs">{msg.contenido || 'Pensando...'}</span>
                </div>
              ) : (
                <>
                  <div className="leading-relaxed">{parsearContenido(msg.contenido, navegarDesdeChat)}</div>
                  {msg.herramientas && msg.herramientas.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-white/[0.07]">
                      <Wrench className="size-3 text-texto-terciario" />
                      <span className="text-[10px] text-texto-terciario">
                        {msg.herramientas.join(', ')}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="text-center">
            <p className="text-xs text-red-400 bg-red-400/10 rounded-card px-3 py-2 inline-block">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Input / Grabador */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.07]">
        {/* Indicador de transcripción */}
        {transcribiendo && (
          <div className="flex items-center gap-2 justify-center py-2 mb-2">
            <Loader2 className="size-3.5 animate-spin text-texto-marca" />
            <span className="text-xs text-texto-terciario">Transcribiendo audio...</span>
          </div>
        )}

        {/* Grabador de audio (reemplaza input cuando está activo) */}
        <GrabadorAudio
          activo={grabando}
          onGrabacionCompleta={handleGrabacionCompleta}
          onCancelar={handleCancelarGrabacion}
        />

        {/* Input de texto + botón micrófono (oculto durante grabación) */}
        {!grabando && (
          <div className="flex items-end gap-2 bg-white/[0.04] rounded-card px-3 py-2 border border-white/[0.07] focus-within:border-texto-marca/40 transition-colors">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí o usá el micrófono..."
              rows={1}
              disabled={transcribiendo || cargando}
              className="flex-1 bg-transparent text-sm text-texto-primario placeholder:text-texto-terciario resize-none outline-none max-h-[120px] min-h-[24px] disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />

            {/* Mostrar mic o send según si hay texto */}
            {texto.trim() ? (
              <button
                onClick={handleEnviar}
                disabled={cargando}
                className="p-1.5 rounded-card text-texto-marca hover:bg-texto-marca/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => setGrabando(true)}
                disabled={cargando || transcribiendo}
                className="p-1.5 rounded-card text-texto-terciario hover:text-violet-400 hover:bg-violet-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Grabar audio"
              >
                <Mic className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )

  // Mobile: pantalla completa (slide-up) para mejor experiencia táctil
  if (esMovil) {
    return createPortal(
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-[80] bg-superficie-app flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              height: 'calc(var(--vh, 1vh) * 100)',
            }}
          >
            {contenido}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  // Desktop: Panel lateral derecho — portal para escapar del transform del contenedor flotante
  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          {/* Overlay sutil */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
            className="fixed inset-0 bg-black/20 z-[69]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-[400px] max-w-[90vw] z-[70] bg-superficie-elevada border-l border-white/[0.07] shadow-2xl flex flex-col"
          >
            {contenido}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export { PanelChat }
