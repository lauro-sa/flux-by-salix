'use client'

import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, CheckCheck, Trash2 } from 'lucide-react'

/**
 * PanelNotificaciones — Panel genérico para mostrar listas de notificaciones
 * dentro de un Popover. Reutilizable para cualquier tipo de notificación.
 * Incluye: cabecera con título + acciones, lista con scroll, pie opcional.
 * Se usa en: Header (3 popovers de notificaciones), y cualquier panel similar.
 */

/* ─── Tipos ─── */

export interface ItemNotificacion {
  id: string
  /** Ícono o avatar a la izquierda */
  icono?: ReactNode
  /** Título principal */
  titulo: string
  /** Descripción corta debajo del título */
  descripcion?: string
  /** Timestamp formateado ("hace 2 min", "14:30", etc.) */
  tiempo?: string
  /** Si fue leída */
  leida?: boolean
  /** Insignia o etiqueta extra a la derecha */
  insignia?: ReactNode
  /** Callback al hacer click en el item */
  onClick?: () => void
  /** Datos extra que el consumidor puede usar */
  datos?: Record<string, unknown>
}

interface PropiedadesPanelNotificaciones {
  /** Título del panel (ej: "Inbox", "Actividades", "Notificaciones") */
  titulo: string
  /** Ícono junto al título */
  iconoTitulo?: ReactNode
  /** Lista de notificaciones a mostrar */
  items: ItemNotificacion[]
  /** Callback para marcar todas como leídas */
  onMarcarTodasLeidas?: () => void
  /** Callback para descartar un item */
  onDescartar?: (id: string) => void
  /** Contenido del pie (ej: link "Ver todo en Inbox →") */
  pie?: ReactNode
  /** Texto cuando no hay notificaciones */
  textoVacio?: string
  /** Ícono cuando no hay notificaciones */
  iconoVacio?: ReactNode
  /** Cantidad total de no leídas (para mostrar en cabecera) */
  noLeidas?: number
  /** Está cargando */
  cargando?: boolean
  /** Alto máximo de la lista (con scroll) */
  altoMaximoLista?: string
}

function PanelNotificaciones({
  titulo,
  iconoTitulo,
  items,
  onMarcarTodasLeidas,
  onDescartar,
  pie,
  textoVacio = 'Sin notificaciones',
  iconoVacio,
  noLeidas = 0,
  cargando = false,
  altoMaximoLista = '420px',
}: PropiedadesPanelNotificaciones) {

  return (
    <div className="flex flex-col">
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <div className="flex items-center gap-2">
          {iconoTitulo}
          <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>
          {noLeidas > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xxs font-bold bg-texto-marca text-white">
              {noLeidas > 99 ? '99+' : noLeidas}
            </span>
          )}
        </div>
        {onMarcarTodasLeidas && noLeidas > 0 && (
          <button
            onClick={onMarcarTodasLeidas}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover border-none bg-transparent cursor-pointer transition-colors"
            title="Marcar todas como leídas"
          >
            <CheckCheck size={14} />
            <span className="hidden sm:inline">Marcar leídas</span>
          </button>
        )}
      </div>

      {/* ── Lista con scroll ── */}
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: altoMaximoLista }}
      >
        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-5 border-2 border-texto-terciario/30 border-t-texto-marca rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-texto-terciario">
            {iconoVacio}
            <p className="text-sm">{textoVacio}</p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
              >
                <div
                  onClick={item.onClick}
                  className={[
                    'group flex items-start gap-3 px-4 py-3 border-b border-borde-sutil/50 transition-colors relative',
                    item.onClick ? 'cursor-pointer hover:bg-superficie-hover' : '',
                    !item.leida ? 'bg-superficie-seleccionada/30' : '',
                  ].join(' ')}
                >
                  {/* Punto de no leída */}
                  {!item.leida && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-texto-marca" />
                  )}

                  {/* Ícono */}
                  {item.icono && (
                    <div className="shrink-0 mt-0.5">
                      {item.icono}
                    </div>
                  )}

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!item.leida ? 'font-semibold text-texto-primario' : 'font-medium text-texto-secundario'}`}>
                        {item.titulo}
                      </p>
                      {item.tiempo && (
                        <span className="text-xxs text-texto-terciario whitespace-nowrap shrink-0 mt-0.5">
                          {item.tiempo}
                        </span>
                      )}
                    </div>
                    {item.descripcion && (
                      <p className="text-xs text-texto-terciario mt-0.5 line-clamp-2">
                        {item.descripcion}
                      </p>
                    )}
                    {item.insignia && (
                      <div className="mt-1.5">
                        {item.insignia}
                      </div>
                    )}
                  </div>

                  {/* Botón descartar (aparece en hover) */}
                  {onDescartar && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDescartar(item.id) }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-7 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-all mt-0.5"
                      title="Descartar"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Pie ── */}
      {pie && (
        <div className="border-t border-borde-sutil px-4 py-2.5 shrink-0">
          {pie}
        </div>
      )}
    </div>
  )
}

export { PanelNotificaciones }
export type { PropiedadesPanelNotificaciones }
