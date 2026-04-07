'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import {
  Reply, ReplyAll, Forward, Trash2, Archive, ShieldBan, ShieldCheck,
  Paperclip, ChevronDown, ChevronUp, Download, MailOpen, Mail as MailIcon,
  FileText, Image, Film, Tag, MoreHorizontal,
} from 'lucide-react'
import { CompositorCorreo, type DatosCorreo } from './CompositorCorreo'
import { PanelIA } from './PanelIA'
import { ModalEtiquetas } from './ModalEtiquetas'
import { useTraduccion } from '@/lib/i18n'
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
  onDesmarcarSpam?: (conversacionId: string) => void
  onArchivar?: (conversacionId: string) => void
  onEliminar?: (conversacionId: string) => void
  onToggleLeido?: (conversacionId: string, sinLeer: number) => void
  cargando: boolean
  enviando: boolean
  /** Email del canal activo (para filtrar CC en responder a todos) */
  emailCanal?: string
  /** Firma HTML del canal activo */
  firma?: string
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

/**
 * Renderiza HTML de correo dentro de un iframe sandboxed.
 * Preserva estilos originales del correo (tablas, CSS inline, imágenes).
 * El correo se muestra con su diseño original (generalmente fondo blanco)
 * dentro de un contenedor con border-radius para integrar con el dark mode.
 */
function VisorCorreoHTML({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [altura, setAltura] = useState(300)

  // Sanitizar: permitir style tags pero bloquear scripts
  const htmlSeguro = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link', 'meta', 'head', 'body', 'html'],
    ADD_ATTR: ['target', 'style', 'class', 'bgcolor', 'background', 'color', 'face', 'size',
               'cellpadding', 'cellspacing', 'border', 'width', 'height', 'align', 'valign'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus'],
  })

  // Construir documento completo — NO forzar colores, dejar el diseño original del correo
  // Sin scripts (sandbox no permite allow-scripts por seguridad)
  const documentoCompleto = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
body {
  margin: 0;
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  overflow-x: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  background-color: #ffffff;
  color: #1a1a1a;
  color-scheme: light;
}
img {
  max-width: 100% !important;
  height: auto !important;
}
/* Ocultar imágenes rotas o sin src (evitar espacios blancos) */
img[src=""] { display: none !important; }
img:not([src]) { display: none !important; }
table { max-width: 100% !important; }
pre { white-space: pre-wrap; }
</style>
</head>
<body>${htmlSeguro}</body>
</html>`

  const ajustarAltura = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        // Usar scrollHeight del body + un poco de margen
        const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight || 0, 100)
        setAltura(h + 16)
      }
    } catch {
      // Cross-origin
    }
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      ajustarAltura()
      // Re-check por imágenes que cargan después
      setTimeout(ajustarAltura, 300)
      setTimeout(ajustarAltura, 1000)
      setTimeout(ajustarAltura, 3000)
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [ajustarAltura])

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--borde-sutil)' }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={documentoCompleto}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="w-full border-0 block"
        style={{
          height: altura,
          minHeight: 100,
          maxHeight: 2000,
          background: 'var(--superficie-tarjeta, #ffffff)',
        }}
        title="Contenido del correo"
      />
    </div>
  )
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
  onDesmarcarSpam,
  onArchivar,
  onEliminar,
  onToggleLeido,
  cargando,
  enviando,
  emailCanal = '',
  firma,
}: PropiedadesPanelCorreo) {
  const { t } = useTraduccion()
  const [respondiendo, setRespondiendo] = useState(false)
  const [tipoRespuesta, setTipoRespuesta] = useState<'responder' | 'responder_todos' | 'reenviar'>('responder')
  const [modalEtiquetas, setModalEtiquetas] = useState(false)
  const [menuOverflow, setMenuOverflow] = useState(false)

  // Cerrar menú overflow al hacer click fuera
  useEffect(() => {
    if (!menuOverflow) return
    const cerrar = () => setMenuOverflow(false)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuOverflow])

  const [textoIA, setTextoIA] = useState('')
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
            {t('inbox.seleccionar_correo')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--superficie-app)' }}>
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
              {conversacion.asunto || `(${t('inbox.sin_asunto')})`}
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
            {/* Acciones principales — siempre visibles */}
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Responder" icono={<Reply size={14} />} onClick={() => handleResponder('responder')} />
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Responder a todos" icono={<ReplyAll size={14} />} onClick={() => handleResponder('responder_todos')} />
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Reenviar" icono={<Forward size={14} />} onClick={() => handleResponder('reenviar')} />
            {/* Acciones secundarias — visibles en desktop, ocultas en móvil */}
            <div className="hidden sm:flex items-center gap-1">
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Etiquetar" icono={<Tag size={14} />} onClick={() => setModalEtiquetas(true)} />
              {onToggleLeido && (
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo="Alternar leído"
                  icono={conversacion.mensajes_sin_leer > 0 ? <MailOpen size={14} /> : <MailIcon size={14} />}
                  onClick={() => onToggleLeido(conversacion.id, conversacion.mensajes_sin_leer)}
                />
              )}
              {conversacion.estado === 'spam' && onDesmarcarSpam ? (
                <Boton variante="fantasma" tamano="xs" icono={<ShieldCheck size={14} />} onClick={() => onDesmarcarSpam(conversacion.id)}>
                  {t('inbox.no_es_spam')}
                </Boton>
              ) : onMarcarSpam && (
                <Boton variante="fantasma" tamano="xs" soloIcono titulo="Marcar como spam" icono={<ShieldBan size={14} />} onClick={() => onMarcarSpam(conversacion.id)} />
              )}
              {onArchivar && (
                <Boton variante="fantasma" tamano="xs" soloIcono titulo="Archivar" icono={<Archive size={14} />} onClick={() => onArchivar(conversacion.id)} />
              )}
              {onEliminar && (
                <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={14} />} onClick={() => onEliminar(conversacion.id)} />
              )}
            </div>
            {/* Menú overflow en móvil */}
            <div className="relative sm:hidden">
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Más opciones" icono={<MoreHorizontal size={14} />} onClick={() => setMenuOverflow(prev => !prev)} />
              <AnimatePresence>
                {menuOverflow && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px] bg-superficie-elevada border border-borde-sutil shadow-md"
                  >
                    <OpcionMenu icono={<Tag size={12} />} onClick={() => { setModalEtiquetas(true); setMenuOverflow(false) }}>{t('inbox.etiquetar')}</OpcionMenu>
                    {onToggleLeido && (
                      <OpcionMenu icono={conversacion.mensajes_sin_leer > 0 ? <MailOpen size={12} /> : <MailIcon size={12} />} onClick={() => { onToggleLeido(conversacion.id, conversacion.mensajes_sin_leer); setMenuOverflow(false) }}>
                        {conversacion.mensajes_sin_leer > 0 ? t('inbox.marcar_leido') : t('inbox.marcar_no_leido')}
                      </OpcionMenu>
                    )}
                    {conversacion.estado === 'spam' && onDesmarcarSpam ? (
                      <OpcionMenu icono={<ShieldCheck size={12} />} onClick={() => { onDesmarcarSpam(conversacion.id); setMenuOverflow(false) }}>{t('inbox.no_es_spam')}</OpcionMenu>
                    ) : onMarcarSpam && (
                      <OpcionMenu icono={<ShieldBan size={12} />} onClick={() => { onMarcarSpam(conversacion.id); setMenuOverflow(false) }}>Spam</OpcionMenu>
                    )}
                    {onArchivar && (
                      <OpcionMenu icono={<Archive size={12} />} onClick={() => { onArchivar(conversacion.id); setMenuOverflow(false) }}>{t('inbox.archivar')}</OpcionMenu>
                    )}
                    {onEliminar && (
                      <OpcionMenu icono={<Trash2 size={12} />} peligro onClick={() => { onEliminar(conversacion.id); setMenuOverflow(false) }}>{t('comun.eliminar')}</OpcionMenu>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Hilo de correos */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
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
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    anchoCompleto
                    onClick={() => toggleExpandido(msg.id)}
                    className="py-3"
                  >
                    <span className="w-full flex items-center gap-3">
                      <Avatar
                        nombre={msg.remitente_nombre || msg.correo_de || '?'}
                        tamano="sm"
                      />
                      <span className="flex-1 min-w-0 text-left">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                            {msg.remitente_nombre || msg.correo_de}
                          </span>
                          {!msg.es_entrante && (
                            <Insignia color="neutro" tamano="sm">{t('inbox.enviados')}</Insignia>
                          )}
                          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                            {formatoFechaCorreo(msg.creado_en)}
                          </span>
                        </span>
                        {!expandido && (
                          <span className="text-xs truncate block" style={{ color: 'var(--texto-terciario)' }}>
                            {msg.texto}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
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
                      </span>
                    </span>
                  </Boton>

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
                          <span>{t('inbox.de')}: {msg.correo_de || 'Desconocido'}</span>
                          <span>{t('inbox.para')}: {msg.correo_para?.join(', ') || 'Desconocido'}</span>
                          {msg.correo_cc && msg.correo_cc.length > 0 && (
                            <span>{t('inbox.cc')}: {msg.correo_cc.join(', ')}</span>
                          )}
                        </div>

                        {/* Cuerpo (HTML en iframe aislado, o mensaje vacío) */}
                        <div className="pb-4">
                          {(() => {
                            // Detectar si el cuerpo está vacío (solo tags HTML sin texto real)
                            const htmlLimpio = msg.html?.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim()
                            const textoLimpio = msg.texto?.replace(/\s+/g, '').trim()
                            const cuerpoVacio = !htmlLimpio && !textoLimpio

                            if (cuerpoVacio) {
                              return msg.adjuntos.length > 0 ? (
                                <p className="text-sm py-3 italic" style={{ color: 'var(--texto-terciario)' }}>
                                  <Paperclip size={14} className="inline mr-1.5 -mt-0.5" />
                                  Este correo no tiene texto, solo adjunto{msg.adjuntos.length > 1 ? 's' : ''}
                                </p>
                              ) : (
                                <p className="text-sm py-3 italic" style={{ color: 'var(--texto-terciario)' }}>
                                  (Sin contenido)
                                </p>
                              )
                            }

                            return msg.html ? (
                              <VisorCorreoHTML html={msg.html} />
                            ) : (
                              <p
                                className="text-sm whitespace-pre-wrap"
                                style={{ color: 'var(--texto-primario)' }}
                              >
                                {msg.texto}
                              </p>
                            )
                          })()}
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
                            {t('inbox.responder')}
                          </Boton>
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            icono={<ReplyAll size={12} />}
                            onClick={() => handleResponder('responder_todos')}
                          >
                            {t('inbox.responder_todos')}
                          </Boton>
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            icono={<Forward size={12} />}
                            onClick={() => handleResponder('reenviar')}
                          >
                            {t('inbox.reenviar')}
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

      {/* Panel IA */}
      {conversacion && !respondiendo && (
        <PanelIA
          conversacionId={conversacion.id}
          onInsertarTexto={(texto) => {
            setTextoIA(texto)
            handleResponder('responder')
          }}
          resumenExistente={conversacion.resumen_ia}
          sentimientoExistente={conversacion.sentimiento}
        />
      )}

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
              firma={firma}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón para abrir compositor si está cerrado */}
      {!respondiendo && conversacion && (
        <div className="p-3" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
          <Boton
            variante="secundario"
            tamano="sm"
            anchoCompleto
            icono={<Reply size={14} />}
            onClick={() => handleResponder('responder')}
            style={{
              background: 'var(--superficie-hover)',
              color: 'var(--texto-terciario)',
            }}
          >
            {t('inbox.responder')}...
          </Boton>
        </div>
      )}

      {/* Modal de etiquetas */}
      {conversacion && (
        <ModalEtiquetas
          abierto={modalEtiquetas}
          onCerrar={() => setModalEtiquetas(false)}
          conversacionId={conversacion.id}
          etiquetasAsignadas={conversacion.etiquetas || []}
        />
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
