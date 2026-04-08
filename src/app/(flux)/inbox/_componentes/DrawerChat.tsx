'use client'

/**
 * DrawerChat — Panel flotante de chat que se abre desde la vista Pipeline.
 * Muestra la conversación en un drawer lateral derecho sin salir del pipeline.
 * Incluye: header con nombre/etapa, mensajes, compositor básico.
 * Funciona en PC y tablet. En mobile se abre fullscreen.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormato } from '@/hooks/useFormato'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorEtapa } from './SelectorEtapa'
import type { ConversacionConDetalles, MensajeConAdjuntos, TipoCanal } from '@/tipos/inbox'

// ─── Props ───

interface PropiedadesDrawerChat {
  conversacion: ConversacionConDetalles | null
  tipoCanal: TipoCanal
  abierto: boolean
  onCerrar: () => void
  /** Callback cuando se cambia la etapa desde el drawer (para actualizar el pipeline) */
  onEtapaCambiada?: (conversacionId: string, etapaId: string | null) => void
}

// ─── Helpers ───

function formatoHora(iso: string, locale: string, hour12 = false): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 })
}

function formatoFecha(iso: string, locale: string): string {
  const fecha = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)

  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy'
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer'
  return fecha.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Componente ───

export function DrawerChat({ conversacion, tipoCanal, abierto, onCerrar, onEtapaCambiada }: PropiedadesDrawerChat) {
  const router = useRouter()
  const formato = useFormato()
  const [mensajes, setMensajes] = useState<MensajeConAdjuntos[]>([])
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [texto, setTexto] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ─── Cargar mensajes ───

  const cargarMensajes = useCallback(async () => {
    if (!conversacion) return
    setCargando(true)
    try {
      const res = await fetch(`/api/inbox/mensajes?conversacion_id=${conversacion.id}&limite=50`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMensajes(data.mensajes || data || [])
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [conversacion])

  useEffect(() => {
    if (abierto && conversacion) {
      cargarMensajes()
      setTexto('')
    }
  }, [abierto, conversacion, cargarMensajes])

  // Scroll al final cuando llegan mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  // ─── Enviar mensaje ───

  const enviar = useCallback(async () => {
    if (!texto.trim() || !conversacion || enviando) return
    const textoEnviar = texto.trim()
    setTexto('')
    setEnviando(true)

    try {
      const res = await fetch('/api/inbox/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: conversacion.canal_id,
          conversacion_id: conversacion.id,
          tipo: 'texto',
          texto: textoEnviar,
        }),
      })
      if (res.ok) {
        // Recargar mensajes para ver el enviado
        cargarMensajes()
      }
    } catch {
      // Restaurar texto si falla
      setTexto(textoEnviar)
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }, [texto, conversacion, enviando, cargarMensajes])

  // ─── Nombre del contacto ───

  const nombreContacto = conversacion
    ? conversacion.contacto?.nombre
      ? `${conversacion.contacto.nombre}${conversacion.contacto.apellido ? ` ${conversacion.contacto.apellido}` : ''}`
      : conversacion.contacto_nombre || conversacion.identificador_externo || 'Sin nombre'
    : ''

  // ─── Agrupar mensajes por fecha ───

  const mensajesAgrupados = mensajes.reduce<{ fecha: string; mensajes: MensajeConAdjuntos[] }[]>((acc, msg) => {
    const fecha = formatoFecha(msg.creado_en, formato.locale)
    const grupo = acc.find(g => g.fecha === fecha)
    if (grupo) grupo.mensajes.push(msg)
    else acc.push({ fecha, mensajes: [msg] })
    return acc
  }, [])

  return (
    <AnimatePresence>
      {abierto && conversacion && (
        <>
          {/* Overlay oscuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onCerrar}
          />

          {/* Panel flotante */}
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed top-4 right-4 bottom-4 z-50 flex flex-col w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl border border-borde-sutil"
            style={{ background: 'var(--superficie-app)' }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-texto-primario truncate">{nombreContacto}</div>
                <div className="text-xs text-texto-terciario truncate">
                  {conversacion.identificador_externo || conversacion.contacto?.telefono || ''}
                </div>
              </div>

              {/* Abrir en inbox completo */}
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo="Abrir en inbox"
                icono={<ArrowUpRight size={14} />}
                onClick={() => {
                  router.push(`/inbox?conv=${conversacion.id}&tab=${tipoCanal}`)
                  onCerrar()
                }}
              />

              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo="Cerrar"
                icono={<X size={16} />}
                onClick={onCerrar}
              />
            </div>

            {/* ── Selector de etapa ── */}
            <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
              <SelectorEtapa
                conversacionId={conversacion.id}
                tipoCanal={tipoCanal as 'whatsapp' | 'correo'}
                etapaActualId={conversacion.etapa_id || null}
                onCambio={(etapaId) => {
                  onEtapaCambiada?.(conversacion.id, etapaId)
                }}
              />
            </div>

            {/* ── Mensajes ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1"
              style={{ background: 'var(--superficie-app)' }}
            >
              {cargando ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-texto-terciario" />
                </div>
              ) : mensajes.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-xs text-texto-terciario">Sin mensajes</p>
                </div>
              ) : (
                mensajesAgrupados.map((grupo) => (
                  <div key={grupo.fecha}>
                    {/* Separador de fecha */}
                    <div className="flex items-center justify-center my-3">
                      <span className="text-xxs text-texto-terciario bg-superficie-hover px-2.5 py-0.5 rounded-full uppercase tracking-wider font-medium">
                        {grupo.fecha}
                      </span>
                    </div>

                    {/* Burbujas */}
                    {grupo.mensajes.map((msg) => {
                      const esEntrante = msg.es_entrante
                      const esNota = msg.es_nota_interna

                      if (esNota) {
                        return (
                          <div key={msg.id} className="flex justify-center my-1">
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1 max-w-[90%] text-center italic">
                              {msg.texto}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={msg.id} className={`flex ${esEntrante ? 'justify-start' : 'justify-end'} mb-0.5`}>
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm leading-relaxed ${
                              esEntrante
                                ? 'bg-superficie-tarjeta border border-borde-sutil text-texto-primario rounded-bl-sm'
                                : 'text-white rounded-br-sm'
                            }`}
                            style={!esEntrante ? { background: 'var(--canal-whatsapp, #25D366)' } : undefined}
                          >
                            {/* Tipo de contenido */}
                            {msg.tipo_contenido === 'texto' && msg.texto && (
                              <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                            )}
                            {msg.tipo_contenido === 'imagen' && (
                              <p className="opacity-70">[Imagen]</p>
                            )}
                            {msg.tipo_contenido === 'audio' && (
                              <p className="opacity-70">[Audio]</p>
                            )}
                            {msg.tipo_contenido === 'video' && (
                              <p className="opacity-70">[Video]</p>
                            )}
                            {msg.tipo_contenido === 'documento' && (
                              <p className="opacity-70">[Documento]</p>
                            )}
                            {msg.tipo_contenido === 'sticker' && (
                              <p className="opacity-70">[Sticker]</p>
                            )}
                            {msg.tipo_contenido === 'ubicacion' && (
                              <p className="opacity-70">[Ubicación]</p>
                            )}
                            {msg.tipo_contenido !== 'texto' && msg.texto && (
                              <p className="whitespace-pre-wrap break-words mt-1">{msg.texto}</p>
                            )}

                            {/* Hora */}
                            <div className={`text-xxs mt-0.5 text-right ${esEntrante ? 'text-texto-terciario' : 'text-white/70'}`}>
                              {formatoHora(msg.creado_en, formato.locale, formato.formatoHora === '12h')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* ── Compositor ── */}
            <div
              className="shrink-0 px-3 py-2 flex items-end gap-2"
              style={{ borderTop: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
            >
              <textarea
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                placeholder="Mensaje..."
                rows={1}
                className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario max-h-24 py-1.5"
                style={{ scrollbarWidth: 'thin' }}
              />
              <Boton
                variante="primario"
                tamano="xs"
                soloIcono
                titulo="Enviar"
                icono={enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                onClick={enviar}
                disabled={!texto.trim() || enviando}
                className="shrink-0 mb-0.5"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
