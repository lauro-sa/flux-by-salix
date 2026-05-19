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
import { motion, AnimatePresence } from 'framer-motion'
import { PanelFlotanteCascada } from '@/componentes/ui/PanelFlotanteCascada'
import { CabezalPanel } from '@/componentes/ui/CabezalPanel'
import { X, Send, Plus, Sparkles, Loader2, Wrench, Mic, ExternalLink, History, MessageSquare, ChevronLeft, Zap, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSalixIA } from '@/hooks/useSalixIA'
import { useAccionesRapidas } from '@/hooks/useAccionesRapidas'
import { GrabadorAudio } from '@/componentes/mensajeria/GrabadorAudio'
import { ListaAccionesRapidas } from './ListaAccionesRapidas'

interface PropiedadesPanelChat {
  abierto: boolean
  onCerrar: () => void
  /**
   * ¿El usuario tiene Salix IA habilitada? Si es `false`, el panel solo
   * muestra las acciones rápidas contextuales (sin chat ni input).
   */
  iaHabilitado?: boolean
  /**
   * ID único para registrar este chat en el gestor de paneles flotantes.
   * Default 'salix-chat'. Cuando hay múltiples chats abiertos en paralelo,
   * cada uno usa un id distinto (ej. 'salix-chat-1', 'salix-chat-2').
   */
  idChat?: string
  /**
   * Etiqueta del chat en la solapa de la cascada y en el subtítulo del
   * cabezal. Default 'Chat'. Útil para diferenciar entre múltiples chats
   * (ej. 'Chat 1', 'Chat 2').
   */
  etiquetaChat?: string
  /**
   * Si se pasa, el botón "+" del header abre un nuevo chat (otro panel)
   * en vez de iniciar una conversación nueva en el panel actual. La opción
   * de "Nueva conversación" sigue disponible dentro del historial.
   */
  onAbrirNuevoChat?: () => void
  /**
   * Si se pasa, controla si el botón "+" para abrir nuevo chat está
   * habilitado (false cuando se llegó al máximo de chats abiertos).
   */
  puedeAbrirNuevoChat?: boolean
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

function PanelChat({
  abierto,
  onCerrar,
  iaHabilitado = true,
  idChat = 'salix-chat',
  etiquetaChat = 'Chat',
  onAbrirNuevoChat,
  puedeAbrirNuevoChat = true,
}: PropiedadesPanelChat) {
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

  // Acciones rápidas contextuales a la ruta actual. El hook precarga apenas
  // cambia la ruta (no espera a que se abra el panel), así que las acciones
  // ya están listas cuando el usuario toca el FAB.
  const {
    acciones,
    cargando: cargandoAcciones,
    error: errorAcciones,
    hayContexto,
  } = useAccionesRapidas()

  const [vistaHistorial, setVistaHistorial] = useState(false)

  // Acciones rápidas: expandidas por defecto, se contraen mientras el usuario
  // está conversando (input con texto o mensajes ya enviados). Cuando vuelve
  // al estado "limpio" (input vacío y sin mensajes) se re-expanden solas.
  // Mientras está colapsado, hay un FAB flotante en la esquina del panel
  // que permite re-expandir manualmente. El ref evita pisar la decisión del
  // usuario en cada render — solo reaplicamos en TRANSICIONES de estado.
  const [accionesExpandidas, setAccionesExpandidas] = useState(true)
  const tieneActividadRef = useRef(false)

  // Sin IA: el panel es solo para acciones rápidas.
  const soloAcciones = !iaHabilitado

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

  // Sincronizar acciones con la actividad del chat:
  //   - Sin texto y sin mensajes  → expandido (estado inicial / "limpio")
  //   - Con texto o con mensajes  → colapsado
  // Solo aplicamos el cambio en TRANSICIONES (no en cada render) para no
  // pisar al usuario si toca el FAB flotante para re-expandir mientras
  // sigue escribiendo el mismo texto.
  useEffect(() => {
    if (soloAcciones) return
    const tieneActividad = texto.trim().length > 0 || mensajes.length > 0
    if (tieneActividad !== tieneActividadRef.current) {
      tieneActividadRef.current = tieneActividad
      setAccionesExpandidas(!tieneActividad)
    }
  }, [texto, mensajes.length, soloAcciones])

  // Reset al cerrar: la próxima vez que se abra, arranca expandido y limpio.
  useEffect(() => {
    if (!abierto) {
      tieneActividadRef.current = false
      setAccionesExpandidas(true)
    }
  }, [abierto])

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

  // FAB flotante para re-expandir acciones cuando están colapsadas.
  // Posición: arriba al centro del panel, debajo del header. Se ancla al
  // panel (no al viewport) — visible siempre, no se va con el scroll.
  const fabAccionesRapidas =
    !soloAcciones &&
    !vistaHistorial &&
    hayContexto &&
    !accionesExpandidas &&
    acciones.length > 0 ? (
      <motion.button
        key="fab-acciones"
        initial={{ opacity: 0, scale: 0.85, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: -8 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setAccionesExpandidas(true)}
        className="absolute left-0 right-0 mx-auto z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-full cursor-pointer"
        style={{
          // Debajo del header (~60-65px) con un margen.
          top: '72px',
          width: 'fit-content',
          background: 'linear-gradient(135deg, rgba(127,119,221,0.32), rgba(55,138,221,0.24))',
          border: '1px solid rgba(127,119,221,0.35)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          boxShadow: '0 8px 24px rgba(60,50,160,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
          color: 'rgba(255,255,255,0.95)',
        }}
        title="Expandir acciones rápidas"
        aria-label="Expandir acciones rápidas"
      >
        <Zap className="size-3.5" strokeWidth={2} />
        <span className="text-[12px] font-medium tracking-tight">Acciones</span>
        {acciones.length > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/15 leading-none">
            {acciones.length}
          </span>
        )}
      </motion.button>
    ) : null

  const contenido = (
    <div className="flex flex-col h-full relative">
      {/* Header unificado (CabezalPanel). Tres variantes según contexto:
          - Vista historial: ícono de retroceso + título "Conversaciones"
          - Solo acciones rápidas (sin IA): ícono ámbar de rayo
          - Modo normal (chat): ícono violeta de sparkles + acciones extra
            (History, Plus para nueva conversación) */}
      {vistaHistorial ? (
        <CabezalPanel
          icono={
            <button
              onClick={() => setVistaHistorial(false)}
              className="size-full flex items-center justify-center rounded-card text-texto-secundario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
              title="Volver"
            >
              <ChevronLeft className="size-4" />
            </button>
          }
          titulo="Conversaciones"
          onCerrar={onCerrar}
        />
      ) : soloAcciones ? (
        <CabezalPanel
          icono={
            <div className="size-full bg-gradient-to-br from-amber-500/25 to-orange-600/20 flex items-center justify-center">
              <Zap className="size-4 text-amber-400" />
            </div>
          }
          titulo="Acciones rápidas"
          subtitulo="Lo que podés hacer acá"
          onCerrar={onCerrar}
        />
      ) : (
        <CabezalPanel
          icono={
            <div className="size-full bg-gradient-to-br from-violet-500/25 to-indigo-600/20 flex items-center justify-center">
              <Sparkles className="size-4 text-violet-400" />
            </div>
          }
          titulo="Salix IA"
          subtitulo="Tu copiloto en Flux"
          acciones={
            <>
              <button
                onClick={abrirHistorial}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
                title="Conversaciones anteriores"
              >
                <History className="size-4" />
              </button>
              {/* "+" abre un NUEVO panel de chat en paralelo (hasta 3 en
                  total). Si llegamos al máximo, se deshabilita. La opción
                  de "Nueva conversación" dentro del mismo chat sigue
                  disponible desde la vista de historial. */}
              <button
                onClick={() => {
                  if (onAbrirNuevoChat && puedeAbrirNuevoChat) onAbrirNuevoChat()
                  else iniciarNueva()
                }}
                disabled={!!onAbrirNuevoChat && !puedeAbrirNuevoChat}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={
                  onAbrirNuevoChat
                    ? puedeAbrirNuevoChat
                      ? 'Abrir otro chat en paralelo'
                      : 'Máximo 3 chats simultáneos'
                    : 'Nueva conversación'
                }
              >
                <Plus className="size-4" />
              </button>
            </>
          }
          onCerrar={onCerrar}
        />
      )}

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
      ) : soloAcciones ? (
        <ListaAccionesRapidas
          acciones={acciones}
          cargando={cargandoAcciones}
          error={errorAcciones}
          soloAcciones
          onAccionEjecutada={onCerrar}
        />
      ) : (
        <>
      {/* Acciones rápidas contextuales: solo se renderizan en línea cuando
          están EXPANDIDAS. Cuando están colapsadas, se muestran como FAB
          flotante (más abajo, fuera del flujo de mensajes). */}
      {hayContexto && (acciones.length > 0 || cargandoAcciones || errorAcciones) && accionesExpandidas && (
        <ListaAccionesRapidas
          acciones={acciones}
          cargando={cargandoAcciones}
          error={errorAcciones}
          onAccionEjecutada={onCerrar}
          onColapsar={() => setAccionesExpandidas(false)}
        />
      )}
      {/* Mensajes / Empty state.
          - Con mensajes: contenedor flex-1 con scroll, mensajes apilados.
          - Sin mensajes + con acciones: solo banner mini de altura natural,
            seguido de un spacer flex-1 que empuja el input al fondo (así el
            banner queda pegado debajo de las acciones, sin gap arriba).
          - Sin mensajes + sin acciones: welcome grande centrado en flex-1. */}
      {mensajes.length > 0 ? (
        <div
          ref={scrollRef}
          className="flex-1 min-h-[200px] overflow-y-auto px-4 py-3 space-y-3 scrollbar-auto-oculto"
        >
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
      ) : acciones.length > 0 && accionesExpandidas ? (
        // Banner mini ultra compacto pegado al input. La lista de acciones
        // arriba toma todo el espacio sobrante con scroll interno; el banner
        // es solo una microbarra recordatoria justo encima del input.
        <div className="shrink-0 px-4 py-1.5 flex items-center justify-center gap-1.5 text-white/40">
          <Sparkles className="size-3 text-violet-400/60" />
          <p className="text-[10px]">¿Necesitás algo más?</p>
        </div>
      ) : (
        // Welcome grande centrado: cuando no hay acciones disponibles, o
        // cuando hay pero están colapsadas (porque el usuario empezó a
        // escribir). El espacio del area de mensajes es ahora todo del chat.
        <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center gap-3 py-8 px-4">
          <div className="size-14 rounded-modal bg-gradient-to-br from-violet-500/25 to-indigo-600/20 flex items-center justify-center">
            <Sparkles className="size-7 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/95">¡Hola! Soy Salix IA</p>
            <p className="text-xs text-white/55 mt-1 max-w-[240px]">
              Preguntame lo que necesites: consultar asistencias, crear actividades, agendar visitas y más.
            </p>
          </div>
        </div>
      )}

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
          <div className="salix-input-wrapper flex items-end gap-2 px-3 py-2">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí o usá el micrófono..."
              rows={1}
              disabled={transcribiendo || cargando}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 resize-none outline-none max-h-[120px] min-h-[24px] disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />

            {/* Mostrar mic o send según si hay texto */}
            {texto.trim() ? (
              <button
                onClick={handleEnviar}
                disabled={cargando}
                className="p-1.5 rounded-card text-violet-300 hover:bg-violet-400/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => setGrabando(true)}
                disabled={cargando || transcribiendo}
                className="p-1.5 rounded-card text-white/50 hover:text-violet-300 hover:bg-violet-400/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
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

      {/* FAB flotante para re-expandir acciones rápidas (encima del input) */}
      <AnimatePresence>{fabAccionesRapidas}</AnimatePresence>
    </div>
  )

  // El wrapper PanelFlotanteCascada gestiona portal, motion, mobile/desktop,
  // cascada de paneles apilados y backdrop. Acá solo le pasamos identidad
  // (id, etiqueta, color) y el contenido.
  return (
    <PanelFlotanteCascada
      id={idChat}
      etiqueta={etiquetaChat}
      colorAcento="rgb(167, 139, 250)"
      abierto={abierto}
      onCerrar={onCerrar}
    >
      {contenido}
    </PanelFlotanteCascada>
  )
}

export { PanelChat }
