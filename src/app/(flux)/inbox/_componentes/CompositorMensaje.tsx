'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, X, Image, Film, File, StopCircle, FileText, Trash2,
} from 'lucide-react'
import type { TipoCanal, TipoContenido } from '@/tipos/inbox'

/**
 * Compositor de mensajes — barra inferior del chat.
 * Soporta: texto, adjuntos (foto/video/doc), grabación de audio.
 */

interface PropiedadesCompositor {
  tipoCanal: TipoCanal
  onEnviar: (datos: DatosMensaje) => void
  cargando?: boolean
  placeholder?: string
  // Correo
  mostrarCamposCorreo?: boolean
  asuntoInicial?: string
  // Hilo interno
  respondiendo?: { id: string; texto: string; autor: string } | null
  onCancelarRespuesta?: () => void
  // Plantillas
  onAbrirPlantillas?: () => void
}

export interface DatosMensaje {
  texto: string
  tipo_contenido: TipoContenido
  // Archivo adjunto (se sube a Storage antes de enviar)
  archivo?: File
  // Correo
  correo_para?: string[]
  correo_cc?: string[]
  correo_asunto?: string
  html?: string
  // Hilo
  respuesta_a_id?: string
}

// Determinar tipo de contenido según MIME del archivo
function tipoContenidoDeArchivo(mime: string): TipoContenido {
  if (mime.startsWith('image/')) return 'imagen'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'documento'
}

export function CompositorMensaje({
  tipoCanal,
  onEnviar,
  cargando = false,
  placeholder,
  mostrarCamposCorreo = false,
  asuntoInicial = '',
  respondiendo = null,
  onCancelarRespuesta,
  onAbrirPlantillas,
}: PropiedadesCompositor) {
  const [texto, setTexto] = useState('')
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Grabación de audio
  const [grabando, setGrabando] = useState(false)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)
  const [audioGrabado, setAudioGrabado] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Campos de correo
  const [correoPara, setCorreoPara] = useState('')
  const [correoCC, setCorreoCC] = useState('')
  const [correoAsunto, setCorreoAsunto] = useState(asuntoInicial)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputArchivosRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  const ajustarAltura = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`
    }
  }, [])

  // Limpiar preview URL al desmontar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // ─── Enviar mensaje ───
  const handleEnviar = () => {
    // Enviar audio grabado
    if (audioGrabado) {
      const archivoAudio = new globalThis.File([audioGrabado], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' })
      onEnviar({
        texto: '',
        tipo_contenido: 'audio',
        archivo: archivoAudio,
      })
      setAudioGrabado(null)
      return
    }

    // Enviar archivo adjunto
    if (archivoSeleccionado) {
      onEnviar({
        texto: texto.trim(),
        tipo_contenido: tipoContenidoDeArchivo(archivoSeleccionado.type),
        archivo: archivoSeleccionado,
      })
      setArchivoSeleccionado(null)
      setPreviewUrl(null)
      setTexto('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      return
    }

    // Enviar texto
    if (!texto.trim() || cargando) return

    const datos: DatosMensaje = {
      texto: texto.trim(),
      tipo_contenido: 'texto',
    }

    if (tipoCanal === 'correo' && mostrarCamposCorreo) {
      datos.correo_para = correoPara.split(',').map(e => e.trim()).filter(Boolean)
      datos.correo_cc = correoCC ? correoCC.split(',').map(e => e.trim()).filter(Boolean) : undefined
      datos.correo_asunto = correoAsunto || undefined
    }

    if (respondiendo) {
      datos.respuesta_a_id = respondiendo.id
    }

    onEnviar(datos)
    setTexto('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  // ─── Seleccionar archivo ───
  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    setArchivoSeleccionado(archivo)

    // Preview para imágenes y videos
    if (archivo.type.startsWith('image/') || archivo.type.startsWith('video/')) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(archivo))
    } else {
      setPreviewUrl(null)
    }

    e.target.value = ''
  }

  const removerArchivo = () => {
    setArchivoSeleccionado(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  // ─── Grabación de audio ───
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/ogg' })
        setAudioGrabado(blob)
        // Liberar micrófono
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      mediaRecorderRef.current = recorder
      recorder.start(100) // chunks cada 100ms

      setGrabando(true)
      setTiempoGrabacion(0)
      intervalRef.current = setInterval(() => {
        setTiempoGrabacion(t => t + 1)
      }, 1000)
    } catch {
      // Permiso denegado o sin micrófono
      console.warn('No se pudo acceder al micrófono')
    }
  }

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setGrabando(false)
  }

  const descartarAudio = () => {
    setAudioGrabado(null)
    setTiempoGrabacion(0)
    // Si está grabando, cancelar
    if (grabando) {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setGrabando(false)
    }
  }

  const formatoTiempo = (s: number) => {
    const min = Math.floor(s / 60)
    const seg = s % 60
    return `${min}:${seg.toString().padStart(2, '0')}`
  }

  const tieneContenido = texto.trim() || archivoSeleccionado || audioGrabado

  return (
    <div
      className="flex-shrink-0"
      style={{
        borderTop: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Respondiendo a (hilos internos) */}
      <AnimatePresence>
        {respondiendo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2 flex items-center gap-2"
          >
            <div
              className="flex-1 px-2 py-1 rounded text-xs truncate"
              style={{
                borderLeft: '2px solid var(--texto-marca)',
                background: 'var(--superficie-hover)',
                color: 'var(--texto-secundario)',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--texto-marca)' }}>
                {respondiendo.autor}
              </span>
              <span className="ml-1">{respondiendo.texto}</span>
            </div>
            <button onClick={onCancelarRespuesta}>
              <X size={14} style={{ color: 'var(--texto-terciario)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campos de correo */}
      {tipoCanal === 'correo' && mostrarCamposCorreo && (
        <div className="px-3 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>Para:</span>
            <input
              type="text"
              value={correoPara}
              onChange={(e) => setCorreoPara(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="destinatario@correo.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>CC:</span>
            <input
              type="text"
              value={correoCC}
              onChange={(e) => setCorreoCC(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="cc@correo.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
            <input
              type="text"
              value={correoAsunto}
              onChange={(e) => setCorreoAsunto(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none font-medium"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="Asunto del correo"
            />
          </div>
          <div style={{ borderBottom: '1px solid var(--borde-sutil)' }} />
        </div>
      )}

      {/* Preview de archivo seleccionado */}
      <AnimatePresence>
        {archivoSeleccionado && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2"
          >
            <div
              className="flex items-center gap-2 p-2 rounded-lg relative"
              style={{ background: 'var(--superficie-hover)' }}
            >
              {/* Preview de imagen */}
              {previewUrl && archivoSeleccionado.type.startsWith('image/') && (
                <img src={previewUrl} alt="" className="w-16 h-16 rounded object-cover" />
              )}
              {/* Preview de video */}
              {previewUrl && archivoSeleccionado.type.startsWith('video/') && (
                <video src={previewUrl} className="w-16 h-16 rounded object-cover" muted />
              )}
              {/* Icono para documentos */}
              {!previewUrl && (
                <div
                  className="w-10 h-10 rounded flex items-center justify-center"
                  style={{ background: 'var(--superficie-elevada)' }}
                >
                  <ArchivoIcono tipo={archivoSeleccionado.type} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                  {archivoSeleccionado.name}
                </p>
                <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                  {archivoSeleccionado.size > 1048576
                    ? `${(archivoSeleccionado.size / 1048576).toFixed(1)} MB`
                    : `${(archivoSeleccionado.size / 1024).toFixed(0)} KB`}
                </p>
              </div>
              <button
                onClick={removerArchivo}
                className="p-1 rounded-full"
                style={{ color: 'var(--texto-terciario)' }}
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio grabado (listo para enviar) */}
      <AnimatePresence>
        {audioGrabado && !grabando && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2"
          >
            <div
              className="flex items-center gap-2 p-2 rounded-lg"
              style={{ background: 'var(--superficie-hover)' }}
            >
              <Mic size={16} style={{ color: 'var(--canal-whatsapp)' }} />
              <span className="text-xs flex-1" style={{ color: 'var(--texto-primario)' }}>
                Nota de voz ({formatoTiempo(tiempoGrabacion)})
              </span>
              <button onClick={descartarAudio} className="p-1" style={{ color: 'var(--texto-terciario)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de input */}
      <div className="flex items-end gap-2 p-3">
        {/* Grabando audio — reemplaza toda la barra */}
        {grabando ? (
          <div className="flex-1 flex items-center gap-3">
            <button
              onClick={descartarAudio}
              className="p-2 rounded-lg"
              style={{ color: 'var(--texto-terciario)' }}
              title="Cancelar"
            >
              <Trash2 size={18} />
            </button>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: 'var(--insignia-peligro)' }}
            />
            <span className="text-sm font-mono flex-1" style={{ color: 'var(--texto-primario)' }}>
              {formatoTiempo(tiempoGrabacion)}
            </span>
            <button
              onClick={detenerGrabacion}
              className="p-2 rounded-lg"
              style={{ background: 'var(--insignia-peligro)', color: '#fff' }}
              title="Detener grabación"
            >
              <StopCircle size={18} />
            </button>
          </div>
        ) : (
          <>
            {/* Botón adjuntar */}
            <button
              onClick={() => inputArchivosRef.current?.click()}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--texto-terciario)' }}
              title="Adjuntar archivo"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={inputArchivosRef}
              type="file"
              onChange={handleArchivo}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />

            {/* Plantillas */}
            {onAbrirPlantillas && (
              <button
                onClick={onAbrirPlantillas}
                className="p-2 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--texto-terciario)' }}
                title="Plantillas"
              >
                <FileText size={18} />
              </button>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                ajustarAltura()
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || 'Escribir mensaje...'}
              rows={1}
              className="flex-1 resize-none text-sm bg-transparent outline-none py-2"
              style={{ color: 'var(--texto-primario)', maxHeight: 150 }}
            />

            {/* Botón grabar audio (solo WhatsApp, cuando no hay texto ni archivo) */}
            {tipoCanal === 'whatsapp' && !tieneContenido && (
              <button
                onClick={iniciarGrabacion}
                className="p-2 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--texto-terciario)' }}
                title="Grabar nota de voz"
              >
                <Mic size={18} />
              </button>
            )}

            {/* Botón enviar */}
            {(tieneContenido || audioGrabado) && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleEnviar}
                disabled={cargando}
                className="p-2 rounded-lg flex-shrink-0 transition-colors"
                style={{
                  background: 'var(--texto-marca)',
                  color: '#fff',
                  opacity: cargando ? 0.5 : 1,
                }}
              >
                <Send size={18} />
              </motion.button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ArchivoIcono({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <Image size={16} style={{ color: 'var(--texto-marca)' }} />
  if (tipo.startsWith('video/')) return <Film size={16} style={{ color: 'var(--texto-marca)' }} />
  return <File size={16} style={{ color: 'var(--texto-marca)' }} />
}
