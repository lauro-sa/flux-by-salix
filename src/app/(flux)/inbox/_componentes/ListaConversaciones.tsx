'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { Buscador } from '@/componentes/ui/Buscador'
import { Pildora } from '@/componentes/ui/Pildora'
import {
  MessageCircle, Mail, Hash, Clock, User, Filter,
  ChevronDown, Circle,
} from 'lucide-react'
import type { ConversacionConDetalles, EstadoConversacion, TipoCanal } from '@/tipos/inbox'

/**
 * Panel izquierdo del inbox — lista de conversaciones con filtros.
 * Se usa en: página principal del inbox, adaptado por cada tab (WA, correo, interno).
 */

interface PropiedadesListaConversaciones {
  conversaciones: ConversacionConDetalles[]
  seleccionada: string | null
  onSeleccionar: (id: string) => void
  busqueda: string
  onBusqueda: (valor: string) => void
  filtroEstado: EstadoConversacion | 'todas'
  onFiltroEstado: (estado: EstadoConversacion | 'todas') => void
  tipoCanal: TipoCanal
  cargando: boolean
  totalNoLeidos: number
}

// Iconos de canal
const ICONO_CANAL: Record<TipoCanal, React.ReactNode> = {
  whatsapp: <MessageCircle size={14} />,
  correo: <Mail size={14} />,
  interno: <Hash size={14} />,
}

// Colores de estado
const COLOR_ESTADO: Record<EstadoConversacion, string> = {
  abierta: 'exito',
  en_espera: 'advertencia',
  resuelta: 'neutro',
  spam: 'peligro',
}

// Formato de tiempo relativo
function tiempoRelativo(fecha: string): string {
  const ahora = new Date()
  const msg = new Date(fecha)
  const diff = ahora.getTime() - msg.getTime()
  const minutos = Math.floor(diff / 60000)
  const horas = Math.floor(diff / 3600000)
  const dias = Math.floor(diff / 86400000)

  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `${minutos}m`
  if (horas < 24) return `${horas}h`
  if (dias < 7) return `${dias}d`
  return msg.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export function ListaConversaciones({
  conversaciones,
  seleccionada,
  onSeleccionar,
  busqueda,
  onBusqueda,
  filtroEstado,
  onFiltroEstado,
  tipoCanal,
  cargando,
  totalNoLeidos,
}: PropiedadesListaConversaciones) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const estados: { clave: EstadoConversacion | 'todas'; etiqueta: string }[] = [
    { clave: 'todas', etiqueta: 'Todas' },
    { clave: 'abierta', etiqueta: 'Abiertas' },
    { clave: 'en_espera', etiqueta: 'En espera' },
    { clave: 'resuelta', etiqueta: 'Resueltas' },
    { clave: 'spam', etiqueta: 'Spam' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid var(--borde-sutil)' }}>
      {/* Header con búsqueda */}
      <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ICONO_CANAL[tipoCanal]}
            <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Conversaciones
            </span>
            {totalNoLeidos > 0 && (
              <span
                className="text-xxs font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'var(--insignia-peligro-fondo)',
                  color: 'var(--insignia-peligro-texto)',
                }}
              >
                {totalNoLeidos}
              </span>
            )}
          </div>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--texto-terciario)' }}
          >
            <Filter size={14} />
          </button>
        </div>

        <Buscador
          valor={busqueda}
          onChange={onBusqueda}
          placeholder="Buscar conversación..."
        />

        {/* Filtros por estado */}
        <AnimatePresence>
          {mostrarFiltros && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-1 overflow-hidden"
            >
              {estados.map((e) => (
                <Pildora
                  key={e.clave}
                  activa={filtroEstado === e.clave}
                  onClick={() => onFiltroEstado(e.clave)}
                >
                  {e.etiqueta}
                </Pildora>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lista de conversaciones */}
      <div className="flex-1 overflow-y-auto">
        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--texto-terciario)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        ) : conversaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'var(--superficie-hover)' }}
            >
              {ICONO_CANAL[tipoCanal]}
            </div>
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
              Sin conversaciones
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              No hay conversaciones activas en este canal.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {conversaciones.map((conv) => (
              <motion.button
                key={conv.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => onSeleccionar(conv.id)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{
                  background: seleccionada === conv.id
                    ? 'var(--superficie-seleccionada)'
                    : 'transparent',
                  borderBottom: '1px solid var(--borde-sutil)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-0.5">
                    <Avatar
                      nombre={conv.contacto_nombre || conv.identificador_externo || '?'}
                      tamano="sm"
                    />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{
                          color: conv.mensajes_sin_leer > 0
                            ? 'var(--texto-primario)'
                            : 'var(--texto-secundario)',
                        }}
                      >
                        {conv.contacto_nombre || conv.identificador_externo || 'Desconocido'}
                      </span>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {conv.ultimo_mensaje_en && (
                          <span className="text-xxs" style={{
                            color: conv.mensajes_sin_leer > 0
                              ? 'var(--insignia-exito)'
                              : 'var(--texto-terciario)',
                          }}>
                            {tiempoRelativo(conv.ultimo_mensaje_en)}
                          </span>
                        )}
                        {conv.mensajes_sin_leer > 0 && (
                          <span
                            className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{
                              background: 'var(--insignia-exito)',
                              color: '#fff',
                            }}
                          >
                            {conv.mensajes_sin_leer > 99 ? '99+' : conv.mensajes_sin_leer}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Asunto (correo) o último mensaje */}
                    {tipoCanal === 'correo' && conv.asunto && (
                      <p
                        className="text-xs font-medium truncate mt-0.5"
                        style={{ color: 'var(--texto-primario)' }}
                      >
                        {conv.asunto}
                      </p>
                    )}

                    <p
                      className="text-xs truncate mt-0.5"
                      style={{
                        color: conv.mensajes_sin_leer > 0
                          ? 'var(--texto-secundario)'
                          : 'var(--texto-terciario)',
                        fontWeight: conv.mensajes_sin_leer > 0 ? 500 : 400,
                      }}
                    >
                      {/* Indicador enviado/recibido */}
                      {conv.ultimo_mensaje_es_entrante === false && (
                        <span style={{ color: 'var(--texto-terciario)' }}>Tú: </span>
                      )}
                      {conv.ultimo_mensaje_texto || 'Sin mensajes'}
                    </p>

                    {/* Etiqueta de cuenta de correo */}
                    {tipoCanal === 'correo' && conv.canal?.nombre && (
                      <p
                        className="text-xxs truncate mt-0.5"
                        style={{ color: 'var(--canal-correo)' }}
                      >
                        {conv.canal.nombre}
                      </p>
                    )}

                    {/* Footer: estado + asignado */}
                    <div className="flex items-center gap-2 mt-1">
                      <Insignia color={COLOR_ESTADO[conv.estado] as 'exito' | 'advertencia' | 'neutro' | 'peligro'} tamano="sm">
                        {conv.estado.replace('_', ' ')}
                      </Insignia>
                      {conv.asignado_a_nombre && (
                        <span className="text-xxs flex items-center gap-1" style={{ color: 'var(--texto-terciario)' }}>
                          <User size={10} />
                          {conv.asignado_a_nombre.split(' ')[0]}
                        </span>
                      )}
                      {conv.tiempo_sin_respuesta_desde && (
                        <span className="text-xxs flex items-center gap-1" style={{ color: 'var(--insignia-advertencia)' }}>
                          <Clock size={10} />
                          {tiempoRelativo(conv.tiempo_sin_respuesta_desde)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
