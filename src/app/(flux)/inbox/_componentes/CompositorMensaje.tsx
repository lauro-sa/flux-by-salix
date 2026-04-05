'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Pause, X, Image, Film, File, FileText, Trash2,
  StickyNote,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import type { TipoCanal, TipoContenido } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import { SelectorRespuestasRapidas } from './SelectorRespuestasRapidas'
import { Popover } from '@/componentes/ui/Popover'
import {
  type FormatoNombreRemitente,
  FORMATOS_NOMBRE_REMITENTE,
  generarNombreRemitente,
} from '@/lib/nombre-remitente'
import { Check, PenLine, Ban } from 'lucide-react'

/**
 * Compositor de mensajes — barra inferior del chat.
 * Soporta: texto, adjuntos (foto/video/doc), grabación de audio.
 */

interface PropiedadesCompositor {
  tipoCanal: TipoCanal
  onEnviar: (datos: DatosMensaje) => void
  cargando?: boolean
  placeholder?: string
  /** Texto inyectado externamente (ej. desde PanelIA). Cuando cambia, reemplaza el contenido del textarea */
  textoInicial?: string
  /** Incrementar para forzar re-inserción del mismo textoInicial */
  textoInicialVersion?: number
  // Correo
  mostrarCamposCorreo?: boolean
  asuntoInicial?: string
  // Hilo interno
  respondiendo?: { id: string; texto: string; autor: string } | null
  onCancelarRespuesta?: () => void
  // Plantillas
  onAbrirPlantillas?: () => void
  // Typing indicator
  conversacionId?: string
  // Notas internas
  /** Si true, muestra el toggle para enviar como nota interna */
  permitirNotasInternas?: boolean
  /** Callback cuando se envía nota interna (en vez de onEnviar normal) */
  onEnviarNotaInterna?: (texto: string) => void
  /** Callback cada vez que cambia el texto del compositor (para programar, etc.) */
  onCambioTexto?: (texto: string) => void
  /** Datos del usuario para la firma (WhatsApp) */
  datosUsuario?: { nombre: string; apellido: string; sector?: string | null }
  /** Formato de firma activo — null = sin firma */
  formatoFirma?: FormatoNombreRemitente | 'sin_firma' | null
  /** Callback cuando cambia el formato de firma */
  onCambioFormatoFirma?: (formato: FormatoNombreRemitente | 'sin_firma') => void
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
  // Nota interna (solo visible para agentes)
  es_nota_interna?: boolean
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
  textoInicial,
  textoInicialVersion,
  mostrarCamposCorreo = false,
  asuntoInicial = '',
  respondiendo = null,
  onCancelarRespuesta,
  onAbrirPlantillas,
  conversacionId,
  permitirNotasInternas = false,
  onEnviarNotaInterna,
  onCambioTexto,
  datosUsuario,
  formatoFirma,
  onCambioFormatoFirma,
}: PropiedadesCompositor) {
  const { t } = useTraduccion()
  const [texto, setTexto] = useState('')
  const [esNotaInterna, setEsNotaInterna] = useState(false)

  // Respuestas rápidas: popup con `/`
  const [rrVisible, setRrVisible] = useState(false)
  const [rrFiltro, setRrFiltro] = useState('')

  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Grabación de audio
  const [grabando, setGrabando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)
  const [audioGrabado, setAudioGrabado] = useState<Blob | null>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
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

  // Auto-resize textarea (un solo reflow usando requestAnimationFrame)
  const ajustarAltura = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.style.height = 'auto'
      const nueva = Math.min(el.scrollHeight, 150)
      el.style.height = `${nueva}px`
      // Permitir scroll interno cuando alcanza el máximo
      el.style.overflowY = el.scrollHeight > 150 ? 'auto' : 'hidden'
    })
  }, [])

  // Limpiar preview URL al desmontar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Sincronizar texto inyectado externamente (ej. sugerencia de PanelIA).
  // textoInicialVersion permite re-insertar el mismo texto si se clickea dos veces.
  useEffect(() => {
    if (textoInicial !== undefined && textoInicial !== '') {
      setTexto(textoInicial)
      // Ajustar altura del textarea tras insertar el texto
      setTimeout(ajustarAltura, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoInicial, textoInicialVersion, ajustarAltura])

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

    // Aplicar firma al texto (solo WhatsApp, solo mensajes normales, no notas internas)
    let textoFinal = texto.trim()
    if (tipoCanal === 'whatsapp' && !esNotaInterna && formatoFirma && formatoFirma !== 'sin_firma' && datosUsuario) {
      const firma = generarNombreRemitente(formatoFirma, datosUsuario)
      textoFinal = `*${firma}:*\n${textoFinal}`
    }

    const datos: DatosMensaje = {
      texto: textoFinal,
      tipo_contenido: 'texto',
      es_nota_interna: esNotaInterna || undefined,
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
      if (waveformRef.current) waveformRef.current.innerHTML = ''
      enviarAlDetenerRef.current = false

      // Audio analyser para waveform en vivo
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      // Capturar waveform con DOM directo (sin React state = sin re-renders)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const capturarWaveform = () => {
        if (!analyserRef.current || !waveformRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const inicio = Math.floor(100 / (ctx.sampleRate / analyser.fftSize))
        const fin = Math.floor(3000 / (ctx.sampleRate / analyser.fftSize))
        let suma = 0
        for (let i = inicio; i < fin && i < dataArray.length; i++) suma += dataArray[i]
        const promedio = suma / (fin - inicio)
        const altura = Math.min(100, Math.max(8, promedio * 1.2))

        // Agregar barra directamente al DOM
        const barra = document.createElement('div')
        barra.style.cssText = `width:2.5px;height:${altura}%;border-radius:9px;background:var(--texto-primario);opacity:0.7;flex-shrink:0;transition:height 0.1s`
        const contenedor = waveformRef.current
        contenedor.appendChild(barra)
        // Limitar a 60 barras
        while (contenedor.childElementCount > 60) {
          contenedor.removeChild(contenedor.firstChild!)
        }
        // Auto-scroll al final
        contenedor.scrollLeft = contenedor.scrollWidth
      }
      waveformFrameRef.current = window.setInterval(capturarWaveform, 150) as unknown as number

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
        clearInterval(waveformFrameRef.current)
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
      clearInterval(waveformFrameRef.current)
    }
  }

  const continuarGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setPausado(false)
      intervalRef.current = setInterval(() => setTiempoGrabacion(t => t + 1), 1000)
      // Retomar waveform con DOM directo
      if (analyserRef.current && audioCtxRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        const sampleRate = audioCtxRef.current.sampleRate
        const fftSize = analyserRef.current.fftSize
        const capturar = () => {
          if (!analyserRef.current || !waveformRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          const inicio = Math.floor(100 / (sampleRate / fftSize))
          const fin = Math.floor(3000 / (sampleRate / fftSize))
          let suma = 0
          for (let i = inicio; i < fin && i < dataArray.length; i++) suma += dataArray[i]
          const promedio = suma / (fin - inicio)
          const altura = Math.min(100, Math.max(8, promedio * 1.2))
          const barra = document.createElement('div')
          barra.style.cssText = `width:2.5px;height:${altura}%;border-radius:9px;background:var(--texto-primario);opacity:0.7;flex-shrink:0;transition:height 0.1s`
          waveformRef.current.appendChild(barra)
          while (waveformRef.current.childElementCount > 60) waveformRef.current.removeChild(waveformRef.current.firstChild!)
          waveformRef.current.scrollLeft = waveformRef.current.scrollWidth
        }
        waveformFrameRef.current = window.setInterval(capturar, 150) as unknown as number
      }
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
    if (waveformRef.current) waveformRef.current.innerHTML = ''
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    clearInterval(waveformFrameRef.current)
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

  // Cleanup al desmontar: liberar micrófono, cerrar AudioContext, limpiar intervalos
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      clearInterval(waveformFrameRef.current)
      if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
  }, [])

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
      if (waveformRef.current) waveformRef.current.innerHTML = ''
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
      className="flex-shrink-0 compositor-safe-area"
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
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={14} />} onClick={onCancelarRespuesta} titulo="Cancelar respuesta" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campos de correo */}
      {tipoCanal === 'correo' && mostrarCamposCorreo && (
        <div className="px-3 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>{t('inbox.para')}:</span>
            <Input
              tipo="text"
              value={correoPara}
              onChange={(e) => setCorreoPara(e.target.value)}
              className="flex-1 text-xs"
              placeholder="destinatario@correo.com"
              variante="plano"
              compacto
              formato="email"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>{t('inbox.cc')}:</span>
            <Input
              tipo="text"
              value={correoCC}
              onChange={(e) => setCorreoCC(e.target.value)}
              className="flex-1 text-xs"
              placeholder="cc@correo.com"
              variante="plano"
              compacto
              formato="email"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>{t('inbox.asunto')}:</span>
            <Input
              tipo="text"
              value={correoAsunto}
              onChange={(e) => setCorreoAsunto(e.target.value)}
              className="flex-1 text-xs font-medium"
              placeholder="Asunto del correo"
              variante="plano"
              compacto
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
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Remover archivo" icono={<X size={14} />} onClick={removerArchivo} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de nota interna activa */}
      <AnimatePresence>
        {esNotaInterna && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2 flex items-center gap-2"
          >
            <div
              className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
              style={{
                background: 'color-mix(in srgb, var(--insignia-advertencia) 12%, transparent)',
                color: 'var(--insignia-advertencia)',
              }}
            >
              <StickyNote size={12} />
              <span className="font-medium">{t('inbox.nota_interna')}</span>
              <span style={{ color: 'var(--texto-terciario)' }}>{t('inbox.solo_visible_agentes')}</span>
            </div>
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cerrar" icono={<X size={14} />} onClick={() => setEsNotaInterna(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de input */}
      <div className="flex items-end gap-2 p-3 relative">
        {/* Grabando audio estilo WhatsApp — waveform en vivo */}
        {grabando || convirtiendo ? (
          <div className="flex-1 flex items-center gap-2.5">
            {/* Eliminar */}
            <Boton variante="fantasma" tamano="sm" soloIcono icono={<Trash2 size={18} />} onClick={descartarAudio} titulo="Descartar" />

            {/* Timer */}
            <span className="text-sm font-mono w-10 flex-shrink-0" style={{ color: 'var(--texto-primario)' }}>
              {formatoTiempo(tiempoGrabacion)}
            </span>

            {/* Waveform en vivo (DOM directo, sin re-renders de React) */}
            <div
              ref={waveformRef}
              className="flex-1 flex items-center h-8 gap-px overflow-hidden"
              style={{ scrollBehavior: 'smooth' }}
            />
            {/* Indicador pulsante si está grabando activamente */}
            {!pausado && !convirtiendo && (
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'var(--insignia-peligro)' }}
              />
            )}

            {/* Pausa / Continuar */}
            <Boton
              variante="secundario"
              tamano="sm"
              soloIcono
              redondeado
              icono={pausado ? <Mic size={16} /> : <Pause size={16} />}
              onClick={pausado ? continuarGrabacion : pausarGrabacion}
              titulo={pausado ? 'Continuar' : 'Pausar'}
              style={{
                border: '2px solid var(--insignia-peligro)',
                color: 'var(--insignia-peligro)',
                background: 'transparent',
              }}
            />

            {/* Enviar */}
            <Tooltip contenido={t('inbox.enviar')}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={enviarGrabacion}
              disabled={convirtiendo}
              className="p-2.5 rounded-full flex-shrink-0"
              style={{
                background: 'var(--canal-whatsapp)',
                color: 'var(--texto-inverso)',
                opacity: convirtiendo ? 0.5 : 1,
              }}
            >
              <Send size={16} />
            </motion.button>
            </Tooltip>
          </div>
        ) : (
          <>
            {/* Popup de respuestas rápidas */}
            <SelectorRespuestasRapidas
              visible={rrVisible}
              canal={tipoCanal}
              filtro={rrFiltro}
              onSeleccionar={(contenido) => {
                setTexto(contenido)
                setRrVisible(false)
                setRrFiltro('')
                setTimeout(ajustarAltura, 0)
              }}
              onCerrar={() => {
                setRrVisible(false)
                setRrFiltro('')
              }}
            />

            {/* Botón adjuntar */}
            <Boton variante="fantasma" tamano="sm" soloIcono icono={<Paperclip size={18} />} onClick={() => inputArchivosRef.current?.click()} titulo={t('inbox.adjuntar')} />
            <input
              ref={inputArchivosRef}
              type="file"
              onChange={handleArchivo}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />

            {/* Plantillas */}
            {onAbrirPlantillas && (
              <Boton variante="fantasma" tamano="sm" soloIcono icono={<FileText size={18} />} onClick={onAbrirPlantillas} titulo="Plantillas" />
            )}

            {/* Toggle nota interna */}
            {permitirNotasInternas && (
              <Boton
                variante="fantasma"
                tamano="sm"
                soloIcono
                icono={<StickyNote size={18} />}
                onClick={() => setEsNotaInterna(!esNotaInterna)}
                titulo={esNotaInterna ? t('comun.cancelar') : t('inbox.nota_interna')}
                style={{
                  color: esNotaInterna ? 'var(--insignia-advertencia)' : 'var(--texto-terciario)',
                  background: esNotaInterna ? 'color-mix(in srgb, var(--insignia-advertencia) 12%, transparent)' : 'transparent',
                }}
              />
            )}

            {/* Píldora de firma (solo WhatsApp, cuando hay datos de usuario) */}
            {tipoCanal === 'whatsapp' && datosUsuario && !esNotaInterna && (
              <Popover
                alineacion="inicio"
                lado="arriba"
                ancho={280}
                altoMaximo={400}
                contenido={
                  <div className="py-1">
                    <p className="px-3 py-1.5 text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                      Firma del mensaje
                    </p>
                    <p className="px-3 pb-2 text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                      El cliente verá esta firma antes de cada mensaje
                    </p>
                    {/* Sin firma */}
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors"
                      style={{ color: formatoFirma === 'sin_firma' ? 'var(--texto-marca)' : 'var(--texto-secundario)' }}
                      onClick={() => onCambioFormatoFirma?.('sin_firma')}
                    >
                      <Ban size={14} className="shrink-0 opacity-60" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">Sin firma</div>
                        <div className="text-xxs opacity-60">El mensaje se envía sin encabezado</div>
                      </div>
                      {formatoFirma === 'sin_firma' && <Check size={14} className="shrink-0" />}
                    </button>
                    {/* Formatos */}
                    {FORMATOS_NOMBRE_REMITENTE.map((fmt) => {
                      const preview = datosUsuario ? fmt.ejemplo(datosUsuario) : fmt.valor
                      const activo = formatoFirma === fmt.valor
                      return (
                        <button
                          key={fmt.valor}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors"
                          style={{ color: activo ? 'var(--texto-marca)' : 'var(--texto-primario)' }}
                          onClick={() => onCambioFormatoFirma?.(fmt.valor)}
                        >
                          <PenLine size={14} className="shrink-0 opacity-40" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{preview}</div>
                            <div className="text-xxs opacity-60">{fmt.descripcion}</div>
                          </div>
                          {activo && <Check size={14} className="shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                }
              >
                <button
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xxs font-medium cursor-pointer transition-colors hover:bg-[var(--superficie-hover)]"
                  style={{
                    color: formatoFirma === 'sin_firma' ? 'var(--texto-terciario)' : 'var(--texto-marca)',
                    background: formatoFirma === 'sin_firma' ? 'transparent' : 'color-mix(in srgb, var(--texto-marca) 8%, transparent)',
                    border: 'none',
                  }}
                >
                  <PenLine size={10} />
                  {formatoFirma && formatoFirma !== 'sin_firma' && datosUsuario
                    ? `*${generarNombreRemitente(formatoFirma, datosUsuario)}:*`
                    : 'Sin firma'}
                </button>
              </Popover>
            )}

            {/* Textarea */}
            <TextArea
              ref={textareaRef}
              value={texto}
              maxLength={tipoCanal === 'whatsapp' ? 4096 : undefined}
              onChange={(e) => {
                const valor = e.target.value
                setTexto(valor)
                onCambioTexto?.(valor)
                ajustarAltura()

                // Detectar `/` al inicio para respuestas rápidas
                if (valor.startsWith('/')) {
                  setRrVisible(true)
                  setRrFiltro(valor.slice(1)) // todo después del `/`
                } else if (rrVisible) {
                  setRrVisible(false)
                  setRrFiltro('')
                }
              }}
              onKeyDown={(e) => {
                // Si el selector de RR está visible, no procesar Enter (lo maneja el selector)
                if (rrVisible && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                  return // el SelectorRespuestasRapidas captura estos eventos
                }
                handleKeyDown(e)
              }}
              placeholder={esNotaInterna ? t('inbox.placeholder_nota_interna') : (placeholder || t('inbox.escribir_mensaje'))}
              rows={1}
              variante="transparente"
              className="flex-1 resize-none text-sm py-2"
              style={{ color: esNotaInterna ? 'var(--insignia-advertencia)' : 'var(--texto-primario)', maxHeight: 150 }}
            />

            {/* Botón grabar audio (solo WhatsApp, cuando no hay texto ni archivo) */}
            {tipoCanal === 'whatsapp' && !tieneContenido && (
              <Boton variante="fantasma" tamano="sm" soloIcono icono={<Mic size={18} />} onClick={iniciarGrabacion} titulo={t('inbox.grabar_audio')} />
            )}

            {/* Bot��n enviar */}
            {(tieneContenido || audioGrabado) && (
              <Tooltip contenido={esNotaInterna ? t('inbox.nota_interna') : t('inbox.enviar')}>
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleEnviar}
                disabled={cargando || convirtiendo}
                className="p-2 rounded-lg flex-shrink-0 transition-colors"
                style={{
                  background: esNotaInterna ? 'var(--insignia-advertencia)' : 'var(--texto-marca)',
                  color: 'var(--texto-inverso)',
                  opacity: cargando ? 0.5 : 1,
                }}
              >
                {esNotaInterna ? <StickyNote size={18} /> : <Send size={18} />}
              </motion.button>
              </Tooltip>
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
