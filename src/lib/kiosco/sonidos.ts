/**
 * Sonidos sintetizados con Web Audio API para el kiosco.
 * 6 melodías de cumpleaños + entrada/error.
 * No requiere archivos de audio — todo se genera en el navegador.
 */

let contextoAudio: AudioContext | null = null

function obtenerContexto(): AudioContext {
  if (!contextoAudio) {
    contextoAudio = new AudioContext()
  }
  if (contextoAudio.state === 'suspended') {
    contextoAudio.resume()
  }
  return contextoAudio
}

/** Helper para generar un tono con envolvente */
function tocar(
  ctx: AudioContext,
  freq: number,
  inicio: number,
  dur: number,
  tipoOnda: OscillatorType = 'sine',
  volMax = 0.2,
  ataque = 0.02,
) {
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()
  osc.type = tipoOnda
  osc.connect(ganancia)
  ganancia.connect(ctx.destination)

  osc.frequency.setValueAtTime(freq, ctx.currentTime + inicio)
  ganancia.gain.setValueAtTime(0, ctx.currentTime + inicio)
  ganancia.gain.linearRampToValueAtTime(volMax, ctx.currentTime + inicio + ataque)
  ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur)

  osc.start(ctx.currentTime + inicio)
  osc.stop(ctx.currentTime + inicio + dur)
}

/** Tono ascendente — fichaje exitoso (440Hz → 880Hz) */
export function sonarEntrada() {
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()
  osc.connect(ganancia)
  ganancia.connect(ctx.destination)
  osc.frequency.setValueAtTime(440, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15)
  ganancia.gain.setValueAtTime(0.25, ctx.currentTime)
  ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
  osc.start()
  osc.stop(ctx.currentTime + 0.45)
}

/** Tono descendente — error (440Hz → 220Hz) */
export function sonarError() {
  const ctx = obtenerContexto()
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()
  osc.connect(ganancia)
  ganancia.connect(ctx.destination)
  osc.frequency.setValueAtTime(440, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.25)
  ganancia.gain.setValueAtTime(0.3, ctx.currentTime)
  ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
  osc.start()
  osc.stop(ctx.currentTime + 0.35)
}

// Melodías de cumpleaños: 1=Arpa, 2=Fanfarria (usadas por entrada/salida)
const SONIDO_CUMPLE_ENTRADA = 1
const SONIDO_CUMPLE_SALIDA = 2

/** Arpa Mágica — cascada brillante de notas (cumpleaños entrada) */
export function sonarCumpleanosEntrada() {
  const ctx = obtenerContexto()
  const notas = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98]
  notas.forEach((freq, idx) => tocar(ctx, freq, idx * 0.04, 0.8, 'sine', 0.2))
  const fin = notas.length * 0.04
  // Acorde sostenido al final
  ;[1046.50, 1318.51, 1567.98, 2093.00].forEach(f => tocar(ctx, f, fin, 1.5, 'sine', 0.15))
}

/** Fanfarria — trompeta clásica (cumpleaños salida) */
export function sonarCumpleanosSalida() {
  const ctx = obtenerContexto()
  tocar(ctx, 523.25, 0, 0.15, 'square', 0.1)
  tocar(ctx, 659.25, 0.15, 0.15, 'square', 0.1)
  tocar(ctx, 783.99, 0.30, 0.15, 'square', 0.1)
  tocar(ctx, 1046.50, 0.45, 0.60, 'sawtooth', 0.15)
}
