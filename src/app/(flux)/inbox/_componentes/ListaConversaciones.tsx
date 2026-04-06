'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Buscador } from '@/componentes/ui/Buscador'
import { Pildora } from '@/componentes/ui/Pildora'
import {
  Mail, Hash, Clock, User, Filter, Trash2,
  ChevronDown, ChevronLeft, ChevronRight as ChevronRightIcon,
  Circle, Square, CheckSquare,
  Tag, CheckCircle, Eye, EyeOff,
  MoreVertical, Pin, BellOff,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { MenuConversacion } from './MenuConversacion'
import { useTraduccion } from '@/lib/i18n'
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
  /** Habilita selección múltiple con checkboxes */
  seleccionMultiple?: boolean
  onEliminarSeleccion?: (ids: string[]) => void
  // Filtros avanzados
  filtroEtiqueta?: string
  onFiltroEtiqueta?: (etiqueta: string) => void
  // Operaciones masivas
  onOperacionMasiva?: (accion: 'marcar_leido' | 'marcar_no_leido' | 'cerrar' | 'asignar', ids: string[]) => void
  // Filtro no leídos
  soloNoLeidos?: boolean
  onToggleNoLeidos?: () => void
  // Menú contextual
  onAccionMenu?: (accion: string, conversacionId: string, datos?: unknown) => void
  esAdmin?: boolean
}

// Iconos de canal
const ICONO_CANAL: Record<TipoCanal, React.ReactNode> = {
  whatsapp: <IconoWhatsApp size={14} />,
  correo: <Mail size={14} />,
  interno: <Hash size={14} />,
}

// Colores de estado
const COLOR_ESTADO: Record<EstadoConversacion, string> = {
  abierta: 'exito',
  en_espera: 'advertencia',
  resuelta: 'neutro',
  spam: 'peligro',
  snooze: 'info',
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
  onEliminarSeleccion,
  filtroEtiqueta,
  onFiltroEtiqueta,
  onOperacionMasiva,
  soloNoLeidos,
  onToggleNoLeidos,
  onAccionMenu,
  esAdmin = false,
}: PropiedadesListaConversaciones) {
  const { t } = useTraduccion()
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Estado del menú contextual
  const [menuConv, setMenuConv] = useState<{
    conv: ConversacionConDetalles
    pos: { x: number; y: number } | null
  } | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 50

  // Resetear página cuando cambian las conversaciones
  useEffect(() => { setPagina(1) }, [conversaciones.length])

  const totalPaginas = Math.max(1, Math.ceil(conversaciones.length / POR_PAGINA))
  const conversacionesPaginadas = conversaciones.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const desde = (pagina - 1) * POR_PAGINA + 1
  const hasta = Math.min(pagina * POR_PAGINA, conversaciones.length)

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const seleccionarTodos = useCallback(() => {
    if (seleccionados.size === conversaciones.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(conversaciones.map(c => c.id)))
    }
  }, [conversaciones, seleccionados.size])

  const handleEliminarSeleccion = useCallback(() => {
    if (seleccionados.size === 0 || !onEliminarSeleccion) return
    onEliminarSeleccion([...seleccionados])
    setSeleccionados(new Set())
    setModoSeleccion(false)
  }, [seleccionados, onEliminarSeleccion])

  const estados: { clave: EstadoConversacion | 'todas'; etiqueta: string }[] = [
    { clave: 'todas', etiqueta: t('inbox.todas') },
    { clave: 'abierta', etiqueta: t('inbox.abiertas') },
    { clave: 'en_espera', etiqueta: t('inbox.en_espera') },
    { clave: 'resuelta', etiqueta: t('inbox.resueltas') },
    { clave: 'spam', etiqueta: t('inbox.spam') },
  ]

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid var(--borde-sutil)' }}>
      {/* Header con búsqueda */}
      <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
        {/* Barra de selección masiva */}
        {modoSeleccion ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Seleccionar todos" onClick={seleccionarTodos} aria-label="Seleccionar todos" icono={
                seleccionados.size === conversaciones.length && conversaciones.length > 0
                  ? <CheckSquare size={14} style={{ color: 'var(--texto-marca)' }} />
                  : <Square size={14} style={{ color: 'var(--texto-terciario)' }} />
              } />
              <span className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {seleccionados.size > 0 && onEliminarSeleccion && (
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo="Eliminar"
                  icono={<Trash2 size={14} />}
                  onClick={handleEliminarSeleccion}
                  className="text-[var(--insignia-peligro)]"
                />
              )}
              <Boton
                variante="fantasma"
                tamano="xs"
                onClick={() => { setModoSeleccion(false); setSeleccionados(new Set()) }}
              >
                {t('comun.cancelar')}
              </Boton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {ICONO_CANAL[tipoCanal]}
              <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                {t('inbox.conversaciones')}
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
            <div className="flex items-center gap-1">
              {onToggleNoLeidos && (
                <Boton
                  variante={soloNoLeidos ? 'primario' : 'secundario'}
                  tamano="xs"
                  icono={<Circle size={8} fill={soloNoLeidos ? 'currentColor' : 'none'} />}
                  onClick={onToggleNoLeidos}
                  titulo={soloNoLeidos ? 'Mostrar todos' : 'Solo no leídos'}
                  style={{
                    color: soloNoLeidos ? 'var(--insignia-exito-texto, var(--texto-marca))' : 'var(--texto-terciario)',
                    background: soloNoLeidos ? 'var(--insignia-exito-fondo, var(--superficie-seleccionada))' : 'transparent',
                    border: soloNoLeidos ? 'none' : '1px solid var(--borde-sutil)',
                  }}
                >
                  No leídos
                </Boton>
              )}
              {onEliminarSeleccion && (
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<CheckSquare size={14} />}
                  onClick={() => setModoSeleccion(true)}
                  titulo="Seleccionar"
                />
              )}
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<Filter size={14} />}
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
              />
            </div>
          </div>
        )}

        <Buscador
          valor={busqueda}
          onChange={onBusqueda}
          placeholder={`Buscar entre ${conversaciones.length} correo${conversaciones.length !== 1 ? 's' : ''}...`}
        />

        {/* Paginador */}
        {conversaciones.length > POR_PAGINA && (
          <div className="flex items-center justify-between">
            <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {desde}–{hasta} de {conversaciones.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<ChevronLeft size={14} />}
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                titulo="Página anterior"
              />
              <span className="text-xxs px-1" style={{ color: 'var(--texto-secundario)' }}>
                {pagina}/{totalPaginas}
              </span>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<ChevronRightIcon size={14} />}
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                titulo="Página siguiente"
              />
            </div>
          </div>
        )}

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
                  onClick={() => onFiltroEstado(e.clave as EstadoConversacion | 'todas')}
                >
                  {e.etiqueta}
                </Pildora>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filtro de etiqueta activo */}
        {filtroEtiqueta && (
          <div className="flex items-center gap-1">
            <span
              className="text-xxs px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
              onClick={() => onFiltroEtiqueta?.('')}
            >
              <Tag size={9} />
              {filtroEtiqueta}
              <span style={{ color: 'var(--texto-terciario)' }}>×</span>
            </span>
          </div>
        )}
      </div>

      {/* Barra de operaciones masivas */}
      <AnimatePresence>
        {modoSeleccion && seleccionados.size > 0 && onOperacionMasiva && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-1 px-3 py-1.5 overflow-hidden"
            style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-hover)' }}
          >
            <Boton
              variante="secundario"
              tamano="xs"
              icono={<Eye size={10} />}
              onClick={() => { onOperacionMasiva('marcar_leido', [...seleccionados]); setSeleccionados(new Set()); setModoSeleccion(false) }}
            >
              {t('inbox.marcar_leido')}
            </Boton>
            <Boton
              variante="secundario"
              tamano="xs"
              icono={<EyeOff size={10} />}
              onClick={() => { onOperacionMasiva('marcar_no_leido', [...seleccionados]); setSeleccionados(new Set()); setModoSeleccion(false) }}
            >
              {t('inbox.marcar_no_leido')}
            </Boton>
            <Boton
              variante="secundario"
              tamano="xs"
              icono={<CheckCircle size={10} />}
              onClick={() => { onOperacionMasiva('cerrar', [...seleccionados]); setSeleccionados(new Set()); setModoSeleccion(false) }}
            >
              Cerrar
            </Boton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de conversaciones */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
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
              {t('inbox.sin_conversaciones')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              {t('inbox.sin_conversaciones_desc')}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {conversacionesPaginadas.map((conv) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => onSeleccionar(conv.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenuConv({ conv, pos: { x: e.clientX, y: e.clientY } })
                }}
                className="w-full text-left px-3 py-2.5 transition-colors group relative cursor-pointer"
                style={{
                  background: seleccionada === conv.id
                    ? 'var(--superficie-seleccionada)'
                    : 'transparent',
                  borderBottom: '1px solid var(--borde-sutil)',
                }}
              >
                {/* Botón 3 puntos para mobile/hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuConv({ conv, pos: null })
                  }}
                  className="absolute top-3 right-2 size-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 max-md:opacity-60 transition-opacity hover:bg-[var(--superficie-hover)] cursor-pointer"
                  style={{ color: 'var(--texto-terciario)', background: 'transparent', border: 'none', zIndex: 1 }}
                  aria-label="Más opciones"
                >
                  <MoreVertical size={16} />
                </button>
                <div className="flex items-start gap-3">
                  {/* Checkbox en modo selección */}
                  {modoSeleccion && (
                    <div
                      role="checkbox"
                      aria-checked={seleccionados.has(conv.id)}
                      onClick={(e) => { e.stopPropagation(); toggleSeleccion(conv.id) }}
                      className="flex-shrink-0 mt-2 cursor-pointer"
                    >
                      {seleccionados.has(conv.id)
                        ? <CheckSquare size={18} style={{ color: 'var(--texto-marca)' }} />
                        : <Square size={18} style={{ color: 'var(--texto-terciario)' }} />
                      }
                    </div>
                  )}
                  {/* Avatar más grande con badge de canal */}
                  {!modoSeleccion && (
                  <div className="flex-shrink-0 relative">
                    <Avatar
                      nombre={conv.contacto_nombre || conv.identificador_externo || '?'}
                      tamano="md"
                    />
                    {tipoCanal === 'whatsapp' && (
                      <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full flex items-center justify-center" style={{ background: '#25D366' }}>
                        <IconoWhatsApp size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  )}

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    {/* Fila 1: Nombre + badges + fecha */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-semibold truncate flex-1 min-w-0"
                        style={{
                          color: conv.mensajes_sin_leer > 0
                            ? 'var(--texto-primario)'
                            : 'var(--texto-secundario)',
                        }}
                      >
                        {conv.contacto_nombre || conv.identificador_externo || 'Desconocido'}
                      </span>
                      {conv._fijada && <Pin size={11} style={{ color: 'var(--texto-terciario)', flexShrink: 0 }} />}
                      {conv._silenciada && <BellOff size={11} style={{ color: 'var(--texto-terciario)', flexShrink: 0 }} />}
                      {conv.contacto?.es_provisorio && (
                        <span className="text-xxs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'var(--insignia-advertencia-fondo)', color: 'var(--insignia-advertencia-texto)' }}>
                          Lead
                        </span>
                      )}
                      {conv.ultimo_mensaje_en && (
                        <span className="text-xxs flex-shrink-0 ml-auto" style={{
                          color: conv.mensajes_sin_leer > 0 ? 'var(--insignia-exito)' : 'var(--texto-terciario)',
                          fontWeight: conv.mensajes_sin_leer > 0 ? 600 : 400,
                        }}>
                          {tiempoRelativo(conv.ultimo_mensaje_en)}
                        </span>
                      )}
                      {conv.mensajes_sin_leer > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: 'var(--insignia-exito)', color: 'var(--texto-inverso)' }}>
                          {conv.mensajes_sin_leer > 99 ? '99+' : conv.mensajes_sin_leer}
                        </span>
                      )}
                    </div>

                    {/* Fila 2: Número/identificador */}
                    {conv.identificador_externo && conv.contacto_nombre && (
                      <p className="text-xxs truncate mt-0.5" style={{ color: 'var(--texto-terciario)' }}>
                        {conv.identificador_externo}
                      </p>
                    )}

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

                    {/* Etiquetas de la conversación */}
                    {conv.etiquetas && conv.etiquetas.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {conv.etiquetas.slice(0, 3).map((et) => (
                          <span
                            key={et}
                            className="text-xxs px-1 py-0 rounded cursor-pointer"
                            style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
                            onClick={(e) => { e.stopPropagation(); onFiltroEtiqueta?.(et) }}
                          >
                            {et}
                          </span>
                        ))}
                        {conv.etiquetas.length > 3 && (
                          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                            +{conv.etiquetas.length - 3}
                          </span>
                        )}
                      </div>
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

                    {/* Badges de estado */}
                    {(conv.etapa_etiqueta || conv.sector_nombre || conv.chatbot_activo || conv.agente_ia_activo) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {conv.etapa_etiqueta && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${conv.etapa_color || '#6b7280'}18`,
                              color: conv.etapa_color || '#6b7280',
                            }}
                          >
                            {conv.etapa_etiqueta}
                          </span>
                        )}
                        {conv.sector_nombre && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${conv.sector_color || '#6366f1'}18`,
                              color: conv.sector_color || '#6366f1',
                            }}
                          >
                            {conv.sector_nombre}
                          </span>
                        )}
                        {conv.chatbot_activo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            Bot
                          </span>
                        )}
                        {conv.agente_ia_activo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-600 dark:text-violet-400">
                            IA
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Menú contextual de conversación */}
      {menuConv && (
        <MenuConversacion
          conversacion={menuConv.conv}
          posicion={menuConv.pos}
          abierto
          onCerrar={() => setMenuConv(null)}
          onAccion={(accion, datos) => {
            onAccionMenu?.(accion, menuConv.conv.id, datos)
            setMenuConv(null)
          }}
          esAdmin={esAdmin}
          estaFijada={!!menuConv.conv._fijada}
          estaSilenciada={!!menuConv.conv._silenciada}
        />
      )}
    </div>
  )
}
