'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import {
  Hash, Lock, MessageSquare, Plus, ChevronRight, ChevronLeft,
  Users, Settings, Smile, AtSign, Reply, X,
  BellOff, Bell, LogOut, Check, CheckCheck,
  MoreHorizontal, UserPlus, Pencil, Archive, SmilePlus,
} from 'lucide-react'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { CompositorMensaje, type DatosMensaje } from '@/componentes/mensajeria/CompositorMensaje'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import Image from 'next/image'
import type { MensajeConAdjuntos, CanalInterno, Conversacion } from '@/tipos/inbox'

/**
 * Panel de mensajería interna — estilo Slack.
 * Muestra: canales, grupos, DMs. Soporta silenciar, salir, read receipts.
 */

interface PropiedadesPanelInterno {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  canalesPublicos: CanalInterno[]
  canalesPrivados: CanalInterno[]
  canalesGrupos?: CanalInterno[]
  canalSeleccionado: CanalInterno | null
  onSeleccionarCanal: (canal: CanalInterno | null) => void
  onCrearCanal: () => void
  onEnviar: (datos: DatosMensaje) => void
  cargando: boolean
  enviando: boolean
  /** ID del usuario actual para read receipts */
  usuarioId?: string
  /** Callback para recargar la lista de canales (ej. al salir de un grupo) */
  onRecargarCanales?: () => void
  /** Callback para reaccionar a un mensaje (optimistic update desde el padre) */
  onReaccionar?: (mensajeId: string, emoji: string) => void
  /** Modo móvil: muestra una vista a la vez */
  esMovil?: boolean
  /** Vista activa en móvil: 'canales' o 'chat' */
  vistaMovil?: 'canales' | 'chat'
  /** Callback para volver a la lista de canales en móvil */
  onVolverMovil?: () => void
}

/** Etiqueta de fecha estilo WhatsApp: Hoy, Ayer, día de la semana, o fecha completa */
function etiquetaDiaInterno(fecha: Date, locale: string): string {
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, ayer)) return 'Ayer'

  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 6)
  hace7Dias.setHours(0, 0, 0, 0)

  if (fecha >= hace7Dias) {
    return fecha.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }

  return fecha.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatoHoraInterno(fecha: string, locale: string, hour12 = false): string {
  const d = new Date(fecha)
  const hoy = new Date()
  const esHoy = d.toDateString() === hoy.toDateString()

  if (esHoy) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 })
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12 })
}

export function PanelInterno({
  conversacion,
  mensajes,
  canalesPublicos,
  canalesPrivados,
  canalesGrupos = [],
  canalSeleccionado,
  onSeleccionarCanal,
  onCrearCanal,
  onEnviar,
  cargando,
  enviando,
  usuarioId,
  onRecargarCanales,
  onReaccionar: onReaccionarPadre,
  esMovil,
  vistaMovil = 'canales',
  onVolverMovil,
}: PropiedadesPanelInterno) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const { mostrar } = useToast()
  const [respondiendo, setRespondiendo] = useState<{ id: string; texto: string; autor: string } | null>(null)
  const [hiloAbierto, setHiloAbierto] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [menuCanal, setMenuCanal] = useState(false)
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)

  // Cerrar picker de emojis al click fuera
  useEffect(() => {
    if (!pickerMsgId) return
    const cerrar = () => setPickerMsgId(null)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [pickerMsgId])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuCanal) return
    const cerrar = () => setMenuCanal(false)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuCanal])

  // Silenciar canal (genérico — funciona desde header y sidebar)
  const silenciarCanal = useCallback(async (canal: CanalInterno) => {
    try {
      const res = await fetch(`/api/inbox/internos/${canal.id}/silenciar`, { method: 'POST' })
      const data = await res.json()
      if (data.silenciado !== undefined) {
        if (canalSeleccionado?.id === canal.id) {
          onSeleccionarCanal({ ...canal, silenciado: data.silenciado })
        }
        onRecargarCanales?.()
        mostrar('exito', data.silenciado ? 'Canal silenciado' : 'Notificaciones activadas')
      }
    } catch {
      mostrar('error', 'Error al cambiar silencio')
    }
    setMenuCanal(false)
  }, [canalSeleccionado, onSeleccionarCanal, mostrar, onRecargarCanales])

  // Salir del grupo
  const salirDelGrupo = useCallback(async (canal: CanalInterno) => {
    if (canal.tipo !== 'grupo') return
    if (!confirm(`¿Querés salir de ${canal.nombre}?`)) return
    try {
      const res = await fetch(`/api/inbox/internos/${canal.id}/miembros`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        mostrar('exito', `Saliste de ${canal.nombre}`)
        if (canalSeleccionado?.id === canal.id) {
          onSeleccionarCanal(null)
        }
        onRecargarCanales?.()
      } else {
        const data = await res.json()
        mostrar('error', data.error || 'Error al salir del grupo')
      }
    } catch {
      mostrar('error', 'Error de conexión')
    }
  }, [mostrar, onRecargarCanales, canalSeleccionado, onSeleccionarCanal])

  // Archivar canal
  const archivarCanal = useCallback(async (canal: CanalInterno) => {
    if (!confirm(`¿Archivar "${canal.nombre}"?`)) return
    try {
      const res = await fetch(`/api/inbox/internos/${canal.id}`, { method: 'DELETE' })
      if (res.ok) {
        mostrar('exito', `"${canal.nombre}" archivado`)
        // Si el canal archivado es el seleccionado, deseleccionar y limpiar chat
        if (canalSeleccionado?.id === canal.id) {
          onSeleccionarCanal(null)
        }
        onRecargarCanales?.()
      } else {
        const data = await res.json()
        mostrar('error', data.error || 'Error al archivar')
      }
    } catch {
      mostrar('error', 'Error de conexión')
    }
  }, [mostrar, onRecargarCanales, canalSeleccionado, onSeleccionarCanal])

  // Reaccionar: usa la función del padre (optimistic update) + cierra picker
  const reaccionar = useCallback((mensajeId: string, emoji: string) => {
    setPickerMsgId(null)
    onReaccionarPadre?.(mensajeId, emoji)
  }, [onReaccionarPadre])

  // Marcar como leído al seleccionar canal
  useEffect(() => {
    if (!canalSeleccionado) return
    fetch(`/api/inbox/internos/${canalSeleccionado.id}/lecturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {})
  }, [canalSeleccionado?.id])

  // En móvil: mostrar solo sidebar o solo chat según vistaMovil
  const mostrarSidebar = !esMovil || vistaMovil === 'canales'
  const mostrarChat = !esMovil || vistaMovil === 'chat'

  return (
    <div className="flex-1 flex min-h-0" style={{ background: 'var(--superficie-app)' }}>
      {/* Sidebar de canales — oculto en móvil cuando se ve el chat */}
      {mostrarSidebar && (
      <div
        className={esMovil ? 'flex-1 flex flex-col h-full overflow-y-auto' : 'w-80 flex-shrink-0 flex flex-col h-full overflow-y-auto'}
        style={{
          borderRight: esMovil ? 'none' : '1px solid var(--borde-sutil)',
          background: 'var(--superficie-sidebar)',
          overscrollBehaviorY: 'contain',
        }}
      >
        {/* Header */}
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Mensajería
          </span>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Plus size={16} />} onClick={onCrearCanal} titulo="Crear canal o grupo" />
        </div>

        {/* Canales (públicos + privados) */}
        <div className="px-2 pt-3">
          <p className="text-xxs font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--texto-terciario)' }}>
            Canales
          </p>
          {canalesPublicos.map((canal) => (
            <CanalItem
              key={canal.id}
              canal={canal}
              seleccionado={canalSeleccionado?.id === canal.id}
              onClick={() => onSeleccionarCanal(canal)}
              onSilenciar={() => silenciarCanal(canal)}
              onEliminar={() => archivarCanal(canal)}
            />
          ))}
          {canalesPrivados.filter(c => c.tipo === 'privado').map((canal) => (
            <CanalItem
              key={canal.id}
              canal={canal}
              seleccionado={canalSeleccionado?.id === canal.id}
              onClick={() => onSeleccionarCanal(canal)}
              onSilenciar={() => silenciarCanal(canal)}
              onEliminar={() => archivarCanal(canal)}
            />
          ))}
        </div>

        {/* Grupos */}
        {canalesGrupos.length > 0 && (
          <div className="px-2 pt-3">
            <p className="text-xxs font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--texto-terciario)' }}>
              Grupos
            </p>
            {canalesGrupos.map((canal) => (
              <CanalItem
                key={canal.id}
                canal={canal}
                seleccionado={canalSeleccionado?.id === canal.id}
                onClick={() => onSeleccionarCanal(canal)}
                onSilenciar={() => silenciarCanal(canal)}
                onSalir={() => salirDelGrupo(canal)}
                onEliminar={() => archivarCanal(canal)}
              />
            ))}
          </div>
        )}

        {/* Mensajes directos */}
        {canalesPrivados.filter(c => c.tipo === 'directo').length > 0 && (
          <div className="px-2 pt-3">
            <p className="text-xxs font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--texto-terciario)' }}>
              Mensajes directos
            </p>
            {canalesPrivados.filter(c => c.tipo === 'directo').map((canal) => (
              <CanalItem
                key={canal.id}
                canal={canal}
                seleccionado={canalSeleccionado?.id === canal.id}
                onClick={() => onSeleccionarCanal(canal)}
                onSilenciar={() => silenciarCanal(canal)}
                onEliminar={() => archivarCanal(canal)}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {/* Panel de mensajes — oculto en móvil cuando se ven los canales */}
      {mostrarChat && (
      <>
      <div className="flex-1 flex flex-col min-h-0">
        {!canalSeleccionado ? (
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--superficie-hover)' }}
              >
                <Hash size={32} style={{ color: 'var(--canal-interno)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                {t('inbox.seleccionar_conversacion')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header del canal */}
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: '1px solid var(--borde-sutil)',
                background: 'var(--superficie-tarjeta)',
              }}
            >
              {/* Botón atrás en móvil — min 44px zona táctil */}
              {esMovil && onVolverMovil && (
                <button
                  onClick={onVolverMovil}
                  className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-boton transition-colors active:bg-[var(--superficie-hover)]"
                  style={{ color: 'var(--texto-secundario)' }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {canalSeleccionado.tipo === 'publico' ? (
                <Hash size={18} style={{ color: 'var(--canal-interno)' }} />
              ) : canalSeleccionado.tipo === 'privado' ? (
                <Lock size={18} style={{ color: 'var(--canal-interno)' }} />
              ) : canalSeleccionado.tipo === 'grupo' ? (
                <Users size={18} style={{ color: 'var(--canal-interno)' }} />
              ) : (
                <Avatar nombre={canalSeleccionado.nombre} tamano="xs" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                    {canalSeleccionado.tipo === 'directo'
                      ? canalSeleccionado.nombre
                      : `#${canalSeleccionado.nombre}`}
                  </h3>
                  {canalSeleccionado.silenciado && (
                    <BellOff size={12} style={{ color: 'var(--texto-terciario)' }} />
                  )}
                </div>
                {canalSeleccionado.descripcion && (
                  <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                    {canalSeleccionado.descripcion}
                  </p>
                )}
              </div>
              {/* Menú de acciones del canal */}
              <div className="relative">
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<MoreHorizontal size={16} />} onClick={() => setMenuCanal(prev => !prev)} titulo="Opciones del canal" />
                <AnimatePresence>
                  {menuCanal && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-1 z-50 rounded-card py-1 min-w-[180px] bg-superficie-elevada border border-borde-sutil shadow-md"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <OpcionMenu
                        icono={canalSeleccionado.silenciado ? <Bell size={12} /> : <BellOff size={12} />}
                        onClick={() => silenciarCanal(canalSeleccionado)}
                      >
                        {canalSeleccionado.silenciado ? 'Activar notificaciones' : 'Silenciar'}
                      </OpcionMenu>
                      {canalSeleccionado.tipo === 'grupo' && (
                        <OpcionMenu
                          icono={<LogOut size={12} />}
                          peligro
                          onClick={() => salirDelGrupo(canalSeleccionado)}
                        >
                          Salir del grupo
                        </OpcionMenu>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              {cargando ? (
                <div className="flex items-center justify-center h-full">
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
              ) : mensajes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <EstadoVacio titulo="No hay mensajes todavía" descripcion="Enviá el primero." />
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Agrupar mensajes en secciones por fecha para sticky correcto */}
                  {(() => {
                    const secciones: { fecha: Date; msgs: typeof mensajes }[] = []
                    for (const msg of mensajes) {
                      const fecha = new Date(msg.creado_en)
                      const ultima = secciones[secciones.length - 1]
                      if (!ultima || fecha.toDateString() !== ultima.fecha.toDateString()) {
                        secciones.push({ fecha, msgs: [msg] })
                      } else {
                        ultima.msgs.push(msg)
                      }
                    }
                    return secciones.map((seccion, si) => (
                      <div key={si}>
                        {/* Píldora de fecha sticky — empujada por la siguiente sección */}
                        <div
                          className="flex justify-center py-2 z-10"
                          style={{ position: 'sticky', top: 0 }}
                        >
                          <span
                            className="text-xxs font-medium px-3 py-1 rounded-full shadow-sm"
                            style={{
                              background: 'var(--superficie-elevada)',
                              color: 'var(--texto-terciario)',
                            }}
                          >
                            {etiquetaDiaInterno(seccion.fecha, formato.locale)}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {seccion.msgs.map((msg) => (
                            <div key={msg.id}>
                              <MensajeInterno
                                mensaje={msg}
                                esPropio={msg.remitente_id === usuarioId}
                                esDM={canalSeleccionado?.tipo === 'directo'}
                                pickerAbierto={pickerMsgId === msg.id}
                                onTogglePicker={() => setPickerMsgId(pickerMsgId === msg.id ? null : msg.id)}
                                onResponder={() => setRespondiendo({
                                  id: msg.id,
                                  texto: msg.texto || '',
                                  autor: msg.remitente_nombre || 'Desconocido',
                                })}
                                onAbrirHilo={() => setHiloAbierto(msg.id)}
                                onReaccionar={reaccionar}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>

            {/* Compositor */}
            <CompositorMensaje
              tipoCanal="interno"
              onEnviar={onEnviar}
              cargando={enviando}
              placeholder={canalSeleccionado.tipo === 'directo' ? `Mensaje a ${canalSeleccionado.nombre}...` : `Mensaje en #${canalSeleccionado.nombre}...`}
              respondiendo={respondiendo}
              onCancelarRespuesta={() => setRespondiendo(null)}
            />
          </>
        )}
      </div>

      {/* Panel de hilo (lateral) — solo desktop */}
      {!esMovil && (
        <AnimatePresence>
          {hiloAbierto && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 h-full overflow-hidden flex flex-col"
              style={{
                borderLeft: '1px solid var(--borde-sutil)',
                background: 'var(--superficie-tarjeta)',
              }}
            >
              <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                  Hilo
                </span>
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={14} />} onClick={() => setHiloAbierto(null)} titulo="Cerrar hilo" />
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                  Las respuestas del hilo aparecerán acá.
                </p>
              </div>
              <CompositorMensaje
                tipoCanal="interno"
                onEnviar={(datos) => {
                  onEnviar({ ...datos, respuesta_a_id: hiloAbierto })
                }}
                cargando={enviando}
                placeholder="Responder en hilo..."
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
      </>
      )}
    </div>
  )
}

// Item de canal en la sidebar con menú contextual
function CanalItem({
  canal,
  seleccionado,
  onClick,
  onSilenciar,
  onEliminar,
  onSalir,
}: {
  canal: CanalInterno
  seleccionado: boolean
  onClick: () => void
  onSilenciar?: () => void
  onEliminar?: () => void
  onSalir?: () => void
}) {
  const [menu, setMenu] = useState(false)

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menu) return
    const cerrar = () => setMenu(false)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menu])

  return (
    <div className="relative group">
      <Boton
        variante="fantasma"
        tamano="sm"
        anchoCompleto
        onClick={onClick}
        className="text-sm"
        style={{
          background: seleccionado ? 'var(--superficie-seleccionada)' : 'transparent',
          color: seleccionado ? 'var(--texto-primario)' : 'var(--texto-secundario)',
        }}
      >
        <span className="flex items-center gap-2 w-full">
          {canal.tipo === 'publico' ? (
            <Hash size={14} style={{ color: 'var(--texto-terciario)' }} />
          ) : canal.tipo === 'privado' ? (
            <Lock size={14} style={{ color: 'var(--texto-terciario)' }} />
          ) : canal.tipo === 'grupo' ? (
            <Users size={14} style={{ color: 'var(--texto-terciario)' }} />
          ) : (
            <Avatar nombre={canal.nombre} tamano="xs" />
          )}
          <span className="truncate flex-1 text-left">{canal.nombre}</span>
          {canal.silenciado && (
            <BellOff size={10} className="flex-shrink-0" style={{ color: 'var(--texto-terciario)' }} />
          )}
          {/* Tres puntos — visible en hover */}
          <span
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); setMenu(prev => !prev) }}
            style={{ color: 'var(--texto-terciario)' }}
          >
            <MoreHorizontal size={12} />
          </span>
        </span>
      </Boton>

      {/* Menú contextual */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-1 top-full z-50 rounded-card py-1 min-w-[160px] bg-superficie-elevada border border-borde-sutil shadow-md"
            onMouseDown={e => e.stopPropagation()}
          >
            {onSilenciar && (
              <OpcionMenu
                icono={canal.silenciado ? <Bell size={12} /> : <BellOff size={12} />}
                onClick={() => { onSilenciar(); setMenu(false) }}
              >
                {canal.silenciado ? 'Activar notificaciones' : 'Silenciar'}
              </OpcionMenu>
            )}
            {onSalir && canal.tipo === 'grupo' && (
              <OpcionMenu
                icono={<LogOut size={12} />}
                peligro
                onClick={() => { onSalir(); setMenu(false) }}
              >
                Salir del grupo
              </OpcionMenu>
            )}
            {onEliminar && (
              <OpcionMenu
                icono={<Archive size={12} />}
                peligro
                onClick={() => { onEliminar(); setMenu(false) }}
              >
                {canal.tipo === 'directo' ? 'Eliminar chat' : 'Archivar'}
              </OpcionMenu>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const EMOJIS_RAPIDOS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// Mensaje individual — estilo Slack para canales/grupos, estilo chat para DMs
function MensajeInterno({
  mensaje,
  esPropio = false,
  esDM = false,
  pickerAbierto = false,
  onTogglePicker,
  onResponder,
  onAbrirHilo,
  onReaccionar,
}: {
  mensaje: MensajeConAdjuntos
  esPropio?: boolean
  esDM?: boolean
  pickerAbierto?: boolean
  onTogglePicker?: () => void
  onResponder: () => void
  onAbrirHilo: () => void
  onReaccionar?: (mensajeId: string, emoji: string) => void
}) {
  const formato = useFormato()
  const [mostrarAcciones, setMostrarAcciones] = useState(false)
  const [lecturas, setLecturas] = useState<{ leido_por: { nombre: string; leido_en: string }[]; sin_leer: { nombre: string }[] } | null>(null)
  const [mostrarLecturas, setMostrarLecturas] = useState(false)

  // Cargar lecturas al hacer click (lazy load)
  const cargarLecturas = useCallback(async () => {
    if (lecturas) {
      setMostrarLecturas(prev => !prev)
      return
    }
    try {
      const res = await fetch(`/api/inbox/mensajes/${mensaje.id}/lecturas`)
      const data = await res.json()
      setLecturas(data)
      setMostrarLecturas(true)
    } catch { /* silenciar */ }
  }, [mensaje.id, lecturas])

  const tieneReacciones = mensaje.reacciones && Object.keys(mensaje.reacciones).length > 0

  // ─── Modo DM: burbujas estilo WhatsApp (mismo patrón que PanelWhatsApp) ───
  if (esDM) {
    return (
      <div className={`flex flex-col ${esPropio ? 'items-end' : 'items-start'}`}>
        <div className="relative max-w-[75%] group/burbuja">
          {/* Burbuja */}
          <div
            className="rounded-card px-3 py-2"
            style={{
              background: esPropio ? 'var(--texto-marca)' : 'var(--superficie-elevada)',
              color: esPropio ? 'var(--texto-inverso)' : 'var(--texto-primario)',
              borderBottomRightRadius: esPropio ? 4 : undefined,
              borderBottomLeftRadius: !esPropio ? 4 : undefined,
            }}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{mensaje.texto}</p>

            {/* Adjuntos */}
            {mensaje.adjuntos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {mensaje.adjuntos.map((adj) => adj.tipo_mime.startsWith('image/')
                  ? <Image key={adj.id} src={adj.url} alt={adj.nombre_archivo} width={240} height={160} sizes="240px" className="rounded-boton object-contain" />
                  : <a key={adj.id} href={adj.url} target="_blank" rel="noopener noreferrer" className="text-xs underline">📎 {adj.nombre_archivo}</a>
                )}
              </div>
            )}

            <div className={`flex items-center gap-1 mt-0.5 ${esPropio ? 'justify-end' : ''}`}>
              <span className="text-xxs" style={{ opacity: 0.7 }}>
                {formatoHoraInterno(mensaje.creado_en, formato.locale, formato.formatoHora === '12h')}
              </span>
              {esPropio && (
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<CheckCheck size={12} />} onClick={cargarLecturas} titulo="Ver quién leyó" style={{ opacity: 0.7 }} />
              )}
            </div>
          </div>

          {/* Reacciones debajo de la burbuja */}
          {tieneReacciones && (
            <div className={`flex gap-1 mt-0.5 ${esPropio ? 'justify-end mr-1' : 'ml-1'}`}>
              {Object.entries(mensaje.reacciones).map(([emoji, usuarios]) => (
                <span
                  key={emoji}
                  className="text-xs px-1 py-0.5 rounded-full cursor-pointer"
                  style={{ background: 'var(--superficie-hover)' }}
                  onClick={() => onReaccionar?.(mensaje.id, emoji)}
                >
                  {emoji}{(usuarios as string[]).length > 1 ? ` ${(usuarios as string[]).length}` : ''}
                </span>
              ))}
            </div>
          )}

          {/* Botón reaccionar (hover) — igual que WhatsApp */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo="Reaccionar"
            icono={<SmilePlus size={12} />}
            onClick={onTogglePicker}
            className={`absolute top-0 opacity-0 group-hover/burbuja:opacity-100 ${esPropio ? '-left-1' : '-right-1'}`}
            style={{
              background: 'var(--superficie-elevada)',
              color: 'var(--texto-terciario)',
              boxShadow: 'var(--sombra-sm)',
            }}
          />

          {/* Picker de emojis rápidos */}
          <AnimatePresence>
            {pickerAbierto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onMouseDown={e => e.stopPropagation()}
                className={`absolute -top-8 flex items-center gap-0.5 px-1.5 py-1 rounded-full z-10 ${esPropio ? 'right-0' : 'left-0'}`}
                style={{
                  background: 'var(--superficie-elevada)',
                  boxShadow: 'var(--sombra-md)',
                  border: '1px solid var(--borde-sutil)',
                }}
              >
                {EMOJIS_RAPIDOS.map(e => (
                  <Boton
                    key={e}
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => onReaccionar?.(mensaje.id, e)}
                    className="text-base hover:scale-125 p-0.5"
                  >
                    {e}
                  </Boton>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Popover de lecturas */}
          <AnimatePresence>
            {mostrarLecturas && lecturas && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1 rounded-card p-2 text-xs z-50 min-w-[140px] bg-superficie-elevada text-texto-primario border border-borde-sutil shadow-md"
                style={{ [esPropio ? 'right' : 'left']: 0 }}
              >
                {lecturas.leido_por.length > 0 && (
                  <div className="mb-1">
                    <p className="font-semibold mb-0.5" style={{ color: 'var(--texto-secundario)' }}>Visto</p>
                    {lecturas.leido_por.map((l, i) => (
                      <div key={i} className="flex justify-between gap-3 py-0.5">
                        <span>{l.nombre}</span>
                        <span style={{ color: 'var(--texto-terciario)' }}>{formatoHoraInterno(l.leido_en, formato.locale, formato.formatoHora === '12h')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {lecturas.sin_leer.length > 0 && (
                  <div>
                    <p className="font-semibold mb-0.5" style={{ color: 'var(--texto-terciario)' }}>Sin leer</p>
                    {lecturas.sin_leer.map((l, i) => <div key={i} className="py-0.5" style={{ color: 'var(--texto-terciario)' }}>{l.nombre}</div>)}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  // ─── Modo canal/grupo: estilo Slack ───
  return (
    <div
      className="group flex gap-2.5 px-1 py-0.5 rounded-boton transition-colors relative"
      onMouseEnter={() => setMostrarAcciones(true)}
      onMouseLeave={() => { setMostrarAcciones(false); setMostrarLecturas(false) }}
      style={{ background: mostrarAcciones ? 'var(--superficie-hover)' : 'transparent' }}
    >
      <Avatar nombre={mensaje.remitente_nombre || '?'} tamano="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            {mensaje.remitente_nombre || 'Desconocido'}
          </span>
          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            {formatoHoraInterno(mensaje.creado_en, formato.locale, formato.formatoHora === '12h')}
          </span>
          {/* Read receipt indicator (solo en mensajes propios) */}
          {esPropio && (
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<CheckCheck size={12} />} onClick={cargarLecturas} titulo="Ver quién leyó" style={{ color: 'var(--texto-terciario)' }} />
          )}
        </div>

        {/* Texto */}
        <p
          className="text-sm whitespace-pre-wrap break-words mt-0.5"
          style={{ color: 'var(--texto-primario)' }}
        >
          {mensaje.texto}
        </p>

        {/* Adjuntos */}
        {mensaje.adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {mensaje.adjuntos.map((adj) => {
              if (adj.tipo_mime.startsWith('image/')) {
                return (
                  <Image
                    key={adj.id}
                    src={adj.url}
                    alt={adj.nombre_archivo}
                    width={300}
                    height={200}
                    sizes="300px"
                    className="rounded-boton object-contain cursor-pointer"
                  />
                )
              }
              return (
                <a
                  key={adj.id}
                  href={adj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--superficie-app)', color: 'var(--texto-secundario)' }}
                >
                  📎 {adj.nombre_archivo}
                </a>
              )
            })}
          </div>
        )}

        {/* Popover de lecturas */}
        <AnimatePresence>
          {mostrarLecturas && lecturas && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1 rounded-card p-2 text-xs bg-superficie-elevada border border-borde-sutil shadow-md"
            >
              {lecturas.leido_por.length > 0 && (
                <div className="mb-1.5">
                  <p className="font-semibold mb-0.5" style={{ color: 'var(--texto-secundario)' }}>
                    Visto por
                  </p>
                  {lecturas.leido_por.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                      <span style={{ color: 'var(--texto-primario)' }}>{l.nombre}</span>
                      <span style={{ color: 'var(--texto-terciario)' }}>{formatoHoraInterno(l.leido_en, formato.locale, formato.formatoHora === '12h')}</span>
                    </div>
                  ))}
                </div>
              )}
              {lecturas.sin_leer.length > 0 && (
                <div>
                  <p className="font-semibold mb-0.5" style={{ color: 'var(--texto-terciario)' }}>
                    Sin leer
                  </p>
                  {lecturas.sin_leer.map((l, i) => (
                    <div key={i} className="py-0.5" style={{ color: 'var(--texto-terciario)' }}>
                      {l.nombre}
                    </div>
                  ))}
                </div>
              )}
              {lecturas.leido_por.length === 0 && lecturas.sin_leer.length === 0 && (
                <p style={{ color: 'var(--texto-terciario)' }}>Sin información de lectura</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reacciones */}
        {mensaje.reacciones && Object.keys(mensaje.reacciones).length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {Object.entries(mensaje.reacciones).map(([emoji, usuarios]) => (
              <Boton
                key={emoji}
                variante="secundario"
                tamano="xs"
                redondeado
                style={{
                  background: 'var(--superficie-hover)',
                  border: '1px solid var(--borde-sutil)',
                }}
              >
                {emoji} <span style={{ color: 'var(--texto-secundario)' }}>{(usuarios as string[]).length}</span>
              </Boton>
            ))}
          </div>
        )}

        {/* Indicador de hilo */}
        {mensaje.cantidad_respuestas > 0 && (
          <Boton
            variante="fantasma"
            tamano="xs"
            icono={<MessageSquare size={12} />}
            iconoDerecho={<ChevronRight size={12} />}
            onClick={onAbrirHilo}
            style={{ color: 'var(--texto-marca)' }}
            className="mt-1"
          >
            {mensaje.cantidad_respuestas} {mensaje.cantidad_respuestas === 1 ? 'respuesta' : 'respuestas'}
          </Boton>
        )}
      </div>

      {/* Acciones flotantes */}
      <AnimatePresence>
        {mostrarAcciones && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute -top-3 right-2 flex items-center gap-0.5 px-1 py-0.5 rounded-boton"
            style={{
              background: 'var(--superficie-elevada)',
              boxShadow: 'var(--sombra-md)',
              border: '1px solid var(--borde-sutil)',
            }}
          >
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<SmilePlus size={14} />} onClick={onTogglePicker} titulo="Reaccionar" />
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<MessageSquare size={14} />} onClick={onResponder} titulo="Responder en hilo" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Picker de emojis rápidos (modo Slack) */}
      <AnimatePresence>
        {pickerAbierto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onMouseDown={e => e.stopPropagation()}
            className="absolute right-2 -top-8 flex items-center gap-0.5 px-1.5 py-1 rounded-full z-50 bg-superficie-elevada border border-borde-sutil shadow-sm"
          >
            {EMOJIS_RAPIDOS.map(e => (
              <Boton
                key={e}
                variante="fantasma"
                tamano="xs"
                onClick={() => onReaccionar?.(mensaje.id, e)}
                className="text-sm hover:scale-125 px-0.5"
              >
                {e}
              </Boton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
