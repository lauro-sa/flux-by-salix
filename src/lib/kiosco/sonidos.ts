/**
 * Sonidos sintetizados con Web Audio API para el kiosco.
 * No requiere archivos de audio — todo se genera en el navegador.
 */

let contextoAudio: AudioContext | null = null

function obtenerContexto(): AudioContext {
  if (!contextoAudio) {
    contextoAudio = new AudioContext()
  }
  // Reanudar si está suspendido (política de autoplay)
  if (contextoAudio.state === 'suspended') {
    contextoAudio.resume()
  }
  return contextoAudio
}

/** Tono corto ascendente — fichaje exitoso */
export function sonarEntrada() {
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(523, ctx.currentTime) // Do5
  osc.frequency.linearRampToValueAtTime(784, ctx.currentTime + 0.15) // Sol5

  ganancia.gain.setValueAtTime(0.3, ctx.currentTime)
  ganancia.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

  osc.connect(ganancia)
  ganancia.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}

/** Tono descendente corto — error */
export function sonarError() {
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, ctx.currentTime) // La4
  osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.25) // La3

  ganancia.gain.setValueAtTime(0.3, ctx.currentTime)
  ganancia.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)

  osc.connect(ganancia)
  ganancia.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.35)
}

/** Arpa mágica — cumpleaños entrada (cascada 9 notas Do Mayor) */
export function sonarCumpleanosEntrada() {
  const ctx = obtenerContexto()
  // Do Mayor: C5, D5, E5, F5, G5, A5, B5, C6, E6
  const notas = [523, 587, 659, 698, 784, 880, 988, 1047, 1319]
  const intervalo = 0.08

  notas.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const ganancia = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    const inicio = ctx.currentTime + i * intervalo
    ganancia.gain.setValueAtTime(0, inicio)
    ganancia.gain.linearRampToValueAtTime(0.25, inicio + 0.02)
    ganancia.gain.exponentialRampToValueAtTime(0.01, inicio + 0.6)

    osc.connect(ganancia)
    ganancia.connect(ctx.destination)
    osc.start(inicio)
    osc.stop(inicio + 0.6)
  })
}

/** Fanfarria — cumpleaños salida (trompeta square + sawtooth) */
export function sonarCumpleanosSalida() {
  const ctx = obtenerContexto()
  // Fanfarria: Sol4-Sol4-Sol4-Do5 (patrón de trompeta)
  const notas = [
    { freq: 392, dur: 0.12, inicio: 0 },
    { freq: 392, dur: 0.12, inicio: 0.15 },
    { freq: 392, dur: 0.12, inicio: 0.3 },
    { freq: 523, dur: 0.4, inicio: 0.45 },
  ]

  notas.forEach(({ freq, dur, inicio }) => {
    // Square wave (trompeta)
    const osc1 = ctx.createOscillator()
    const gan1 = ctx.createGain()
    osc1.type = 'square'
    osc1.frequency.setValueAtTime(freq, ctx.currentTime)
    gan1.gain.setValueAtTime(0.12, ctx.currentTime + inicio)
    gan1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + inicio + dur)
    osc1.connect(gan1)
    gan1.connect(ctx.destination)
    osc1.start(ctx.currentTime + inicio)
    osc1.stop(ctx.currentTime + inicio + dur + 0.1)

    // Sawtooth (brillo)
    const osc2 = ctx.createOscillator()
    const gan2 = ctx.createGain()
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime)
    gan2.gain.setValueAtTime(0.05, ctx.currentTime + inicio)
    gan2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + inicio + dur)
    osc2.connect(gan2)
    gan2.connect(ctx.destination)
    osc2.start(ctx.currentTime + inicio)
    osc2.stop(ctx.currentTime + inicio + dur + 0.1)
  })
}
