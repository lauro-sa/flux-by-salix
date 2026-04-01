'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import {
  Hash, Lock, MessageSquare, Plus, ChevronRight,
  Users, Settings, Smile, AtSign, Reply, X,
  BellOff, Bell, LogOut, Check, CheckCheck,
  MoreHorizontal, UserPlus, Pencil, Archive,
} from 'lucide-react'
import { CompositorMensaje, type DatosMensaje } from './CompositorMensaje'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
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
  onSeleccionarCanal: (canal: CanalInterno) => void
  onCrearCanal: () => void
  onEnviar: (datos: DatosMensaje) => void
  cargando: boolean
  enviando: boolean
  /** ID del usuario actual para read receipts */
  usuarioId?: string
  /** Callback para recargar la lista de canales (ej. al salir de un grupo) */
  onRecargarCanales?: () => void
}

function formatoHoraInterno(fecha: string): string {
  const d = new Date(fecha)
  const hoy = new Date()
  const esHoy = d.toDateString() === hoy.toDateString()

  if (esHoy) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
}: PropiedadesPanelInterno) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [respondiendo, setRespondiendo] = useState<{ id: string; texto: string; autor: string } | null>(null)
  const [hiloAbierto, setHiloAbierto] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [menuCanal, setMenuCanal] = useState(false)

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

  // Silenciar canal
  const toggleSilenciar = useCallback(async () => {
    if (!canalSeleccionado) return
    try {
      const res = await fetch(`/api/inbox/internos/${canalSeleccionado.id}/silenciar`, { method: 'POST' })
      const data = await res.json()
      if (data.silenciado !== undefined) {
        onSeleccionarCanal({ ...canalSeleccionado, silenciado: data.silenciado })
        mostrar('exito', data.silenciado ? 'Canal silenciado' : 'Notificaciones activadas')
      }
    } catch {
      mostrar('error', 'Error al cambiar silencio')
    }
    setMenuCanal(false)
  }, [canalSeleccionado, onSeleccionarCanal, mostrar])

  // Salir del grupo
  const salirDelGrupo = useCallback(async () => {
    if (!canalSeleccionado || canalSeleccionado.tipo !== 'grupo') return
    if (!confirm('¿Querés salir de este grupo?')) return
    try {
      const res = await fetch(`/api/inbox/internos/${canalSeleccionado.id}/miembros`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        mostrar('exito', `Saliste de ${canalSeleccionado.nombre}`)
        onRecargarCanales?.()
      } else {
        const data = await res.json()
        mostrar('error', data.error || 'Error al salir del grupo')
      }
    } catch {
      mostrar('error', 'Error de conexión')
    }
    setMenuCanal(false)
  }, [canalSeleccionado, mostrar, onRecargarCanales])

  // Marcar como leído al seleccionar canal
  useEffect(() => {
    if (!canalSeleccionado) return
    fetch(`/api/inbox/internos/${canalSeleccionado.id}/lecturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {})
  }, [canalSeleccionado?.id])

  return (
    <div className="flex-1 flex" style={{ background: 'var(--superficie-app)' }}>
      {/* Sidebar de canales */}
      <div
        className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto"
        style={{
          borderRight: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-sidebar)',
        }}
      >
        {/* Header */}
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Mensajería
          </span>
          <button
            onClick={onCrearCanal}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--texto-terciario)' }}
            aria-label="Crear canal o grupo"
          >
            <Plus size={16} />
          </button>
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
            />
          ))}
          {canalesPrivados.filter(c => c.tipo === 'privado').map((canal) => (
            <CanalItem
              key={canal.id}
              canal={canal}
              seleccionado={canalSeleccionado?.id === canal.id}
              onClick={() => onSeleccionarCanal(canal)}
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel de mensajes */}
      <div className="flex-1 flex flex-col">
        {!canalSeleccionado ? (
          <div className="flex-1 flex items-center justify-center">
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
                <button
                  onClick={() => setMenuCanal(prev => !prev)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--texto-terciario)' }}
                  aria-label="Opciones del canal"
                >
                  <MoreHorizontal size={16} />
                </button>
                <AnimatePresence>
                  {menuCanal && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[180px]"
                      style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <button
                        onClick={toggleSilenciar}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                        style={{ color: 'var(--texto-secundario)' }}
                      >
                        {canalSeleccionado.silenciado ? <Bell size={12} /> : <BellOff size={12} />}
                        {canalSeleccionado.silenciado ? 'Activar notificaciones' : 'Silenciar'}
                      </button>
                      {canalSeleccionado.tipo === 'grupo' && (
                        <button
                          onClick={salirDelGrupo}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                          style={{ color: 'var(--insignia-peligro)' }}
                        >
                          <LogOut size={12} /> Salir del grupo
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
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
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    No hay mensajes todavía. Enviá el primero.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mensajes.map((msg) => (
                    <MensajeInterno
                      key={msg.id}
                      mensaje={msg}
                      esPropio={msg.remitente_id === usuarioId}
                      onResponder={() => setRespondiendo({
                        id: msg.id,
                        texto: msg.texto || '',
                        autor: msg.remitente_nombre || 'Desconocido',
                      })}
                      onAbrirHilo={() => setHiloAbierto(msg.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Compositor */}
            <CompositorMensaje
              tipoCanal="interno"
              onEnviar={onEnviar}
              cargando={enviando}
              placeholder={`Mensaje en #${canalSeleccionado.nombre}...`}
              respondiendo={respondiendo}
              onCancelarRespuesta={() => setRespondiendo(null)}
            />
          </>
        )}
      </div>

      {/* Panel de hilo (lateral) */}
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
              <button
                onClick={() => setHiloAbierto(null)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--texto-terciario)' }}
                aria-label="Cerrar hilo"
              >
                <X size={14} />
              </button>
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
    </div>
  )
}

// Item de canal en la sidebar
function CanalItem({
  canal,
  seleccionado,
  onClick,
}: {
  canal: CanalInterno
  seleccionado: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors"
      style={{
        background: seleccionado ? 'var(--superficie-seleccionada)' : 'transparent',
        color: seleccionado ? 'var(--texto-primario)' : 'var(--texto-secundario)',
      }}
    >
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
        <BellOff size={10} style={{ color: 'var(--texto-terciario)' }} />
      )}
    </button>
  )
}

// Mensaje individual estilo Slack con read receipts
function MensajeInterno({
  mensaje,
  esPropio = false,
  onResponder,
  onAbrirHilo,
}: {
  mensaje: MensajeConAdjuntos
  esPropio?: boolean
  onResponder: () => void
  onAbrirHilo: () => void
}) {
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

  return (
    <div
      className="group flex gap-2.5 px-1 py-0.5 rounded-md transition-colors relative"
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
            {formatoHoraInterno(mensaje.creado_en)}
          </span>
          {/* Read receipt indicator (solo en mensajes propios) */}
          {esPropio && (
            <button
              onClick={cargarLecturas}
              className="flex items-center gap-0.5 text-xxs transition-colors relative"
              style={{ color: 'var(--texto-terciario)' }}
              title="Ver quién leyó"
            >
              <CheckCheck size={12} />
            </button>
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
                  <img
                    key={adj.id}
                    src={adj.url}
                    alt={adj.nombre_archivo}
                    className="rounded-md cursor-pointer"
                    style={{ maxWidth: 300, maxHeight: 200 }}
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
              className="mt-1 rounded-lg p-2 text-xs"
              style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              {lecturas.leido_por.length > 0 && (
                <div className="mb-1.5">
                  <p className="font-semibold mb-0.5" style={{ color: 'var(--texto-secundario)' }}>
                    Visto por
                  </p>
                  {lecturas.leido_por.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                      <span style={{ color: 'var(--texto-primario)' }}>{l.nombre}</span>
                      <span style={{ color: 'var(--texto-terciario)' }}>{formatoHoraInterno(l.leido_en)}</span>
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
              <button
                key={emoji}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  background: 'var(--superficie-hover)',
                  border: '1px solid var(--borde-sutil)',
                }}
              >
                {emoji} <span style={{ color: 'var(--texto-secundario)' }}>{(usuarios as string[]).length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Indicador de hilo */}
        {mensaje.cantidad_respuestas > 0 && (
          <button
            onClick={onAbrirHilo}
            className="flex items-center gap-1 mt-1 text-xs font-medium transition-colors"
            style={{ color: 'var(--texto-marca)' }}
          >
            <MessageSquare size={12} />
            {mensaje.cantidad_respuestas} {mensaje.cantidad_respuestas === 1 ? 'respuesta' : 'respuestas'}
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Acciones flotantes */}
      <AnimatePresence>
        {mostrarAcciones && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute -top-3 right-2 flex items-center gap-0.5 px-1 py-0.5 rounded-md"
            style={{
              background: 'var(--superficie-elevada)',
              boxShadow: 'var(--sombra-md)',
              border: '1px solid var(--borde-sutil)',
            }}
          >
            <button className="p-1 rounded transition-colors" style={{ color: 'var(--texto-terciario)' }} title="Reaccionar" aria-label="Reaccionar">
              <Smile size={14} />
            </button>
            <button
              onClick={onResponder}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--texto-terciario)' }}
              title="Responder en hilo"
              aria-label="Responder en hilo"
            >
              <MessageSquare size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
