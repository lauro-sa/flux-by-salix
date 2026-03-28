/**
 * Convierte audio grabado (WebM/OGG/MP4) a MP3 en el navegador.
 * Meta WhatsApp API acepta MP3 (audio/mpeg) en todos los casos.
 * Usa @breezystack/lamejs (fork compatible con ESM/bundlers modernos).
 *
 * Flujo: Blob de audio → Web Audio API (decode) → lamejs (encode MP3) → Blob MP3
 */

import { Mp3Encoder } from '@breezystack/lamejs'

export async function convertirAudioAMp3(blob: Blob): Promise<Blob> {
  // Validar que el blob tiene contenido
  if (blob.size < 100) {
    throw new Error('Audio demasiado corto o vacío')
  }

  // Decodificar el audio con Web Audio API
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 44100 })

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
  } catch {
    // Segundo intento: crear un nuevo AudioContext limpio
    await audioCtx.close()
    const audioCtx2 = new AudioContext()
    try {
      audioBuffer = await audioCtx2.decodeAudioData(arrayBuffer.slice(0))
      await audioCtx2.close()
    } catch (err2) {
      await audioCtx2.close()
      throw new Error(`Unable to decode audio data: ${err2}`)
    }
  }

  if (audioCtx.state !== 'closed') await audioCtx.close()

  const sampleRate = audioBuffer.sampleRate
  const izq = audioBuffer.getChannelData(0)

  // Mezclar a mono si es estéreo
  let pcm: Float32Array
  if (audioBuffer.numberOfChannels > 1) {
    const der = audioBuffer.getChannelData(1)
    pcm = new Float32Array(izq.length)
    for (let i = 0; i < izq.length; i++) {
      pcm[i] = (izq[i] + der[i]) / 2
    }
  } else {
    pcm = izq
  }

  // Float32 → Int16
  const samples = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]))
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Encodear a MP3
  const encoder = new Mp3Encoder(1, sampleRate, 128)
  const partes: Uint8Array[] = []

  for (let i = 0; i < samples.length; i += 1152) {
    const bloque = samples.subarray(i, i + 1152)
    const mp3buf = encoder.encodeBuffer(bloque)
    if (mp3buf.length > 0) partes.push(mp3buf)
  }

  const final = encoder.flush()
  if (final.length > 0) partes.push(final)

  const resultado = new Blob(partes as BlobPart[], { type: 'audio/mpeg' })

  if (resultado.size < 100) {
    throw new Error('MP3 resultante demasiado pequeño')
  }

  return resultado
}
