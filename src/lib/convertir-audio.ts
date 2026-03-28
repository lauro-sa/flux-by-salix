/**
 * Convierte audio grabado (WebM/OGG/MP4) a MP3 en el navegador.
 * Meta WhatsApp API acepta MP3 (audio/mpeg) en todos los casos.
 * Usa lamejs (encoder MP3 puro en JavaScript, sin dependencias nativas).
 *
 * Flujo: Blob de audio → Web Audio API (decode) → lamejs (encode MP3) → Blob MP3
 */

export async function convertirAudioAMp3(blob: Blob): Promise<Blob> {
  // Importar lamejs dinámicamente (solo cuando se necesita)
  const lamejs = await import('lamejs')

  // Decodificar el audio con Web Audio API
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close()

  // Obtener PCM data
  const numCanales = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const muestrasIzq = audioBuffer.getChannelData(0)

  // Convertir Float32 (-1 a 1) a Int16 (-32768 a 32767)
  const muestrasInt16 = new Int16Array(muestrasIzq.length)
  for (let i = 0; i < muestrasIzq.length; i++) {
    const s = Math.max(-1, Math.min(1, muestrasIzq[i]))
    muestrasInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Si es estéreo, mezclar a mono (WhatsApp no necesita estéreo para voz)
  let muestrasMono = muestrasInt16
  if (numCanales > 1) {
    const muestrasDer = audioBuffer.getChannelData(1)
    muestrasMono = new Int16Array(muestrasIzq.length)
    for (let i = 0; i < muestrasIzq.length; i++) {
      const izq = muestrasIzq[i]
      const der = muestrasDer[i]
      const mezcla = (izq + der) / 2
      const s = Math.max(-1, Math.min(1, mezcla))
      muestrasMono[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
  }

  // Encodear a MP3 con lamejs
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128) // mono, 128kbps
  const bloqueSize = 1152
  const mp3Chunks: Uint8Array[] = []

  for (let i = 0; i < muestrasMono.length; i += bloqueSize) {
    const bloque = muestrasMono.subarray(i, i + bloqueSize)
    const mp3buf = mp3encoder.encodeBuffer(bloque)
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf))
    }
  }

  // Flush final
  const mp3Final = mp3encoder.flush()
  if (mp3Final.length > 0) {
    mp3Chunks.push(new Uint8Array(mp3Final))
  }

  return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mpeg' })
}
