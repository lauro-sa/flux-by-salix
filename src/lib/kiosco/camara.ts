/**
 * Captura silenciosa de foto desde la cámara de la tablet.
 *
 * NO mantiene la cámara encendida. Flujo:
 * 1. Pasan el llavero → abre cámara
 * 2. Espera 300ms para que se estabilice
 * 3. Captura un frame JPEG 320x240
 * 4. Cierra la cámara inmediatamente
 * 5. Si el empleado existe → guarda la foto
 * 6. Si no existe → descarta la foto
 */

/** Capturar foto instantánea: abrir cámara → foto → cerrar cámara (~500ms total) */
export async function capturarFotoInstantanea(): Promise<Blob | null> {
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.muted = true

    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve()
      video.play().catch(() => resolve())
    })

    // Esperar 300ms para que la cámara se estabilice
    await new Promise(r => setTimeout(r, 300))

    const vw = video.videoWidth || 320
    const vh = video.videoHeight || 240
    const ratio = Math.min(320 / vw, 240 / vh)

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vw * ratio)
    canvas.height = Math.round(vh * ratio)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Cerrar cámara inmediatamente
    stream.getTracks().forEach(t => t.stop())
    video.srcObject = null

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.65)
    })
  } catch {
    // Cerrar si hubo error
    stream?.getTracks().forEach(t => t.stop())
    return null
  }
}
