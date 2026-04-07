'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Pause, X, Image, Film, File, FileText, Trash2,
  StickyNote, AlarmClock,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import type { TipoCanal, TipoContenido } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { SelectorRespuestasRapidas } from './SelectorRespuestasRapidas'
import { Popover } from '@/componentes/ui/Popover'
import {
  type FormatoNombreRemitente,
  FORMATOS_NOMBRE_REMITENTE,
  generarNombreRemitente,
} from '@/lib/nombre-remitente'
import { Check, PenLine, Ban, Clock, Sparkles, ChevronUp, ChevronDown } from 'lucide-react'
import { PopoverProgramar } from './PopoverProgramar'
import type { ProgramadoPendiente } from './PopoverProgramar'

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
  /** Callback para fijar firma como default para todos los chats */
  onFijarFirmaDefault?: (formato: FormatoNombreRemitente | 'sin_firma') => void
  /** Callback para fijar firma para este contacto */
  onFijarFirmaContacto?: (formato: FormatoNombreRemitente | 'sin_firma') => void
  /** Nombre del contacto (para el label "Fijar para X") */
  nombreContacto?: string
  /** Fecha/hora programada seleccionada (ISO string). Si existe, el envío será programado */
  programadoPara?: string | null
  /** Callback para quitar la programación */
  onQuitarProgramacion?: () => void
  /** Callback al seleccionar fecha/hora desde el popover de programar */
  onProgramar?: (fechaHora: string) => void
  /** Mensaje programado pendiente (para mostrar en el popover) */
  programadoPendiente?: ProgramadoPendiente | null
  /** Callback para cancelar un programado pendiente desde el popover */
  onCancelarProgramado?: () => void
  /** Si true, muestra botón Salix IA en la barra */
  iaHabilitada?: boolean
  /** Si el panel IA está expandido */
  iaExpandida?: boolean
  /** Callback al tocar botón Salix IA */
  onToggleIA?: () => void
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
  onFijarFirmaDefault,
  onFijarFirmaContacto,
  nombreContacto,
  programadoPara,
  onQuitarProgramacion,
  onProgramar,
  programadoPendiente,
  onCancelarProgramado,
  iaHabilitada,
  iaExpandida,
  onToggleIA,
}: PropiedadesCompositor) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const [texto, setTexto] = useState('')
  const [esNotaInterna, setEsNotaInterna] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState<'firma' | 'programar' | null>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Cerrar panel al hacer clic fuera de la barra + panel
  useEffect(() => {
    if (!panelAbierto) return
    const handler = (e: MouseEvent) => {
      if (barraRef.current && !barraRef.current.contains(e.target as Node)) {
        setPanelAbierto(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelAbierto])

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

  // Sincronizar texto inyectado externamente (ej. sugerencia de PanelIA, limpiar tras programar).
  // textoInicialVersion permite re-insertar el mismo texto si se clickea dos veces.
  useEffect(() => {
    if (textoInicial !== undefined) {
      setTexto(textoInicial)
      onCambioTexto?.(textoInicial)
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
      const { nombre, apellido, sector } = datosUsuario
      const inicialAp = apellido ? apellido[0].toUpperCase() : ''
      const iniciales = `${nombre ? nombre[0].toUpperCase() : ''}${inicialAp}`
      let firma = ''
      switch (formatoFirma) {
        case 'solo_sector': firma = sector || nombre; break
        case 'nombre_inicial_sector': firma = sector ? `${nombre} ${inicialAp} | ${sector}` : `${nombre} ${inicialAp}`; break
        case 'iniciales_sector': firma = sector ? `${iniciales} | ${sector}` : iniciales; break
        default: firma = sector ? `${nombre} ${inicialAp} | ${sector}` : `${nombre} ${inicialAp}`
      }
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

      {/* Barra de acciones: Firma | Salix IA | Programar envío */}
      {tipoCanal === 'whatsapp' && !esNotaInterna && !grabando && (() => {
        const sector = datosUsuario?.sector
        const nombre = datosUsuario?.nombre || ''
        const apellido = datosUsuario?.apellido || ''
        const inicialAp = apellido ? apellido[0].toUpperCase() : ''
        const iniciales = `${nombre ? nombre[0].toUpperCase() : ''}${inicialAp}`
        const OPCIONES_FIRMA: { valor: string; preview: string; desc: string }[] = [
          { valor: 'sin_firma', preview: '', desc: 'Sin encabezado' },
          ...(sector ? [{ valor: 'solo_sector', preview: sector, desc: 'Solo sector' }] : []),
          { valor: 'nombre_inicial_sector', preview: sector ? `${nombre} ${inicialAp} | ${sector}` : `${nombre} ${inicialAp}`, desc: 'Nombre + sector' },
          { valor: 'iniciales_sector', preview: sector ? `${iniciales} | ${sector}` : iniciales, desc: 'Iniciales + sector' },
        ]
        const opcionActiva = OPCIONES_FIRMA.find(o => o.valor === formatoFirma) || OPCIONES_FIRMA[0]
        const tieneFirma = opcionActiva.valor !== 'sin_firma'

        const tieneProgramar = !!onProgramar
        const tieneIA = !!iaHabilitada
        const secciones = [!!datosUsuario, tieneIA, tieneProgramar].filter(Boolean).length
        const anchoPorSeccion = secciones > 0 ? `${100 / secciones}%` : '100%'

        return (
          <div ref={barraRef}>
            {/* Barra de botones */}
            <div className="flex items-stretch" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
              {/* Firma */}
              {datosUsuario && (
                <div
                  style={{ width: anchoPorSeccion }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors ${panelAbierto === 'firma' ? 'bg-[var(--superficie-hover)]' : 'hover:bg-[var(--superficie-hover)]'}`}
                  onClick={() => setPanelAbierto(panelAbierto === 'firma' ? null : 'firma')}
                >
                  <PenLine size={10} className="shrink-0" style={{ color: panelAbierto === 'firma' ? 'var(--texto-marca)' : 'var(--texto-terciario)' }} />
                  <span className="text-xxs truncate" style={{ color: tieneFirma ? 'var(--texto-secundario)' : 'var(--texto-terciario)' }}>
                    {tieneFirma ? `*${opcionActiva.preview}:*` : 'Sin firma'}
                  </span>
                </div>
              )}

              {datosUsuario && (tieneIA || tieneProgramar) && (
                <div className="w-px self-stretch" style={{ background: 'var(--borde-sutil)' }} />
              )}

              {/* Salix IA */}
              {tieneIA && (
                <div
                  style={{ width: anchoPorSeccion }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors ${iaExpandida ? 'bg-[var(--superficie-hover)]' : 'hover:bg-[var(--superficie-hover)]'}`}
                  onClick={() => { setPanelAbierto(null); onToggleIA?.() }}
                >
                  <Sparkles size={10} className="shrink-0" style={{ color: 'var(--texto-marca)' }} />
                  <span className="text-xxs font-medium" style={{ color: iaExpandida ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
                    Salix IA
                  </span>
                  {iaExpandida
                    ? <ChevronDown size={10} style={{ color: 'var(--texto-terciario)' }} />
                    : <ChevronUp size={10} style={{ color: 'var(--texto-terciario)' }} />
                  }
                </div>
              )}

              {tieneProgramar && (datosUsuario || tieneIA) && (
                <div className="w-px self-stretch" style={{ background: 'var(--borde-sutil)' }} />
              )}

              {/* Programar envío */}
              {tieneProgramar && (
                <div
                  style={{ width: anchoPorSeccion }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors ${panelAbierto === 'programar' ? 'bg-[var(--superficie-hover)]' : 'hover:bg-[var(--superficie-hover)]'}`}
                  onClick={() => setPanelAbierto(panelAbierto === 'programar' ? null : 'programar')}
                >
                  {programadoPara ? (
                    <>
                      <AlarmClock size={10} className="shrink-0" style={{ color: 'var(--texto-marca)' }} />
                      <span className="text-xxs font-medium truncate" style={{ color: 'var(--texto-marca)' }}>
                        {new Intl.DateTimeFormat(formato.locale, {
                          weekday: 'short', day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        }).format(new Date(programadoPara))}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onQuitarProgramacion?.() }}
                        className="p-0.5 rounded hover:bg-[var(--superficie-hover)] transition-colors shrink-0"
                        style={{ color: 'var(--texto-terciario)' }}
                      >
                        <X size={11} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Clock size={10} className="shrink-0" style={{ color: panelAbierto === 'programar' ? 'var(--texto-marca)' : 'var(--texto-terciario)' }} />
                      <span className="text-xxs" style={{ color: panelAbierto === 'programar' ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
                        Programar envío
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Panel expandible: Firma */}
            <AnimatePresence>
              {panelAbierto === 'firma' && datosUsuario && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <div className="px-4 py-2.5 space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {OPCIONES_FIRMA.map((op) => {
                        const activo = formatoFirma === op.valor
                        return (
                          <button
                            key={op.valor}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                            style={{
                              background: activo ? 'color-mix(in srgb, var(--texto-marca) 12%, transparent)' : 'var(--superficie-tarjeta)',
                              color: activo ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                              border: activo ? '1px solid color-mix(in srgb, var(--texto-marca) 30%, transparent)' : '1px solid var(--borde-sutil)',
                            }}
                            onClick={() => {
                              onCambioFormatoFirma?.(op.valor as FormatoNombreRemitente | 'sin_firma')
                              setPanelAbierto(null)
                            }}
                          >
                            {op.valor === 'sin_firma' ? 'Sin firma' : `*${op.preview}:*`}
                            {activo && <Check size={11} />}
                          </button>
                        )
                      })}
                    </div>
                    {tieneFirma && (onFijarFirmaDefault || onFijarFirmaContacto) && (
                      <div className="flex gap-2 pt-1">
                        {onFijarFirmaDefault && (
                          <button
                            className="text-xxs hover:underline transition-colors"
                            style={{ color: 'var(--texto-terciario)' }}
                            onClick={() => { onFijarFirmaDefault(formatoFirma as FormatoNombreRemitente | 'sin_firma'); setPanelAbierto(null) }}
                          >
                            Usar para todos
                          </button>
                        )}
                        {onFijarFirmaContacto && nombreContacto && (
                          <button
                            className="text-xxs hover:underline transition-colors"
                            style={{ color: 'var(--texto-terciario)' }}
                            onClick={() => { onFijarFirmaContacto(formatoFirma as FormatoNombreRemitente | 'sin_firma'); setPanelAbierto(null) }}
                          >
                            Fijar para {nombreContacto}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Panel expandible: Programar envío */}
            <AnimatePresence>
              {panelAbierto === 'programar' && onProgramar && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <div className="px-4 py-2.5">
                    <PopoverProgramar
                      onProgramar={(fechaHora) => { onProgramar(fechaHora); setPanelAbierto(null) }}
                      programadoPendiente={programadoPendiente}
                      onCancelar={onCancelarProgramado}
                      renderInline
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })()}

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

            {/* Botón enviar / programar */}
            {(tieneContenido || audioGrabado) && (
              <Tooltip contenido={programadoPara ? 'Programar envío' : esNotaInterna ? t('inbox.nota_interna') : t('inbox.enviar')}>
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleEnviar}
                disabled={cargando || convirtiendo}
                className="p-2 rounded-lg flex-shrink-0 transition-colors"
                style={{
                  background: programadoPara
                    ? 'var(--texto-marca)'
                    : esNotaInterna ? 'var(--insignia-advertencia)' : 'var(--texto-marca)',
                  color: 'var(--texto-inverso)',
                  opacity: cargando ? 0.5 : 1,
                }}
              >
                {programadoPara ? <AlarmClock size={18} /> : esNotaInterna ? <StickyNote size={18} /> : <Send size={18} />}
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
