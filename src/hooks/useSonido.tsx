'use client'

/**
 * Hook para reproducir sonidos de la app (PWA).
 * Usa Web Audio API — no necesita archivos externos.
 * Se usa en: sidebar (ocultar/restaurar), toast, notificaciones, acciones.
 */

function crearContextoAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  } catch {
    return null
  }
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (!audioCtx) audioCtx = crearContextoAudio()
  if (audioCtx?.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Iniciar AudioContext con el primer gesto del usuario
if (typeof window !== 'undefined') {
  const iniciar = () => {
    getCtx()
    document.removeEventListener('click', iniciar)
    document.removeEventListener('touchstart', iniciar)
  }
  document.addEventListener('click', iniciar, { once: true })
  document.addEventListener('touchstart', iniciar, { once: true })
}

/** Reproduce un beep corto con frecuencia y duración */
function beep(frecuencia: number, duracion: number, volumen = 0.1, tipo: OscillatorType = 'sine') {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = tipo
  osc.frequency.setValueAtTime(frecuencia, ctx.currentTime)
  gain.gain.setValueAtTime(volumen, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duracion)
}

/** Sonidos predefinidos de Flux */
const sonidos = {
  /** Sonido suave al ocultar/deshabilitar — "puff" descendente */
  puff: () => {
    beep(600, 0.08, 0.06)
    setTimeout(() => beep(400, 0.1, 0.04), 40)
    setTimeout(() => beep(250, 0.15, 0.02), 80)
  },

  /** Sonido al restaurar/habilitar — "pop" ascendente */
  pop: () => {
    beep(400, 0.06, 0.05)
    setTimeout(() => beep(700, 0.08, 0.06), 50)
    setTimeout(() => beep(900, 0.06, 0.04), 90)
  },

  /** Click suave */
  click: () => {
    beep(800, 0.03, 0.04)
  },

  /** Éxito — acorde ascendente */
  exito: () => {
    beep(523, 0.1, 0.05)
    setTimeout(() => beep(659, 0.1, 0.05), 100)
    setTimeout(() => beep(784, 0.15, 0.04), 200)
  },

  /** Error — tono bajo */
  error: () => {
    beep(200, 0.15, 0.06, 'square')
    setTimeout(() => beep(150, 0.2, 0.04, 'square'), 100)
  },

  /** Notificación — ding suave */
  notificacion: () => {
    beep(880, 0.08, 0.05)
    setTimeout(() => beep(1100, 0.12, 0.04), 80)
  },

  /** Drop — al soltar un item arrastrado */
  drop: () => {
    beep(500, 0.05, 0.04)
    setTimeout(() => beep(700, 0.06, 0.03), 30)
  },

  /** Hover — ruido blanco cortísimo, como un roce suave */
  hover: () => {
    const ctx = getCtx()
    if (!ctx) return
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.015
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.03, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008)
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  },
}

function useSonido() {
  return sonidos
}

export { useSonido, sonidos }
