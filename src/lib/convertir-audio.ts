/**
 * Convierte audio grabado (WebM/OGG/MP4) a MP3 en el navegador.
 * Meta WhatsApp API acepta MP3 (audio/mpeg) en todos los casos.
 * Usa lamejs (encoder MP3 puro en JavaScript, sin dependencias nativas).
 *
 * Flujo: Blob de audio → Web Audio API (decode) → lamejs (encode MP3) → Blob MP3
 */

// lamejs necesita import estático — dynamic import rompe sus globals internos
import lamejs from 'lamejs'

export async function convertirAudioAMp3(blob: Blob): Promise<Blob> {
  // Decodificar el audio con Web Audio API
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close()

  // Obtener PCM data
  const numCanales = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const muestrasIzq = audioBuffer.getChannelData(0)

  // Mezclar a mono si es estéreo
  let pcm: Float32Array
  if (numCanales > 1) {
    const muestrasDer = audioBuffer.getChannelData(1)
    pcm = new Float32Array(muestrasIzq.length)
    for (let i = 0; i < muestrasIzq.length; i++) {
      pcm[i] = (muestrasIzq[i] + muestrasDer[i]) / 2
    }
  } else {
    pcm = muestrasIzq
  }

  // Convertir Float32 (-1 a 1) a Int16 (-32768 a 32767)
  const samples = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]))
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Encodear a MP3
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128)
  const bloqueSize = 1152
  const partes: Uint8Array[] = []

  for (let i = 0; i < samples.length; i += bloqueSize) {
    const bloque = samples.subarray(i, i + bloqueSize)
    const mp3buf = mp3encoder.encodeBuffer(bloque)
    if (mp3buf.length > 0) partes.push(mp3buf)
  }

  const mp3Final = mp3encoder.flush()
  if (mp3Final.length > 0) partes.push(mp3Final)

  return new Blob(partes as BlobPart[], { type: 'audio/mpeg' })
}
