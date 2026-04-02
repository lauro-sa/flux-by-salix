'use client'

import { type ReactNode, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, CheckCheck, Trash2 } from 'lucide-react'
import { Tooltip } from '@/componentes/ui/Tooltip'

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
  /** Sub-items (para grupos expandibles al mantener hover 1.5s) */
  subItems?: ItemNotificacion[]
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

/* ─── Componente de fila con expansión por hover sostenido ─── */

const HOVER_DELAY_MS = 1500

function FilaNotificacion({ item, onDescartar, expandido }: {
  item: ItemNotificacion
  onDescartar?: (id: string) => void
  expandido: boolean
}) {
  const tieneSubItems = item.subItems && item.subItems.length > 1

  return (
    <div>
      {/* Fila principal */}
      <div
        onClick={item.onClick}
        className={[
          'group flex items-start gap-3 px-4 py-3 border-b border-borde-sutil/50 transition-colors relative',
          item.onClick ? 'cursor-pointer hover:bg-superficie-hover' : '',
          !item.leida ? 'bg-superficie-seleccionada/30' : '',
        ].join(' ')}
      >
        {!item.leida && (
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-texto-marca" />
        )}
        {item.icono && <div className="shrink-0 mt-0.5">{item.icono}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm truncate ${!item.leida ? 'font-semibold text-texto-primario' : 'font-medium text-texto-secundario'}`}>
              {item.titulo}
            </p>
            {item.tiempo && (
              <span className="text-xxs text-texto-terciario whitespace-nowrap shrink-0 mt-0.5">{item.tiempo}</span>
            )}
          </div>
          {item.descripcion && (
            <p className="text-xs text-texto-terciario mt-0.5 line-clamp-2">{item.descripcion}</p>
          )}
          {item.insignia && <div className="mt-1.5">{item.insignia}</div>}
        </div>
        {onDescartar && (
          <Tooltip contenido="Descartar">
            <button
              onClick={(e) => { e.stopPropagation(); onDescartar(item.id) }}
              className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-7 rounded-lg bg-transparent hover:bg-superficie-hover border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-all mt-0.5"
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Sub-items expandidos con CSS transition */}
      {tieneSubItems && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: expandido ? `${item.subItems!.length * 52}px` : '0px', opacity: expandido ? 1 : 0 }}
        >
          {item.subItems!.map((sub) => (
            <div
              key={sub.id}
              onClick={sub.onClick}
              className="flex items-start gap-3 pl-11 pr-4 py-2 border-b border-borde-sutil/30 cursor-pointer hover:bg-superficie-hover/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-texto-secundario truncate">{sub.titulo}</p>
                {sub.descripcion && (
                  <p className="text-xxs text-texto-terciario mt-0.5 truncate">{sub.descripcion}</p>
                )}
              </div>
              {sub.tiempo && (
                <span className="text-xxs text-texto-terciario shrink-0">{sub.tiempo}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemsConExpansion({ items, onDescartar }: { items: ItemNotificacion[]; onDescartar?: (id: string) => void }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback((itemId: string, tieneSubItems: boolean) => {
    if (!tieneSubItems) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExpandidoId(itemId), HOVER_DELAY_MS)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setExpandidoId(null)
  }, [])

  return (
    <>
      {items.map((item) => {
        const tieneSubItems = !!(item.subItems && item.subItems.length > 1)
        return (
          <div
            key={item.id}
            onMouseEnter={() => handleMouseEnter(item.id, tieneSubItems)}
            onMouseLeave={handleMouseLeave}
          >
            <FilaNotificacion
              item={item}
              onDescartar={onDescartar}
              expandido={expandidoId === item.id}
            />
          </div>
        )
      })}
    </>
  )
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
          <Tooltip contenido="Marcar todas como leídas">
            <button
              onClick={onMarcarTodasLeidas}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover border-none bg-transparent cursor-pointer transition-colors"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Marcar leídas</span>
            </button>
          </Tooltip>
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
          <ItemsConExpansion items={items} onDescartar={onDescartar} />
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
