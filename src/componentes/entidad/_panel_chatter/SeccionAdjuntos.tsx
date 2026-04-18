'use client'

/**
 * SeccionAdjuntos — Tarjetas compactas de adjuntos del chatter.
 * Miniaturas alineadas arriba, botón para adjuntar archivos.
 * Se usa en: PanelChatter (controlado desde el header con forzarExpandido).
 */

import { useState, useRef, useEffect } from 'react'
import {
  Paperclip, ChevronDown, ChevronUp, FileText, Image as ImageIcon,
  Film, Music, File, Plus, Loader2, MoreVertical, Trash2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AdjuntoChatter } from '@/tipos/chatter'
import Image from 'next/image'

// ─── Adjunto extendido con origen ───
export interface AdjuntoConOrigen extends AdjuntoChatter {
  origen?: string
  miniatura_url?: string
  fecha?: string
  chatter_id?: string
  indice_adjunto?: number
}

interface PropsSeccionAdjuntos {
  adjuntos: AdjuntoConOrigen[]
  adjuntosDocumento?: AdjuntoConOrigen[]
  forzarExpandido?: boolean
  entidadTipo?: string
  entidadId?: string
  onAdjuntoSubido?: () => void
  onEliminarAdjunto?: (chatterId: string, indice: number) => void
}

// Detectar tipo de archivo
function tipoArchivo(mime: string, nombre: string): 'imagen' | 'pdf' | 'video' | 'audio' | 'otro' {
  if (mime?.startsWith('image/')) return 'imagen'
  if (mime === 'application/pdf' || nombre?.endsWith('.pdf')) return 'pdf'
  if (mime?.startsWith('video/')) return 'video'
  if (mime?.startsWith('audio/')) return 'audio'
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

export function SeccionAdjuntos({
  adjuntos,
  adjuntosDocumento = [],
  forzarExpandido,
  entidadTipo,
  entidadId,
  onAdjuntoSubido,
  onEliminarAdjunto,
}: PropsSeccionAdjuntos) {
  const [expandido, setExpandido] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const todos = [...adjuntosDocumento, ...adjuntos]
  const total = todos.length
  const puedeAdjuntar = !!entidadTipo && !!entidadId

  if (total === 0 && !puedeAdjuntar) return null

  const mostrar = forzarExpandido || expandido

  // Subir archivo al chatter
  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo || !entidadTipo || !entidadId) return

    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('entidad_tipo', entidadTipo)
      formData.append('entidad_id', entidadId)

      const res = await fetch('/api/chatter/adjuntar', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) onAdjuntoSubido?.()
    } catch { /* silenciar */ }
    setSubiendo(false)
    if (inputRef.current) inputRef.current.value = ''
  }

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

      {/* Lista de archivos */}
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
                <TarjetaAdjunto
                  key={`${adj.url}-${i}`}
                  adjunto={adj}
                  onEliminar={onEliminarAdjunto && adj.chatter_id != null && adj.indice_adjunto != null
                    ? () => onEliminarAdjunto(adj.chatter_id!, adj.indice_adjunto!)
                    : undefined}
                />
              ))}
            </div>

            {/* Botón adjuntar archivos */}
            {puedeAdjuntar && (
              <div className="px-3 pb-2">
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={handleSubirArchivo}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                  className="flex items-center gap-1.5 text-xs text-texto-marca hover:text-texto-marca/80 transition-colors disabled:opacity-50"
                >
                  {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Adjuntar archivos
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tarjeta compacta de adjunto (miniatura + nombre + menú) ───
function TarjetaAdjunto({ adjunto, onEliminar }: { adjunto: AdjuntoConOrigen; onEliminar?: () => void }) {
  const tipo = tipoArchivo(adjunto.tipo || '', adjunto.nombre)
  const tieneMiniatura = tipo === 'imagen' || !!adjunto.miniatura_url
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const refMenu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAbierto) return
    const cerrar = (e: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) {
        setMenuAbierto(false)
        setConfirmando(false)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuAbierto])

  return (
    <div className="relative group w-[130px] rounded-boton border border-borde-sutil overflow-visible hover:border-texto-marca/30 transition-colors">
      <a
        href={adjunto.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={adjunto.nombre}
      >
        {/* Preview */}
        <div className="relative h-[70px] bg-superficie-app flex items-start justify-center overflow-hidden rounded-t-md">
          {tieneMiniatura ? (
            <Image
              src={adjunto.miniatura_url || adjunto.url}
              alt={adjunto.nombre}
              fill
              sizes="(max-width: 768px) 33vw, 150px"
              className="object-cover object-top"
            />
          ) : (
            <div className={`flex flex-col items-center gap-0.5 pt-4 ${COLORES_TIPO[tipo].split(' ')[1] || 'text-texto-terciario'}`}>
              <IconoArchivo tipo={tipo} size={22} />
              {extension(adjunto.nombre) && (
                <span className="text-xxs font-bold uppercase opacity-60">{extension(adjunto.nombre)}</span>
              )}
            </div>
          )}
        </div>

        {/* Nombre + origen + fecha */}
        <div className="px-1.5 py-1 bg-superficie-hover/40">
          <div className="flex items-center gap-1">
            <div className={`shrink-0 ${COLORES_TIPO[tipo].split(' ')[1] || 'text-texto-terciario'}`}>
              <IconoArchivo tipo={tipo} size={10} />
            </div>
            <span className="text-xxs text-texto-primario truncate">{adjunto.nombre}</span>
          </div>
          {(adjunto.origen || adjunto.fecha) && (
            <p className="text-xxs text-texto-terciario mt-0.5 pl-3.5 truncate">
              {adjunto.origen && <span className="font-medium">{adjunto.origen}</span>}
              {adjunto.origen && adjunto.fecha && ' · '}
              {adjunto.fecha && new Date(adjunto.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </a>

      {/* Menú tres puntos — solo si se puede eliminar */}
      {onEliminar && (
        <div ref={refMenu} className="absolute top-1 right-1 z-10">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuAbierto(v => !v); setConfirmando(false) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-black/50 text-white hover:bg-black/70 transition-all"
          >
            <MoreVertical size={12} />
          </button>

          {menuAbierto && (
            <div className="absolute top-full mt-1 right-0 min-w-32 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg overflow-hidden py-1">
              {confirmando ? (
                <div className="px-3 py-2">
                  <p className="text-xs text-texto-secundario mb-2">¿Eliminar este archivo?</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { onEliminar(); setMenuAbierto(false); setConfirmando(false) }}
                      className="flex-1 text-xs px-2 py-1 rounded bg-insignia-peligro/15 text-insignia-peligro hover:bg-insignia-peligro/25 transition-colors"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuAbierto(false); setConfirmando(false) }}
                      className="flex-1 text-xs px-2 py-1 rounded bg-superficie-hover text-texto-secundario hover:bg-superficie-hover/80 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-insignia-peligro hover:bg-insignia-peligro/10 transition-colors"
                >
                  <Trash2 size={13} />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
