import sharp from 'sharp'

/**
 * Tipos MIME de imagen que se pueden comprimir con sharp.
 * Se usa para validar server-side antes de intentar procesar.
 */
export const TIPOS_IMAGEN_VALIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
])

/**
 * Tipos MIME de archivo permitidos para adjuntos.
 * Cualquier tipo fuera de esta lista se rechaza.
 */
export const TIPOS_ARCHIVO_PERMITIDOS = new Set([
  // Imágenes
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Comprimidos
  'application/zip',
  'application/x-rar-compressed',
  'application/gzip',
  // Media
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

/** Límite máximo de tamaño por archivo: 10 MB */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

/**
 * Comprime una imagen si es un tipo soportado por sharp.
 * - Redimensiona al ancho máximo indicado (mantiene aspect ratio)
 * - Convierte a WebP (~30% más liviano que JPEG a misma calidad)
 * - Si no es imagen o es menor al umbral, devuelve el buffer original
 *
 * @returns { buffer, tipo } — buffer procesado y tipo MIME resultante
 */
export async function comprimirImagen(
  buffer: Buffer,
  tipoMime: string,
  opciones?: {
    anchoMaximo?: number
    calidad?: number
    /** No comprimir si el buffer es menor a este tamaño en bytes */
    umbralMinimo?: number
    /** Forzar JPEG en vez de WebP (ej: emails donde WebP no es universal) */
    forzarJpeg?: boolean
  }
): Promise<{ buffer: Buffer; tipo: string }> {
  const {
    anchoMaximo = 1600,
    calidad = 80,
    umbralMinimo = 200 * 1024, // 200 KB — no vale la pena comprimir archivos pequeños
    forzarJpeg = false,
  } = opciones || {}

  // Si no es una imagen comprimible, devolver tal cual
  if (!TIPOS_IMAGEN_VALIDOS.has(tipoMime)) {
    return { buffer, tipo: tipoMime }
  }

  // Si es menor al umbral, no comprimir
  if (buffer.length < umbralMinimo) {
    return { buffer, tipo: tipoMime }
  }

  try {
    const pipeline = sharp(buffer)
      .rotate() // respetar orientación EXIF
      .resize(anchoMaximo, undefined, {
        withoutEnlargement: true, // no agrandar imágenes pequeñas
        fit: 'inside',
      })

    const procesado = forzarJpeg
      ? await pipeline.jpeg({ quality: calidad, mozjpeg: true }).toBuffer()
      : await pipeline.webp({ quality: calidad, effort: 4 }).toBuffer()

    return {
      buffer: procesado,
      tipo: forzarJpeg ? 'image/jpeg' : 'image/webp',
    }
  } catch {
    // Si sharp falla (formato raro, corrupto), devolver original
    return { buffer, tipo: tipoMime }
  }
}

/**
 * Valida que un archivo cumpla con los requisitos de tipo y tamaño.
 * Devuelve null si es válido, o un string con el error.
 */
export function validarArchivo(
  tipoMime: string,
  tamanoBytes: number,
  tamanoMaximo = TAMANO_MAXIMO_BYTES
): string | null {
  if (!TIPOS_ARCHIVO_PERMITIDOS.has(tipoMime)) {
    return `Tipo de archivo no permitido: ${tipoMime}`
  }
  if (tamanoBytes > tamanoMaximo) {
    const maxMB = Math.round(tamanoMaximo / (1024 * 1024))
    return `El archivo excede el límite de ${maxMB} MB`
  }
  return null
}
