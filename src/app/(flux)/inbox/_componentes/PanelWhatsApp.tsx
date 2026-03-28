'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import {
  Check, CheckCheck, Clock, AlertCircle, Play, Pause,
  Download, FileText, MapPin, User, X, ChevronLeft, ChevronRight,
  Image, Music,
} from 'lucide-react'
import { CompositorMensaje, type DatosMensaje } from './CompositorMensaje'
import type { MensajeConAdjuntos, MensajeAdjunto, Conversacion } from '@/tipos/inbox'

/**
 * Panel central de WhatsApp — burbujas de chat con soporte multimedia.
 * Muestra: texto, imágenes, audio, video, stickers, documentos, ubicación.
 * Fecha sticky al scroll, agrupación de imágenes, visor fullscreen.
 */

interface PropiedadesPanelWhatsApp {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  onEnviar: (datos: DatosMensaje) => void
  onAbrirVisor: (url: string) => void
  cargando: boolean
  enviando: boolean
}

// Iconos de estado de entrega
// Soporta claves en español (estado) e inglés (wa_status de Meta)
const ICONO_ESTADO: Record<string, React.ReactNode> = {
  sending: <Clock size={12} style={{ color: 'var(--texto-terciario)' }} />,
  enviado: <Check size={12} style={{ color: 'var(--texto-terciario)' }} />,
  sent: <Check size={12} style={{ color: 'var(--texto-terciario)' }} />,
  entregado: <CheckCheck size={12} style={{ color: 'var(--texto-terciario)' }} />,
  delivered: <CheckCheck size={12} style={{ color: 'var(--texto-terciario)' }} />,
  leido: <CheckCheck size={12} style={{ color: '#53bdeb' }} />,
  read: <CheckCheck size={12} style={{ color: '#53bdeb' }} />,
  fallido: <AlertCircle size={12} style={{ color: 'var(--insignia-peligro)' }} />,
  failed: <AlertCircle size={12} style={{ color: 'var(--insignia-peligro)' }} />,
}

function formatoHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

// Etiqueta de día estilo WhatsApp: Hoy, Ayer, Lunes..Domingo, o fecha completa
function etiquetaDia(fecha: Date): string {
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, ayer)) return 'Ayer'

  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 6)
  hace7Dias.setHours(0, 0, 0, 0)

  if (fecha >= hace7Dias) {
    return fecha.toLocaleDateString('es', { weekday: 'long' })
      .replace(/^\w/, c => c.toUpperCase())
  }

  return fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Verificar si dos fechas son días distintos
function esDiaDiferente(a: string, b: string): boolean {
  const fa = new Date(a)
  const fb = new Date(b)
  return fa.getFullYear() !== fb.getFullYear() ||
    fa.getMonth() !== fb.getMonth() ||
    fa.getDate() !== fb.getDate()
}

// Detectar si el texto es un placeholder de media (no mostrarlo en burbuja)
function esPlaceholderMedia(texto: string | null): boolean {
  if (!texto) return true
  return /^\[(Imagen|Video|Audio|Sticker|Documento|Ubicación|Contacto)/.test(texto)
}

function textoVisible(texto: string | null): string | null {
  if (!texto || esPlaceholderMedia(texto)) return null
  return texto
}

function formatoDuracion(segundos: number): string {
  const min = Math.floor(segundos / 60)
  const seg = Math.floor(segundos % 60)
  return `${min}:${seg.toString().padStart(2, '0')}`
}

// ─── Interfaz de media para el visor (imágenes + videos) ───
export interface MediaVisor {
  url: string
  tipo: 'imagen' | 'video'
  caption: string | null
  fecha: string
}

// ─── Tipos de elementos renderizables (pre-procesados) ───
type ElementoChat =
  | { tipo: 'separador'; fecha: Date; key: string }
  | { tipo: 'burbuja'; mensaje: MensajeConAdjuntos; key: string }
  | { tipo: 'grupo_imagenes'; mensajes: MensajeConAdjuntos[]; key: string }

/** Pre-procesa mensajes en elementos renderizables, agrupando imágenes consecutivas */
function prepararElementos(mensajes: MensajeConAdjuntos[]): ElementoChat[] {
  const elementos: ElementoChat[] = []
  let i = 0

  while (i < mensajes.length) {
    const msg = mensajes[i]

    // Separador de día
    if (i === 0 || esDiaDiferente(mensajes[i - 1].creado_en, msg.creado_en)) {
      elementos.push({ tipo: 'separador', fecha: new Date(msg.creado_en), key: `sep-${msg.id}` })
    }

    // Detectar grupo de imágenes consecutivas
    if (msg.tipo_contenido === 'imagen' && msg.adjuntos.length > 0) {
      const grupo: MensajeConAdjuntos[] = [msg]
      let j = i + 1
      while (
        j < mensajes.length &&
        mensajes[j].tipo_contenido === 'imagen' &&
        mensajes[j].es_entrante === msg.es_entrante &&
        mensajes[j].adjuntos.length > 0 &&
        !esDiaDiferente(mensajes[j - 1].creado_en, mensajes[j].creado_en) &&
        new Date(mensajes[j].creado_en).getTime() - new Date(mensajes[j - 1].creado_en).getTime() < 60000
      ) {
        grupo.push(mensajes[j])
        j++
      }

      if (grupo.length >= 2) {
        elementos.push({ tipo: 'grupo_imagenes', mensajes: grupo, key: `grp-${msg.id}` })
        i = j
        continue
      }
    }

    // Todos los mensajes se muestran (media sin adjunto muestra estado de carga)
    const esMediaSinContenido = ['imagen', 'audio', 'video', 'documento', 'sticker'].includes(msg.tipo_contenido)
      && !msg.adjuntos.length && !msg.texto
    // Solo omitir mensajes de texto completamente vacíos
    if (msg.texto || msg.adjuntos.length > 0 || esMediaSinContenido
      || msg.tipo_contenido === 'ubicacion' || msg.tipo_contenido === 'contacto_compartido') {
      elementos.push({ tipo: 'burbuja', mensaje: msg, key: msg.id })
    }

    i++
  }

  return elementos
}

// ═══════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════

export function PanelWhatsApp({
  conversacion,
  mensajes,
  onEnviar,
  onAbrirVisor,
  cargando,
  enviando,
}: PropiedadesPanelWhatsApp) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Pre-procesar elementos de chat
  const elementos = useMemo(() => prepararElementos(mensajes), [mensajes])

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  if (!conversacion) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--superficie-app)' }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--canal-whatsapp)' }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
            Seleccioná una conversación
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--superficie-app)' }}>
      {/* Header de la conversación */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          borderBottom: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-tarjeta)',
        }}
      >
        <Avatar
          nombre={conversacion.contacto_nombre || conversacion.identificador_externo || '?'}
          tamano="sm"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--texto-primario)' }}>
            {conversacion.contacto_nombre || conversacion.identificador_externo || 'Conversación'}
          </h3>
          {conversacion.identificador_externo && (
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {conversacion.identificador_externo}
            </p>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--superficie-hover) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {cargando ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--texto-terciario)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        ) : (
          elementos.map((elem) => {
            if (elem.tipo === 'separador') {
              return (
                <div
                  key={elem.key}
                  className="flex items-center justify-center py-2 z-10"
                  style={{ position: 'sticky', top: 0 }}
                >
                  <span
                    className="text-xxs px-3 py-1 rounded-lg shadow-sm"
                    style={{
                      background: 'var(--superficie-elevada)',
                      color: 'var(--texto-terciario)',
                    }}
                  >
                    {etiquetaDia(elem.fecha)}
                  </span>
                </div>
              )
            }

            if (elem.tipo === 'grupo_imagenes') {
              const primerMsg = elem.mensajes[0]
              const esPropio = !primerMsg.es_entrante
              return (
                <motion.div
                  key={elem.key}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${esPropio ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[75%] rounded-lg px-3 py-1.5 relative"
                    style={{
                      background: esPropio
                        ? 'var(--superficie-seleccionada)'
                        : 'var(--superficie-tarjeta)',
                      borderTopLeftRadius: esPropio ? undefined : '4px',
                      borderTopRightRadius: esPropio ? '4px' : undefined,
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {!esPropio && primerMsg.remitente_nombre && (
                      <p className="text-xxs font-semibold mb-0.5" style={{ color: 'var(--canal-whatsapp)' }}>
                        {primerMsg.remitente_nombre}
                      </p>
                    )}
                    <GrillaImagenes imagenes={elem.mensajes} onAbrirVisor={onAbrirVisor} />
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(elem.mensajes[elem.mensajes.length - 1].creado_en)}
                      </span>
                      {esPropio && ICONO_ESTADO[primerMsg.wa_status || primerMsg.estado]}
                    </div>
                  </div>
                </motion.div>
              )
            }

            // Burbuja individual
            const msg = elem.mensaje
            const esPropio = !msg.es_entrante
            return (
              <motion.div
                key={elem.key}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${esPropio ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[75%] rounded-lg px-3 py-1.5 relative"
                  style={{
                    background: esPropio
                      ? 'var(--superficie-seleccionada)'
                      : 'var(--superficie-tarjeta)',
                    borderTopLeftRadius: esPropio ? undefined : '4px',
                    borderTopRightRadius: esPropio ? '4px' : undefined,
                    boxShadow: 'var(--sombra-sm)',
                  }}
                >
                  {!esPropio && msg.remitente_nombre && (
                    <p className="text-xxs font-semibold mb-0.5" style={{ color: 'var(--canal-whatsapp)' }}>
                      {msg.remitente_nombre}
                    </p>
                  )}
                  <ContenidoMensaje
                    mensaje={msg}
                    onAbrirVisor={onAbrirVisor}
                    metaHora={
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--texto-terciario)' }}>
                          {formatoHora(msg.creado_en)}
                        </span>
                        {esPropio && ICONO_ESTADO[msg.wa_status || msg.estado]}
                      </div>
                    }
                  />
                  {/* Hora + estado: para audio va integrada en el reproductor */}
                  {msg.tipo_contenido !== 'audio' && (
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(msg.creado_en)}
                      </span>
                      {esPropio && ICONO_ESTADO[msg.wa_status || msg.estado]}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Compositor */}
      <CompositorMensaje
        tipoCanal="whatsapp"
        onEnviar={onEnviar}
        cargando={enviando}
        placeholder="Escribir mensaje..."
        onAbrirPlantillas={() => {}}
      />

    </div>
  )
}

// ═══════════════════════════════════════════════════
// VISOR DE MEDIA FULLSCREEN (fotos + videos)
// ═══════════════════════════════════════════════════

export function VisorMedia({
  medias,
  indice,
  abierto,
  onCerrar,
  onCambiarIndice,
}: {
  medias: MediaVisor[]
  indice: number
  abierto: boolean
  onCerrar: () => void
  onCambiarIndice: (i: number) => void
}) {
  const actual = medias[indice]
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pausar video al cambiar de slide o cerrar
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [indice, abierto])

  // Navegación con teclado
  useEffect(() => {
    if (!abierto) return
    const manejar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowLeft' && indice > 0) onCambiarIndice(indice - 1)
      if (e.key === 'ArrowRight' && indice < medias.length - 1) onCambiarIndice(indice + 1)
      // Espacio para play/pause en video
      if (e.key === ' ' && actual?.tipo === 'video' && videoRef.current) {
        e.preventDefault()
        if (videoRef.current.paused) videoRef.current.play()
        else videoRef.current.pause()
      }
    }
    window.addEventListener('keydown', manejar)
    return () => window.removeEventListener('keydown', manejar)
  }, [abierto, indice, medias.length, onCerrar, onCambiarIndice, actual?.tipo])

  return (
    <AnimatePresence>
      {abierto && actual && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0, 0, 0, 0.92)' }}
          onClick={onCerrar}
        >
          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm text-white/70">
              {indice + 1} / {medias.length}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={actual.url}
                download
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <Download size={18} className="text-white/70" />
              </a>
              <button
                onClick={onCerrar}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>
          </div>

          {/* Media principal */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={e => e.stopPropagation()}>
            {/* Flecha izquierda */}
            {indice > 0 && (
              <button
                onClick={() => onCambiarIndice(indice - 1)}
                className="absolute left-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronLeft size={28} className="text-white/70" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {actual.tipo === 'video' ? (
                <motion.video
                  key={actual.url}
                  ref={videoRef}
                  src={actual.url}
                  controls
                  playsInline
                  autoPlay
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-full max-h-full object-contain select-none rounded"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                />
              ) : (
                <motion.img
                  key={actual.url}
                  src={actual.url}
                  alt=""
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                />
              )}
            </AnimatePresence>

            {/* Flecha derecha */}
            {indice < medias.length - 1 && (
              <button
                onClick={() => onCambiarIndice(indice + 1)}
                className="absolute right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronRight size={28} className="text-white/70" />
              </button>
            )}
          </div>

          {/* Caption y fecha */}
          <div className="flex-shrink-0 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
            {actual.caption && (
              <p className="text-sm text-white mb-1">{actual.caption}</p>
            )}
            <p className="text-xxs text-white/50">
              {new Date(actual.fecha).toLocaleDateString('es', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>

          {/* Miniaturas en la parte inferior */}
          {medias.length > 1 && (
            <div
              className="flex-shrink-0 px-4 pb-4 flex items-center justify-center gap-1.5 overflow-x-auto"
              onClick={e => e.stopPropagation()}
            >
              {medias.map((media, i) => (
                <button
                  key={media.url}
                  onClick={() => onCambiarIndice(i)}
                  className="flex-shrink-0 rounded overflow-hidden transition-all relative"
                  style={{
                    width: 48,
                    height: 48,
                    opacity: i === indice ? 1 : 0.4,
                    border: i === indice ? '2px solid white' : '2px solid transparent',
                  }}
                >
                  {media.tipo === 'video' ? (
                    <>
                      <video src={media.url} preload="metadata" className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play size={12} className="text-white drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════
// REPRODUCTOR DE AUDIO (estilo WhatsApp)
// Safari no soporta OGG/Opus, así que usamos Web Audio API como fallback
// ═══════════════════════════════════════════════════

function ReproductorAudio({ adjunto, children }: { adjunto: MensajeAdjunto; children?: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [duracion, setDuracion] = useState(adjunto.duracion_segundos || 0)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState(false)

  // Detectar si el navegador soporta OGG
  const soportaOgg = useRef<boolean | null>(null)
  useEffect(() => {
    const audio = document.createElement('audio')
    soportaOgg.current = audio.canPlayType('audio/ogg; codecs=opus') !== ''
  }, [])

  // Barras estilo WhatsApp: finas, centradas, con variación orgánica
  const barras = useRef(
    Array.from({ length: 63 }, (_, i) => {
      // Hash pseudo-random estable por índice
      const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      const rand = h - Math.floor(h)
      // Variación rápida (detalle) + envelope suave
      const detalle = rand * 0.7
      const envelope = 0.3 + 0.7 * Math.sin((i / 62) * Math.PI) // sube y baja
      return Math.max(0.08, Math.min(1, detalle * envelope + 0.15))
    })
  ).current

  // Fallback: Web Audio API para navegadores que no soportan OGG nativo
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const startTimeRef = useRef(0)
  const offsetRef = useRef(0)

  const decodificarConWebAudio = useCallback(async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const response = await fetch(adjunto.url)
      const arrayBuffer = await response.arrayBuffer()
      bufferRef.current = await ctx.decodeAudioData(arrayBuffer)
      setDuracion(bufferRef.current.duration)
    } catch {
      setError(true)
    }
  }, [adjunto.url])

  const reproducirWebAudio = useCallback(() => {
    if (!audioCtxRef.current || !bufferRef.current) return
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    source.connect(ctx.destination)
    source.start(0, offsetRef.current)
    sourceRef.current = source
    startTimeRef.current = ctx.currentTime - offsetRef.current
    setReproduciendo(true)

    source.onended = () => {
      setReproduciendo(false)
      setProgreso(0)
      setTiempoActual(0)
      offsetRef.current = 0
    }
  }, [])

  const pausarWebAudio = useCallback(() => {
    if (sourceRef.current && audioCtxRef.current) {
      offsetRef.current = audioCtxRef.current.currentTime - startTimeRef.current
      sourceRef.current.stop()
      sourceRef.current = null
      setReproduciendo(false)
    }
  }, [])

  // Timer para actualizar progreso en modo Web Audio
  useEffect(() => {
    if (!reproduciendo || !audioCtxRef.current || soportaOgg.current !== false) return
    const intervalo = setInterval(() => {
      if (!audioCtxRef.current || !bufferRef.current) return
      const actual = audioCtxRef.current.currentTime - startTimeRef.current
      setTiempoActual(actual)
      setProgreso(actual / bufferRef.current.duration)
    }, 100)
    return () => clearInterval(intervalo)
  }, [reproduciendo])

  // Cargar audio con Web Audio API si no soporta OGG
  useEffect(() => {
    if (soportaOgg.current === false) {
      decodificarConWebAudio()
    }
  }, [soportaOgg.current, decodificarConWebAudio])

  const toggleReproducir = useCallback(() => {
    // Modo nativo
    if (soportaOgg.current) {
      const audio = audioRef.current
      if (!audio) return
      if (reproduciendo) audio.pause()
      else audio.play().catch(() => setError(true))
      return
    }
    // Modo Web Audio (fallback para Safari)
    if (reproduciendo) pausarWebAudio()
    else reproducirWebAudio()
  }, [reproduciendo, reproducirWebAudio, pausarWebAudio])

  const manejarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (soportaOgg.current) {
      const audio = audioRef.current
      if (!audio || !audio.duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      audio.currentTime = x * audio.duration
    } else if (bufferRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      offsetRef.current = x * bufferRef.current.duration
      if (reproduciendo) {
        pausarWebAudio()
        reproducirWebAudio()
      }
    }
  }, [reproduciendo, pausarWebAudio, reproducirWebAudio])

  // Si hay error y no se puede reproducir, mostrar link de descarga
  if (error) {
    return (
      <a
        href={adjunto.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 min-w-[200px] px-2 py-1.5 rounded"
        style={{ background: 'var(--superficie-hover)' }}
      >
        <Music size={16} style={{ color: 'var(--canal-whatsapp)' }} />
        <span className="text-xs" style={{ color: 'var(--texto-primario)' }}>Nota de voz</span>
        <Download size={14} style={{ color: 'var(--texto-terciario)' }} />
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[240px] max-w-[320px]">
      {/* Audio nativo (solo se usa si el navegador soporta OGG) */}
      <audio
        ref={audioRef}
        src={adjunto.url}
        preload="metadata"
        onTimeUpdate={() => {
          const audio = audioRef.current
          if (!audio || !audio.duration) return
          setTiempoActual(audio.currentTime)
          setProgreso(audio.currentTime / audio.duration)
        }}
        onLoadedMetadata={() => {
          const audio = audioRef.current
          if (audio?.duration && isFinite(audio.duration)) setDuracion(audio.duration)
        }}
        onPlay={() => setReproduciendo(true)}
        onPause={() => setReproduciendo(false)}
        onEnded={() => { setReproduciendo(false); setProgreso(0); setTiempoActual(0) }}
        onError={() => {
          if (soportaOgg.current) {
            // Intentar con Web Audio API como fallback
            soportaOgg.current = false
            decodificarConWebAudio()
          }
        }}
      />
      <button
        onClick={toggleReproducir}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
      >
        {reproduciendo ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        {/* Waveform centrada (barras arriba y abajo) + circulito de progreso */}
        <div
          className="relative flex items-center h-9 cursor-pointer"
          onClick={manejarClick}
          onMouseDown={(e) => {
            // Drag del circulito
            const contenedor = e.currentTarget
            const mover = (ev: MouseEvent) => {
              const rect = contenedor.getBoundingClientRect()
              const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
              if (soportaOgg.current && audioRef.current?.duration) {
                audioRef.current.currentTime = x * audioRef.current.duration
              } else if (bufferRef.current) {
                offsetRef.current = x * bufferRef.current.duration
                setProgreso(x)
                setTiempoActual(x * bufferRef.current.duration)
              }
            }
            const soltar = () => {
              document.removeEventListener('mousemove', mover)
              document.removeEventListener('mouseup', soltar)
            }
            document.addEventListener('mousemove', mover)
            document.addEventListener('mouseup', soltar)
          }}
        >
          {/* Waveform centrada — barras verticales simétricas */}
          <div className="flex items-center w-full h-full">
            {barras.map((altura, i) => {
              const activa = (i / barras.length) <= progreso
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height: `${altura * 90}%`,
                    minWidth: 2,
                    marginInline: '0.5px',
                    borderRadius: 1,
                    background: activa
                      ? 'var(--texto-marca)'
                      : 'var(--texto-terciario)',
                    opacity: activa ? 1 : 0.35,
                  }}
                />
              )
            })}
          </div>
          {/* Punto indicador de posición */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: 8,
              height: 8,
              left: `calc(${progreso * 100}% - 4px)`,
              background: 'var(--texto-marca)',
              opacity: progreso > 0 || reproduciendo ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          />
        </div>
        {/* Duración — la hora y estado se inyectan desde la burbuja padre via children */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--texto-terciario)' }}>
            {reproduciendo || tiempoActual > 0
              ? formatoDuracion(tiempoActual)
              : duracion > 0 ? formatoDuracion(duracion) : '0:00'}
          </span>
          {children}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// REPRODUCTOR DE VIDEO
// ═══════════════════════════════════════════════════

function MiniaturVideo({
  adjunto,
  caption,
  onAbrirVisor,
}: {
  adjunto: MensajeAdjunto
  caption: string | null
  onAbrirVisor: (url: string) => void
}) {
  return (
    <div className="space-y-1">
      <button
        onClick={() => onAbrirVisor(adjunto.url)}
        className="relative rounded-md overflow-hidden block"
        style={{ maxWidth: 320 }}
      >
        <video
          src={adjunto.url}
          preload="metadata"
          playsInline
          muted
          className="max-w-full rounded-md"
          style={{ maxHeight: 280 }}
        />
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Play size={22} className="text-white ml-0.5" />
          </div>
        </div>
      </button>
      {caption && (
        <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// GRILLA DE IMÁGENES AGRUPADAS
// ═══════════════════════════════════════════════════

function GrillaImagenes({
  imagenes,
  onAbrirVisor,
}: {
  imagenes: MensajeConAdjuntos[]
  onAbrirVisor: (url: string) => void
}) {
  const total = imagenes.length
  const caption = imagenes.map(m => textoVisible(m.texto)).find(t => t) || null

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-0.5 rounded-md overflow-hidden">
        {imagenes.slice(0, 4).map((msg, i) => {
          const adj = msg.adjuntos[0]
          if (!adj) return null
          const spanFull = total === 3 && i === 0
          return (
            <button
              key={msg.id}
              onClick={() => onAbrirVisor(adj.url)}
              className={`relative block overflow-hidden ${spanFull ? 'col-span-2' : ''}`}
            >
              <img
                src={adj.url}
                alt=""
                className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                style={{ height: spanFull ? 200 : total === 2 ? 180 : 120 }}
              />
              {i === 3 && total > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-white text-lg font-bold">+{total - 4}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
      {caption && (
        <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
      )}
    </div>
  )
}


// Placeholder para media que aún no tiene adjunto (descargando)
const ICONO_MEDIA: Record<string, { icono: React.ReactNode; texto: string }> = {
  imagen: { icono: <Image size={18} />, texto: 'Cargando imagen...' },
  audio: { icono: <Music size={18} />, texto: 'Cargando audio...' },
  video: { icono: <Play size={18} />, texto: 'Cargando video...' },
  documento: { icono: <FileText size={18} />, texto: 'Cargando documento...' },
  sticker: { icono: <Image size={18} />, texto: 'Cargando sticker...' },
}

function MediaCargando({ tipo }: { tipo: string }) {
  const info = ICONO_MEDIA[tipo] || ICONO_MEDIA.documento
  return (
    <div className="flex items-center gap-2 min-w-[160px] py-1">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
      >
        {info.icono}
      </div>
      <span className="text-xs italic" style={{ color: 'var(--texto-terciario)' }}>
        {info.texto}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// CONTENIDO DE MENSAJE INDIVIDUAL
// ═══════════════════════════════════════════════════

function ContenidoMensaje({
  mensaje,
  onAbrirVisor,
  metaHora,
}: {
  mensaje: MensajeConAdjuntos
  onAbrirVisor: (url: string) => void
  metaHora?: React.ReactNode
}) {
  const { tipo_contenido, texto, adjuntos } = mensaje
  const caption = textoVisible(texto)

  switch (tipo_contenido) {
    case 'imagen':
      return adjuntos.length > 0 ? (
        <div className="space-y-1">
          {adjuntos.map((adj) => (
            <button key={adj.id} onClick={() => onAbrirVisor(adj.url)} className="block">
              <img
                src={adj.url}
                alt={caption || ''}
                className="rounded-md max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: 300 }}
              />
            </button>
          ))}
          {caption && (
            <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
          )}
        </div>
      ) : <MediaCargando tipo="imagen" />

    case 'audio':
      if (adjuntos[0]) return <ReproductorAudio adjunto={adjuntos[0]}>{metaHora}</ReproductorAudio>
      // Audio sin adjunto: mostrar placeholder descriptivo
      if (texto) {
        return (
          <div className="flex items-center gap-2 min-w-[160px] py-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}>
              <Music size={14} />
            </div>
            <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{texto}</span>
          </div>
        )
      }
      return <MediaCargando tipo="audio" />

    case 'video':
      return adjuntos[0] ? (
        <MiniaturVideo adjunto={adjuntos[0]} caption={caption} onAbrirVisor={onAbrirVisor} />
      ) : <MediaCargando tipo="video" />

    case 'documento':
      if (adjuntos.length > 0) {
        return (
          <div className="space-y-1">
            {adjuntos.map((adj) => (
              <a
                key={adj.id}
                href={adj.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{ background: 'var(--superficie-hover)' }}
              >
                <FileText size={16} style={{ color: 'var(--texto-marca)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                    {adj.nombre_archivo}
                  </p>
                  {adj.tamano_bytes && (
                    <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                      {adj.tamano_bytes > 1048576
                        ? `${(adj.tamano_bytes / 1048576).toFixed(1)} MB`
                        : `${(adj.tamano_bytes / 1024).toFixed(0)} KB`}
                    </p>
                  )}
                </div>
                <Download size={14} style={{ color: 'var(--texto-terciario)' }} />
              </a>
            ))}
            {caption && (
              <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
            )}
          </div>
        )
      }
      // Documento sin adjunto: mostrar nombre si lo tiene, o estado de carga
      if (texto) {
        return (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'var(--superficie-hover)' }}>
            <FileText size={16} style={{ color: 'var(--texto-terciario)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: 'var(--texto-secundario)' }}>{texto}</p>
              <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Archivo no disponible</p>
            </div>
          </div>
        )
      }
      return <MediaCargando tipo="documento" />

    case 'sticker':
      return adjuntos.length > 0 ? (
        <div>
          {adjuntos.map((adj) => (
            <img key={adj.id} src={adj.url} alt="sticker" className="w-32 h-32 object-contain" />
          ))}
        </div>
      ) : <MediaCargando tipo="sticker" />

    case 'ubicacion':
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <MapPin size={16} style={{ color: 'var(--insignia-peligro)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {caption || 'Ubicación compartida'}
          </span>
        </div>
      )

    case 'contacto_compartido':
      return (
        <div className="flex items-center gap-2">
          <User size={16} style={{ color: 'var(--texto-marca)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {caption || 'Contacto compartido'}
          </span>
        </div>
      )

    default:
      return (
        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--texto-primario)' }}>
          {texto}
        </p>
      )
  }
}
