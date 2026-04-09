'use client'

/**
 * SeccionAdjuntos — Lista compacta de archivos adjuntos del chatter.
 * Muestra ícono de tipo (PDF, IMG, etc.) + nombre + tamaño en una fila.
 * Sin previews grandes — solo íconos compactos y nombres truncados.
 * Se usa en: PanelChatter (controlado desde el header con forzarExpandido).
 */

import { useState } from 'react'
import {
  Paperclip, ChevronDown, ChevronUp, FileText, Image as ImageIcon,
  Film, Music, File, ExternalLink,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AdjuntoChatter } from '@/tipos/chatter'

// ─── Adjunto extendido con origen ───
export interface AdjuntoConOrigen extends AdjuntoChatter {
  origen?: string
  miniatura_url?: string
}

interface PropsSeccionAdjuntos {
  adjuntos: AdjuntoConOrigen[]
  adjuntosDocumento?: AdjuntoConOrigen[]
  forzarExpandido?: boolean
}

// Detectar tipo de archivo
function tipoArchivo(mime: string, nombre: string): 'imagen' | 'pdf' | 'video' | 'audio' | 'otro' {
  if (mime.startsWith('image/')) return 'imagen'
  if (mime === 'application/pdf' || nombre.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'otro'
}

// Extensión del archivo para mostrar como badge
function extension(nombre: string): string {
  const partes = nombre.split('.')
  if (partes.length < 2) return ''
  return partes.pop()!.toUpperCase()
}

// Ícono según tipo
function IconoArchivo({ tipo, size = 16 }: { tipo: ReturnType<typeof tipoArchivo>; size?: number }) {
  switch (tipo) {
    case 'imagen': return <ImageIcon size={size} />
    case 'pdf': return <FileText size={size} />
    case 'video': return <Film size={size} />
    case 'audio': return <Music size={size} />
    default: return <File size={size} />
  }
}

// Colores de fondo por tipo
const COLORES_TIPO: Record<ReturnType<typeof tipoArchivo>, string> = {
  imagen: 'bg-insignia-info/10 text-insignia-info',
  pdf: 'bg-insignia-peligro/10 text-insignia-peligro',
  video: 'bg-texto-marca/10 text-texto-marca',
  audio: 'bg-insignia-advertencia/10 text-insignia-advertencia',
  otro: 'bg-texto-terciario/10 text-texto-terciario',
}

// Formatear tamaño
function formatearTamano(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function SeccionAdjuntos({ adjuntos, adjuntosDocumento = [], forzarExpandido }: PropsSeccionAdjuntos) {
  const [expandido, setExpandido] = useState(false)

  const todos = [...adjuntosDocumento, ...adjuntos]
  const total = todos.length

  if (total === 0) return null

  const mostrar = forzarExpandido || expandido

  return (
    <div className="border-b border-borde-sutil">
      {/* Header colapsable (solo si no es controlado desde el padre) */}
      {!forzarExpandido && (
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-superficie-hover/50 transition-colors"
        >
          <Paperclip size={14} className="text-texto-terciario shrink-0" />
          <span className="text-xs font-medium text-texto-secundario">
            {total} archivo{total > 1 ? 's' : ''} adjunto{total > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          {expandido
            ? <ChevronUp size={14} className="text-texto-terciario" />
            : <ChevronDown size={14} className="text-texto-terciario" />
          }
        </button>
      )}

      {/* Lista compacta de archivos */}
      <AnimatePresence>
        {mostrar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 flex flex-wrap gap-1.5">
              {todos.map((adj, i) => (
                <ChipAdjunto key={`${adj.url}-${i}`} adjunto={adj} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Chip compacto de adjunto ───
function ChipAdjunto({ adjunto }: { adjunto: AdjuntoConOrigen }) {
  const tipo = tipoArchivo(adjunto.tipo || '', adjunto.nombre)

  return (
    <a
      href={adjunto.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-md border border-borde-sutil hover:border-texto-marca/30 hover:bg-superficie-hover/60 transition-colors max-w-[200px] ${COLORES_TIPO[tipo].split(' ')[0]}`}
      title={`${adjunto.nombre}${adjunto.origen ? ` · ${adjunto.origen}` : ''}`}
    >
      <div className={`flex items-center justify-center size-5 rounded shrink-0 ${COLORES_TIPO[tipo]}`}>
        <IconoArchivo tipo={tipo} size={11} />
      </div>
      <span className="text-xs text-texto-primario truncate">{adjunto.nombre}</span>
    </a>
  )
}
