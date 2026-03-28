'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  Reply, ReplyAll, Forward, Trash2, Archive, ShieldBan,
  Paperclip, ChevronDown, ChevronUp, Download,
  FileText, Image, Film,
} from 'lucide-react'
import { CompositorCorreo, type DatosCorreo } from './CompositorCorreo'
import DOMPurify from 'isomorphic-dompurify'
import type { MensajeConAdjuntos, Conversacion } from '@/tipos/inbox'

/**
 * Panel central de Correo — UI estilo cliente de correo con hilos.
 * Muestra: asunto, remitente, cuerpo HTML sanitizado, adjuntos con miniaturas,
 * acciones de respuesta con contexto pre-llenado, marcar como spam.
 */

interface PropiedadesPanelCorreo {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  onEnviarCorreo: (datos: DatosCorreo) => void
  onMarcarSpam?: (conversacionId: string) => void
  onArchivar?: (conversacionId: string) => void
  onEliminar?: (conversacionId: string) => void
  cargando: boolean
  enviando: boolean
  /** Email del canal activo (para filtrar CC en responder a todos) */
  emailCanal?: string
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

/** Sanitiza HTML de correos para prevenir XSS */
function sanitizarHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
      'hr', 'sup', 'sub', 'font', 'center',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style',
      'class', 'align', 'valign', 'bgcolor', 'color', 'size', 'face',
      'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing',
    ],
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  })
}

/** Extrae solo el email de "Nombre <email@dom.com>" */
function extraerEmail(dir: string): string {
  const match = dir.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : dir.trim().toLowerCase()
}

export function PanelCorreo({
  conversacion,
  mensajes,
  onEnviarCorreo,
  onMarcarSpam,
  onArchivar,
  onEliminar,
  cargando,
  enviando,
  emailCanal = '',
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
    setRespondiendo(false)
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
    // Scroll al compositor
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleEnviar = (datos: DatosCorreo) => {
    onEnviarCorreo(datos)
    setRespondiendo(false)
  }

  // Calcular contexto de respuesta basado en el último mensaje
  const contextoRespuesta = useMemo(() => {
    if (mensajes.length === 0 || !conversacion) return null
    const ultimo = mensajes[mensajes.length - 1]
    const emailNuestro = emailCanal.toLowerCase()

    // Para responder: el remitente del último mensaje entrante
    const paraResponder = ultimo.es_entrante
      ? [ultimo.correo_de || ''].filter(Boolean)
      : ultimo.correo_para || []

    // Para responder a todos: remitente + CC, menos nuestro email
    const todosDestinatarios = [
      ...(ultimo.correo_de ? [ultimo.correo_de] : []),
      ...(ultimo.correo_para || []),
    ]
    const todosCC = [...(ultimo.correo_cc || [])]
    const paraResponderTodos = todosDestinatarios
      .filter(d => extraerEmail(d) !== emailNuestro)
    const ccResponderTodos = todosCC
      .filter(d => extraerEmail(d) !== emailNuestro)

    // Threading headers
    const inReplyTo = ultimo.correo_message_id || undefined
    const references = [
      ...(ultimo.correo_references || []),
      ...(ultimo.correo_message_id ? [ultimo.correo_message_id] : []),
    ].filter(Boolean)

    // IDs de adjuntos para reenvío
    const adjuntosIds = ultimo.adjuntos.map(a => a.id)

    return {
      paraResponder,
      paraResponderTodos,
      ccResponderTodos,
      inReplyTo,
      references,
      adjuntosIds,
      htmlOriginal: ultimo.html || ultimo.texto || '',
      asuntoOriginal: conversacion.asunto || '',
    }
  }, [mensajes, conversacion, emailCanal])

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
            {onMarcarSpam && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<ShieldBan size={14} />} onClick={() => onMarcarSpam(conversacion.id)} />
            )}
            {onArchivar && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<Archive size={14} />} onClick={() => onArchivar(conversacion.id)} />
            )}
            {onEliminar && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={14} />} onClick={() => onEliminar(conversacion.id)} />
            )}
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
                        {!msg.es_entrante && (
                          <Insignia color="neutro" tamano="sm">Enviado</Insignia>
                        )}
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
                        <span className="flex items-center gap-0.5 text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          <Paperclip size={12} />
                          {msg.adjuntos.length}
                        </span>
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
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs" style={{ color: 'var(--texto-terciario)' }}>
                          <span>De: {msg.correo_de || 'Desconocido'}</span>
                          <span>Para: {msg.correo_para?.join(', ') || 'Desconocido'}</span>
                          {msg.correo_cc && msg.correo_cc.length > 0 && (
                            <span>CC: {msg.correo_cc.join(', ')}</span>
                          )}
                        </div>

                        {/* Cuerpo (HTML sanitizado) */}
                        <div className="pb-4">
                          {msg.html ? (
                            <div
                              className="text-sm prose prose-sm max-w-none correo-contenido"
                              style={{ color: 'var(--texto-primario)' }}
                              dangerouslySetInnerHTML={{ __html: sanitizarHtml(msg.html) }}
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

                        {/* Adjuntos con miniaturas */}
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
                                  className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors"
                                  style={{
                                    background: 'var(--superficie-hover)',
                                    color: 'var(--texto-secundario)',
                                  }}
                                >
                                  {/* Miniatura para imágenes */}
                                  {adj.miniatura_url && adj.tipo_mime.startsWith('image/') ? (
                                    <img
                                      src={adj.miniatura_url}
                                      alt={adj.nombre_archivo}
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  ) : (
                                    <IconoAdjunto tipo={adj.tipo_mime} />
                                  )}
                                  <div className="min-w-0">
                                    <span className="max-w-[150px] truncate block">{adj.nombre_archivo}</span>
                                    {adj.tamano_bytes && (
                                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                                        {formatoTamano(adj.tamano_bytes)}
                                      </span>
                                    )}
                                  </div>
                                  <Download size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--texto-terciario)' }} />
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
                            icono={<ReplyAll size={12} />}
                            onClick={() => handleResponder('responder_todos')}
                          >
                            Responder a todos
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

      {/* Compositor de respuesta (CompositorCorreo) */}
      <AnimatePresence>
        {respondiendo && contextoRespuesta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CompositorCorreo
              tipo={tipoRespuesta}
              paraInicial={
                tipoRespuesta === 'reenviar'
                  ? []
                  : tipoRespuesta === 'responder_todos'
                    ? contextoRespuesta.paraResponderTodos
                    : contextoRespuesta.paraResponder
              }
              ccInicial={
                tipoRespuesta === 'responder_todos'
                  ? contextoRespuesta.ccResponderTodos
                  : []
              }
              asuntoInicial={
                tipoRespuesta === 'reenviar'
                  ? `Fwd: ${contextoRespuesta.asuntoOriginal}`
                  : `Re: ${contextoRespuesta.asuntoOriginal}`
              }
              htmlInicial={
                tipoRespuesta === 'reenviar'
                  ? `<br/><br/><blockquote style="border-left: 2px solid #ccc; padding-left: 8px; margin: 8px 0; color: #666;">${contextoRespuesta.htmlOriginal}</blockquote>`
                  : ''
              }
              inReplyTo={tipoRespuesta !== 'reenviar' ? contextoRespuesta.inReplyTo : undefined}
              references={tipoRespuesta !== 'reenviar' ? contextoRespuesta.references : undefined}
              adjuntosIdsInicial={tipoRespuesta === 'reenviar' ? contextoRespuesta.adjuntosIds : []}
              onEnviar={handleEnviar}
              onCancelar={() => setRespondiendo(false)}
              cargando={enviando}
              compacto
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
  if (tipo.startsWith('image/')) return <Image size={14} />
  if (tipo.startsWith('video/')) return <Film size={14} />
  if (tipo.includes('pdf')) return <FileText size={14} />
  return <FileText size={14} />
}

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
