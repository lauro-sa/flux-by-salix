'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  Reply, ReplyAll, Forward, Trash2, Archive, Star,
  Paperclip, ChevronDown, ChevronUp, Clock, Download,
  FileText, Image, Film,
} from 'lucide-react'
import { CompositorMensaje, type DatosMensaje } from './CompositorMensaje'
import type { MensajeConAdjuntos, Conversacion } from '@/tipos/inbox'

/**
 * Panel central de Correo — UI estilo cliente de correo con hilos.
 * Muestra: asunto, remitente, cuerpo HTML, adjuntos, acciones de respuesta.
 */

interface PropiedadesPanelCorreo {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  onEnviar: (datos: DatosMensaje) => void
  onAdjuntar?: (archivos: File[]) => void
  cargando: boolean
  enviando: boolean
}

function formatoFechaCorreo(fecha: string): string {
  const d = new Date(fecha)
  const hoy = new Date()
  const esHoy = d.toDateString() === hoy.toDateString()

  if (esHoy) {
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PanelCorreo({
  conversacion,
  mensajes,
  onEnviar,
  onAdjuntar,
  cargando,
  enviando,
}: PropiedadesPanelCorreo) {
  const [respondiendo, setRespondiendo] = useState(false)
  const [tipoRespuesta, setTipoRespuesta] = useState<'responder' | 'responder_todos' | 'reenviar'>('responder')
  const [mensajesExpandidos, setMensajesExpandidos] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Expandir el último mensaje por defecto
  useEffect(() => {
    if (mensajes.length > 0) {
      setMensajesExpandidos(new Set([mensajes[mensajes.length - 1].id]))
    }
  }, [mensajes])

  const toggleExpandido = (id: string) => {
    setMensajesExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleResponder = (tipo: 'responder' | 'responder_todos' | 'reenviar') => {
    setTipoRespuesta(tipo)
    setRespondiendo(true)
  }

  const handleEnviar = (datos: DatosMensaje) => {
    onEnviar(datos)
    setRespondiendo(false)
  }

  if (!conversacion) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--superficie-app)' }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--canal-correo)' }}>
              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
            Seleccioná un correo para leer
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--superficie-app)' }}>
      {/* Header: asunto + acciones */}
      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-tarjeta)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--texto-primario)' }}>
              {conversacion.asunto || '(Sin asunto)'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Insignia color="neutro" tamano="sm">
                {mensajes.length} {mensajes.length === 1 ? 'mensaje' : 'mensajes'}
              </Insignia>
              {conversacion.etiquetas?.map((tag) => (
                <Insignia key={tag} color="primario" tamano="sm">{tag}</Insignia>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Reply size={14} />} onClick={() => handleResponder('responder')} />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<ReplyAll size={14} />} onClick={() => handleResponder('responder_todos')} />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Forward size={14} />} onClick={() => handleResponder('reenviar')} />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Archive size={14} />} />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={14} />} />
          </div>
        </div>
      </div>

      {/* Hilo de correos */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--texto-terciario)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--borde-sutil)' }}>
            {mensajes.map((msg) => {
              const expandido = mensajesExpandidos.has(msg.id)

              return (
                <div key={msg.id} className="px-4">
                  {/* Cabecera del mensaje (siempre visible) */}
                  <button
                    onClick={() => toggleExpandido(msg.id)}
                    className="w-full flex items-center gap-3 py-3"
                  >
                    <Avatar
                      nombre={msg.remitente_nombre || msg.correo_de || '?'}
                      tamano="sm"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                          {msg.remitente_nombre || msg.correo_de}
                        </span>
                        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          {formatoFechaCorreo(msg.creado_en)}
                        </span>
                      </div>
                      {!expandido && (
                        <p className="text-xs truncate" style={{ color: 'var(--texto-terciario)' }}>
                          {msg.texto}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {msg.adjuntos.length > 0 && (
                        <Paperclip size={12} style={{ color: 'var(--texto-terciario)' }} />
                      )}
                      {expandido ? (
                        <ChevronUp size={14} style={{ color: 'var(--texto-terciario)' }} />
                      ) : (
                        <ChevronDown size={14} style={{ color: 'var(--texto-terciario)' }} />
                      )}
                    </div>
                  </button>

                  {/* Cuerpo del mensaje (expandido) */}
                  <AnimatePresence>
                    {expandido && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {/* Destinatarios */}
                        <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--texto-terciario)' }}>
                          <span>Para: {msg.correo_para?.join(', ') || 'Desconocido'}</span>
                          {msg.correo_cc && msg.correo_cc.length > 0 && (
                            <span>CC: {msg.correo_cc.join(', ')}</span>
                          )}
                        </div>

                        {/* Cuerpo */}
                        <div className="pb-4">
                          {msg.html ? (
                            <div
                              className="text-sm prose prose-sm max-w-none"
                              style={{ color: 'var(--texto-primario)' }}
                              dangerouslySetInnerHTML={{ __html: msg.html }}
                            />
                          ) : (
                            <p
                              className="text-sm whitespace-pre-wrap"
                              style={{ color: 'var(--texto-primario)' }}
                            >
                              {msg.texto}
                            </p>
                          )}
                        </div>

                        {/* Adjuntos */}
                        {msg.adjuntos.length > 0 && (
                          <div className="pb-4">
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--texto-secundario)' }}>
                              {msg.adjuntos.length} adjunto{msg.adjuntos.length > 1 ? 's' : ''}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.adjuntos.map((adj) => (
                                <a
                                  key={adj.id}
                                  href={adj.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs"
                                  style={{
                                    background: 'var(--superficie-hover)',
                                    color: 'var(--texto-secundario)',
                                  }}
                                >
                                  <IconoAdjunto tipo={adj.tipo_mime} />
                                  <span className="max-w-[150px] truncate">{adj.nombre_archivo}</span>
                                  <Download size={12} style={{ color: 'var(--texto-terciario)' }} />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Acciones del mensaje individual */}
                        <div className="flex items-center gap-1 pb-3">
                          <Boton
                            variante="secundario"
                            tamano="xs"
                            icono={<Reply size={12} />}
                            onClick={() => handleResponder('responder')}
                          >
                            Responder
                          </Boton>
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            icono={<Forward size={12} />}
                            onClick={() => handleResponder('reenviar')}
                          >
                            Reenviar
                          </Boton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Compositor de respuesta */}
      <AnimatePresence>
        {respondiendo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CompositorMensaje
              tipoCanal="correo"
              onEnviar={handleEnviar}
              onAdjuntar={onAdjuntar}
              cargando={enviando}
              mostrarCamposCorreo={tipoRespuesta === 'reenviar'}
              asuntoInicial={
                tipoRespuesta === 'reenviar'
                  ? `Fwd: ${conversacion.asunto || ''}`
                  : `Re: ${conversacion.asunto || ''}`
              }
              placeholder="Escribir respuesta..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón para abrir compositor si está cerrado */}
      {!respondiendo && conversacion && (
        <div className="p-3" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
          <button
            onClick={() => handleResponder('responder')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--superficie-hover)',
              color: 'var(--texto-terciario)',
            }}
          >
            <Reply size={14} />
            Responder...
          </button>
        </div>
      )}
    </div>
  )
}

function IconoAdjunto({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <Image size={12} />
  if (tipo.startsWith('video/')) return <Film size={12} />
  return <FileText size={12} />
}
