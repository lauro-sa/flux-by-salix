/**
 * Captura silenciosa de foto desde la cámara de la tablet.
 * TRUCO: capturar ANTES de autenticar porque después la persona ya se corrió.
 * Compresión: JPEG 320x240 @ 65% (~10-15KB)
 */

let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null

/** Inicializar cámara (llamar al montar el kiosco) */
export async function iniciarCamara(): Promise<boolean> {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 320, height: 240 },
      audio: false,
    })
    video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.setAttribute('autoplay', 'true')
    video.muted = true
    await video.play()
    return true
  } catch {
    console.warn('Kiosco: no se pudo acceder a la cámara')
    return false
  }
}

/** Capturar frame actual como blob JPEG comprimido */
export async function capturarFoto(): Promise<Blob | null> {
  if (!video || !stream) return null

  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 240

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, 320, 240)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      0.65, // 65% calidad
    )
  })
}

/** Detener cámara y liberar recursos */
export function detenerCamara() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
  if (video) {
    video.srcObject = null
    video = null
  }
}
