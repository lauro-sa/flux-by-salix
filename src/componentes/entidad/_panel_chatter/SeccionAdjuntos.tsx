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
            <div className="px-3 py-2 flex flex-wrap gap-2">
              {todos.map((adj, i) => (
                <TarjetaAdjunto key={`${adj.url}-${i}`} adjunto={adj} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tarjeta compacta de adjunto (miniatura + nombre) ───
function TarjetaAdjunto({ adjunto }: { adjunto: AdjuntoConOrigen }) {
  const tipo = tipoArchivo(adjunto.tipo || '', adjunto.nombre)
  const tieneMiniatura = tipo === 'imagen' || !!adjunto.miniatura_url

  return (
    <a
      href={adjunto.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-[130px] rounded-md border border-borde-sutil overflow-hidden hover:border-texto-marca/30 transition-colors"
      title={adjunto.nombre}
    >
      {/* Preview compacto */}
      <div className="relative h-[80px] bg-superficie-app flex items-center justify-center overflow-hidden">
        {tieneMiniatura ? (
          <img
            src={adjunto.miniatura_url || adjunto.url}
            alt={adjunto.nombre}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`flex flex-col items-center gap-0.5 ${COLORES_TIPO[tipo].split(' ')[1] || 'text-texto-terciario'}`}>
            <IconoArchivo tipo={tipo} size={22} />
            {extension(adjunto.nombre) && (
              <span className="text-xxs font-bold uppercase opacity-60">{extension(adjunto.nombre)}</span>
            )}
          </div>
        )}
      </div>

      {/* Nombre */}
      <div className="flex items-center gap-1 px-1.5 py-1 bg-superficie-hover/40">
        <div className={`shrink-0 ${COLORES_TIPO[tipo].split(' ')[1] || 'text-texto-terciario'}`}>
          <IconoArchivo tipo={tipo} size={10} />
        </div>
        <span className="text-xxs text-texto-primario truncate">{adjunto.nombre}</span>
      </div>
    </a>
  )
}
