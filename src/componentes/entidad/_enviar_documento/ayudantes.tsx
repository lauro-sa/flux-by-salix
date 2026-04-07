/**
 * Funciones auxiliares para el modal de envío de documentos.
 * Se usan en: ModalEnviarDocumento, sub-componentes de adjuntos y programación.
 */

import { Image, Film, FileText, File } from 'lucide-react'

/** Devuelve el ícono apropiado según el tipo MIME del archivo */
export function iconoArchivo(tipo: string) {
  if (tipo.startsWith('image/')) return <Image size={12} />
  if (tipo.startsWith('video/')) return <Film size={12} />
  if (tipo.includes('pdf')) return <FileText size={12} />
  return <File size={12} />
}

/** Formatea bytes a una cadena legible (B, KB, MB) */
export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Nombre corto del día siguiente: "lun", "mar", etc. */
export function diaSiguienteCorto(locale = 'es-AR'): string {
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  return manana.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')
}
