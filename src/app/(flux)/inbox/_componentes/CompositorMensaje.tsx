'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Pause, X, Image, Film, File, FileText, Trash2,
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
  const [pausado, setPausado] = useState(false)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)
  const [audioGrabado, setAudioGrabado] = useState<Blob | null>(null)
  const [waveformBarras, setWaveformBarras] = useState<number[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const waveformFrameRef = useRef<number>(0)
  const enviarAlDetenerRef = useRef(false)

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

  const [convirtiendo, setConvirtiendo] = useState(false)

  // ─── Enviar mensaje ───
  const handleEnviar = async () => {
    // Audio se envía directamente desde enviarGrabacion() — no llega acá

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

  // ─── Grabación de audio con waveform en vivo ───
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      setWaveformBarras([])
      enviarAlDetenerRef.current = false

      // Audio analyser para waveform en vivo
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      // Capturar waveform
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const capturarWaveform = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        // Promedio de las frecuencias como altura de la barra
        const promedio = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizado = Math.min(1, promedio / 128)
        setWaveformBarras(prev => [...prev.slice(-80), normalizado])
        waveformFrameRef.current = requestAnimationFrame(capturarWaveform)
      }
      waveformFrameRef.current = requestAnimationFrame(capturarWaveform)

      // MediaRecorder
      const mimePreferido =
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : 'audio/webm;codecs=opus'

      const recorder = new MediaRecorder(stream, { mimeType: mimePreferido })
      const mimeReal = recorder.mimeType

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeReal })
        // Limpiar analyser
        cancelAnimationFrame(waveformFrameRef.current)
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        analyserRef.current = null
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        if (enviarAlDetenerRef.current) {
          // Envío directo: no mostrar preview, enviar inmediatamente
          setGrabando(false)
          setPausado(false)
          setAudioGrabado(blob)
          // Trigger envío automático
          setTimeout(() => enviarAudioDirecto(blob), 50)
        } else {
          // Descartado — no guardar
          setGrabando(false)
          setPausado(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(100)

      setGrabando(true)
      setPausado(false)
      setTiempoGrabacion(0)
      intervalRef.current = setInterval(() => {
        setTiempoGrabacion(t => t + 1)
      }, 1000)
    } catch {
      console.warn('No se pudo acceder al micrófono')
    }
  }

  const pausarGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setPausado(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
      cancelAnimationFrame(waveformFrameRef.current)
    }
  }

  const continuarGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setPausado(false)
      intervalRef.current = setInterval(() => setTiempoGrabacion(t => t + 1), 1000)
      // Retomar waveform
      const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount)
      const capturar = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const promedio = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setWaveformBarras(prev => [...prev.slice(-80), Math.min(1, promedio / 128)])
        waveformFrameRef.current = requestAnimationFrame(capturar)
      }
      waveformFrameRef.current = requestAnimationFrame(capturar)
    }
  }

  // Enviar: detiene grabación y envía automáticamente
  const enviarGrabacion = () => {
    enviarAlDetenerRef.current = true
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (mediaRecorderRef.current?.state === 'paused') mediaRecorderRef.current.resume()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  // Descartar: detiene y elimina
  const descartarAudio = () => {
    enviarAlDetenerRef.current = false
    setAudioGrabado(null)
    setTiempoGrabacion(0)
    setWaveformBarras([])
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    cancelAnimationFrame(waveformFrameRef.current)
    if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setGrabando(false)
    setPausado(false)
  }

  // Envío directo de audio (sin pasar por preview)
  const enviarAudioDirecto = async (blob: Blob) => {
    setConvirtiendo(true)
    try {
      const { convertirAudioAMp3 } = await import('@/lib/convertir-audio')
      const mp3Blob = await convertirAudioAMp3(blob)
      onEnviar({
        texto: '',
        tipo_contenido: 'audio',
        archivo: new globalThis.File([mp3Blob], `audio_${Date.now()}.mp3`, { type: 'audio/mpeg' }),
      })
    } catch {
      // Fallback: enviar raw
      const ext = blob.type.includes('mp4') ? '.mp4' : '.webm'
      onEnviar({
        texto: '',
        tipo_contenido: 'audio',
        archivo: new globalThis.File([blob], `audio_${Date.now()}${ext}`, { type: blob.type }),
      })
    } finally {
      setConvirtiendo(false)
      setAudioGrabado(null)
      setWaveformBarras([])
      setTiempoGrabacion(0)
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

      {/* Barra de input */}
      <div className="flex items-end gap-2 p-3">
        {/* Grabando audio estilo WhatsApp — waveform en vivo */}
        {grabando || convirtiendo ? (
          <div className="flex-1 flex items-center gap-2.5">
            {/* Eliminar */}
            <button
              onClick={descartarAudio}
              className="p-2 rounded-lg flex-shrink-0"
              style={{ color: 'var(--texto-terciario)' }}
              title="Descartar"
            >
              <Trash2 size={18} />
            </button>

            {/* Timer */}
            <span className="text-sm font-mono w-10 flex-shrink-0" style={{ color: 'var(--texto-primario)' }}>
              {formatoTiempo(tiempoGrabacion)}
            </span>

            {/* Waveform en vivo */}
            <div className="flex-1 flex items-center h-8 gap-px overflow-hidden">
              {waveformBarras.map((altura, i) => (
                <div
                  key={i}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 2.5,
                    height: `${Math.max(8, altura * 100)}%`,
                    background: pausado ? 'var(--texto-terciario)' : 'var(--texto-primario)',
                    opacity: pausado ? 0.4 : 0.7,
                  }}
                />
              ))}
              {/* Indicador pulsante si está grabando activamente */}
              {!pausado && !convirtiendo && (
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 rounded-full flex-shrink-0 ml-1"
                  style={{ background: 'var(--insignia-peligro)' }}
                />
              )}
            </div>

            {/* Pausa / Continuar */}
            <button
              onClick={pausado ? continuarGrabacion : pausarGrabacion}
              className="p-2 rounded-full flex-shrink-0"
              style={{
                border: '2px solid var(--insignia-peligro)',
                color: 'var(--insignia-peligro)',
                background: 'transparent',
              }}
              title={pausado ? 'Continuar' : 'Pausar'}
            >
              {pausado ? <Mic size={16} /> : <Pause size={16} />}
            </button>

            {/* Enviar */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={enviarGrabacion}
              disabled={convirtiendo}
              className="p-2.5 rounded-full flex-shrink-0"
              style={{
                background: 'var(--canal-whatsapp)',
                color: '#fff',
                opacity: convirtiendo ? 0.5 : 1,
              }}
              title="Enviar audio"
            >
              <Send size={16} />
            </motion.button>
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
                disabled={cargando || convirtiendo}
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
