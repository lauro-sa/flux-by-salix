'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Send, MicOff } from 'lucide-react'

/**
 * GrabadorAudio — componente de grabación de audio estilo WhatsApp.
 * Reemplaza el compositor cuando está activo.
 * Muestra: punto rojo pulsante + tiempo transcurrido + waveform + cancelar/enviar.
 * Compatible con PC, web, iOS Safari, PWA vía MediaRecorder API.
 */

interface PropiedadesGrabadorAudio {
  /** Callback al completar la grabación. Recibe el Blob de audio y duración en segundos */
  onGrabacionCompleta: (audio: Blob, duracion: number) => void
  /** Callback para cancelar la grabación */
  onCancelar: () => void
  /** Si el grabador está visible/activo */
  activo: boolean
}

// Duración máxima en segundos (5 minutos)
const DURACION_MAXIMA = 300
// Advertencia a los 4:30
const UMBRAL_ADVERTENCIA = 270
// Cantidad de barras en el waveform
const CANTIDAD_BARRAS = 30
// Intervalo de actualización del waveform en ms
const INTERVALO_WAVEFORM = 100

/**
 * Detecta el tipo MIME soportado por el navegador para grabación de audio.
 * Orden de preferencia: OGG Opus > WebM Opus > MP4 (iOS Safari fallback)
 */
function obtenerMimeSoportado(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  const candidatos = [
    'audio/ogg; codecs=opus',
    'audio/webm; codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  for (const mime of candidatos) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  // Último recurso — dejar que el navegador elija
  return ''
}

/** Formatea segundos a MM:SS */
function formatoTiempo(segundos: number): string {
  const min = Math.floor(segundos / 60)
  const seg = segundos % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

export function GrabadorAudio({
  onGrabacionCompleta,
  onCancelar,
  activo,
}: PropiedadesGrabadorAudio) {
  // ─── Estado ───
  const [segundos, setSegundos] = useState(0)
  const [barras, setBarras] = useState<number[]>(() => new Array(CANTIDAD_BARRAS).fill(2))
  const [error, setError] = useState<string | null>(null)
  const [advertencia, setAdvertencia] = useState(false)

  // ─── Refs ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inicioRef = useRef<number>(0)
  const mimeSoportadoRef = useRef<string>('')
  const enviarAlDetenerRef = useRef(false)
  const activoAnteriorRef = useRef(false)

  // ─── Limpieza de recursos ───
  const limpiarRecursos = useCallback(() => {
    // Detener timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Detener waveform
    if (waveformRef.current) {
      clearInterval(waveformRef.current)
      waveformRef.current = null
    }
    // Cerrar AudioContext
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
      analyserRef.current = null
    }
    // Detener MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch { /* ya detenido */ }
    }
    mediaRecorderRef.current = null
    // Detener stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
  }, [])

  // ─── Iniciar grabación ───
  const iniciarGrabacion = useCallback(async () => {
    setError(null)
    setAdvertencia(false)
    setSegundos(0)
    setBarras(new Array(CANTIDAD_BARRAS).fill(2))
    enviarAlDetenerRef.current = false

    try {
      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // AudioContext + AnalyserNode para waveform
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      // iOS Safari: resumir contexto en gesto de usuario
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      audioCtxRef.current = ctx

      const fuente = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      fuente.connect(analyser)
      analyserRef.current = analyser

      // MediaRecorder
      const mime = obtenerMimeSoportado()
      mimeSoportadoRef.current = mime
      const opciones: MediaRecorderOptions = mime ? { mimeType: mime } : {}
      const recorder = new MediaRecorder(stream, opciones)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (enviarAlDetenerRef.current && chunksRef.current.length > 0) {
          const tipoFinal = mimeSoportadoRef.current || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: tipoFinal })
          const duracion = Math.round((Date.now() - inicioRef.current) / 1000)
          onGrabacionCompleta(blob, duracion)
        }
        // Limpiar siempre después del stop
        limpiarRecursos()
      }

      // Iniciar grabación — timeslice para ir recibiendo datos periódicamente
      recorder.start(250)
      inicioRef.current = Date.now()

      // Timer de segundos
      timerRef.current = setInterval(() => {
        setSegundos(prev => {
          const nuevo = prev + 1
          // Advertencia a 4:30
          if (nuevo >= UMBRAL_ADVERTENCIA && nuevo < DURACION_MAXIMA) {
            setAdvertencia(true)
          }
          // Auto-detener a 5 minutos
          if (nuevo >= DURACION_MAXIMA) {
            enviarAlDetenerRef.current = true
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop()
            }
          }
          return nuevo
        })
      }, 1000)

      // Waveform — leer frecuencias cada INTERVALO_WAVEFORM ms
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      waveformRef.current = setInterval(() => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const nuevasBarras: number[] = []
        const paso = Math.max(1, Math.floor(bufferLength / CANTIDAD_BARRAS))
        for (let i = 0; i < CANTIDAD_BARRAS; i++) {
          const idx = Math.min(i * paso, bufferLength - 1)
          // Mapear 0-255 a 2-24px de altura
          const altura = Math.max(2, Math.round((dataArray[idx] / 255) * 24))
          nuevasBarras.push(altura)
        }
        setBarras(nuevasBarras)
      }, INTERVALO_WAVEFORM)
    } catch (err) {
      // Permiso denegado o error al acceder al micrófono
      const mensaje = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Permiso de micrófono denegado. Habilítalo en la configuración del navegador.'
        : 'No se pudo acceder al micrófono. Verifica que tu dispositivo tenga uno disponible.'
      setError(mensaje)
      limpiarRecursos()
    }
  }, [onGrabacionCompleta, limpiarRecursos])

  // ─── Enviar grabación ───
  const enviarGrabacion = useCallback(() => {
    enviarAlDetenerRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // ─── Cancelar grabación ───
  const cancelarGrabacion = useCallback(() => {
    enviarAlDetenerRef.current = false
    limpiarRecursos()
    setSegundos(0)
    setBarras(new Array(CANTIDAD_BARRAS).fill(2))
    setError(null)
    setAdvertencia(false)
    onCancelar()
  }, [limpiarRecursos, onCancelar])

  // ─── Efecto: iniciar/detener según prop activo ───
  useEffect(() => {
    if (activo && !activoAnteriorRef.current) {
      iniciarGrabacion()
    } else if (!activo && activoAnteriorRef.current) {
      // Se desactivó externamente — limpiar sin enviar
      enviarAlDetenerRef.current = false
      limpiarRecursos()
      setSegundos(0)
      setBarras(new Array(CANTIDAD_BARRAS).fill(2))
      setError(null)
      setAdvertencia(false)
    }
    activoAnteriorRef.current = activo
  }, [activo, iniciarGrabacion, limpiarRecursos])

  // ─── Limpiar al desmontar ───
  useEffect(() => {
    return () => {
      enviarAlDetenerRef.current = false
      limpiarRecursos()
    }
  }, [limpiarRecursos])

  return (
    <AnimatePresence>
      {activo && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--superficie-tarjeta) 92%, var(--insignia-peligro) 8%)',
            border: '1px solid var(--borde-sutil)',
          }}
        >
          {/* ─── Error de permisos ─── */}
          {error ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MicOff
                size={20}
                style={{ color: 'var(--insignia-peligro)', flexShrink: 0 }}
              />
              <span
                className="text-sm truncate"
                style={{ color: 'var(--insignia-peligro)' }}
              >
                {error}
              </span>
              <button
                type="button"
                onClick={cancelarGrabacion}
                className="ml-auto flex-shrink-0 flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 44,
                  height: 44,
                  color: 'var(--texto-secundario)',
                  background: 'transparent',
                }}
                aria-label="Cerrar"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ) : (
            <>
              {/* ─── Botón cancelar (izquierda) ─── */}
              <button
                type="button"
                onClick={cancelarGrabacion}
                className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--superficie-hover)]"
                style={{
                  width: 44,
                  height: 44,
                  color: 'var(--texto-secundario)',
                }}
                aria-label="Cancelar grabación"
              >
                <Trash2 size={20} />
              </button>

              {/* ─── Punto rojo pulsante ─── */}
              <span
                className="grabador-punto-rojo flex-shrink-0"
                aria-hidden="true"
              />

              {/* ─── Tiempo transcurrido ─── */}
              <span
                className="text-sm tabular-nums flex-shrink-0 select-none"
                style={{
                  fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
                  color: advertencia ? 'var(--insignia-peligro)' : 'var(--texto-primario)',
                  fontWeight: 500,
                  minWidth: '3.5rem',
                }}
              >
                {formatoTiempo(segundos)}
              </span>

              {/* ─── Waveform ─── */}
              <div
                className="flex items-center gap-[2px] flex-1 min-w-0 justify-center overflow-hidden"
                style={{ height: 28 }}
                aria-label="Visualización de audio"
              >
                {barras.map((altura, i) => (
                  <div
                    key={i}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 3,
                      height: altura,
                      backgroundColor: 'var(--canal-whatsapp)',
                      opacity: 0.7 + (altura / 24) * 0.3,
                      transition: 'height 100ms ease-out',
                    }}
                  />
                ))}
              </div>

              {/* ─── Advertencia de tiempo ─── */}
              {advertencia && (
                <span
                  className="text-xs flex-shrink-0 select-none"
                  style={{ color: 'var(--insignia-peligro)' }}
                >
                  Máx 5:00
                </span>
              )}

              {/* ─── Botón enviar (derecha) ─── */}
              <button
                type="button"
                onClick={enviarGrabacion}
                className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: 'var(--canal-whatsapp)',
                  color: '#fff',
                }}
                aria-label="Enviar grabación de audio"
              >
                <Send size={20} />
              </button>
            </>
          )}

          {/* ─── Estilos para la animación del punto rojo ─── */}
          <style jsx>{`
            .grabador-punto-rojo {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: var(--insignia-peligro);
              animation: grabador-pulso 1.2s ease-in-out infinite;
            }
            @keyframes grabador-pulso {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.85); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
