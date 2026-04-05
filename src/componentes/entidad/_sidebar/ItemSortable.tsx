'use client'

/**
 * ItemSortable — Item de navegacion individual del Sidebar.
 * Soporta drag-and-drop, badges, menu contextual y tooltips en modo colapsado.
 */

import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MoreHorizontal, MinusCircle, BellOff, Trash2 } from 'lucide-react'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { useTraduccion } from '@/lib/i18n'
import type { ItemNav } from './tipos'
import { GripIcon } from './iconos'

interface PropiedadesItemSortable {
  item: ItemNav
  sortable: boolean
  colapsado: boolean
  activo: boolean
  animandoSalida: boolean
  menuAbierto: boolean
  menuPos: { top: number; left: number }
  onNavegar: () => void
  onAbrirMenu: (itemId: string, triggerEl: HTMLElement) => void
  onCerrarMenu: () => void
  onOcultar: (id: string) => void
  onDeshabilitar: (id: string) => void
}

function ItemSortable({
  item,
  sortable: esSortable,
  colapsado,
  activo,
  animandoSalida,
  menuAbierto,
  menuPos,
  onNavegar,
  onAbrirMenu,
  onCerrarMenu,
  onOcultar,
  onDeshabilitar,
}: PropiedadesItemSortable) {
  const { t } = useTraduccion()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !esSortable,
  })

  const estiloSortable: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={estiloSortable} className={`relative group ${isDragging ? 'shadow-lg rounded-md bg-superficie-elevada' : ''} ${animandoSalida ? 'sidebar-item-puff' : ''}`}>
      {/* Item principal — div clickeable en vez de Link */}
      <div
        onClick={onNavegar}
        style={{ color: activo ? 'var(--texto-primario)' : 'var(--texto-secundario)' }}
        className={[
          'flex items-center rounded-md text-sm font-medium cursor-pointer transition-all duration-100 relative select-none',
          colapsado ? 'justify-center py-2.5 mx-auto w-10' : 'px-2 py-2.5 pr-7',
          activo ? 'font-semibold bg-superficie-activa' : 'hover:bg-superficie-hover',
        ].join(' ')}
      >
        {/* Zona izquierda: badge / grip */}
        {esSortable && !colapsado && (
          <span className="shrink-0 w-5 h-5 flex items-center justify-center mr-1.5 rounded-full" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            {item.badge != null && item.badge > 0 ? (<>
              <span className="group-hover:hidden flex items-center justify-center"><span className="size-2 rounded-full bg-texto-marca" /></span>
              <span className="hidden group-hover:flex items-center justify-center cursor-grab text-texto-terciario/50"><GripIcon /></span>
            </>) : (
              <span className="hidden group-hover:flex items-center justify-center cursor-grab text-texto-terciario/40"><GripIcon /></span>
            )}
          </span>
        )}

        <span className={`shrink-0 flex ${colapsado ? '' : 'mr-2.5'}`}>{item.icono}</span>
        {!colapsado && <span className="flex-1 truncate sidebar-texto-fade">{item.etiqueta}</span>}

        {colapsado && item.badge != null && item.badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-texto-marca" />
        )}
        {colapsado && (
          <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-superficie-elevada border border-borde-sutil shadow-md text-sm text-texto-primario whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">{item.etiqueta}</div>
        )}
      </div>

      {/* Boton 3 puntos */}
      {!item.fijo && !colapsado && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onAbrirMenu(item.id, e.currentTarget)
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded-md cursor-pointer opacity-0 group-hover:opacity-100 group-active:opacity-100 hover:bg-superficie-activa active:bg-superficie-activa flex items-center justify-center transition-opacity z-30"
          style={{ color: 'var(--texto-terciario)' }}
        >
          <MoreHorizontal size={13} />
        </div>
      )}

      {/* Menu contextual como portal — overlay cierra, menu con acciones */}
      {menuAbierto && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9998]" onClick={onCerrarMenu}>
          <div
            className="absolute bg-superficie-elevada border border-borde-sutil rounded-md shadow-lg py-1 w-44"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <OpcionMenu icono={<MinusCircle size={14} />} onClick={() => onOcultar(item.id)}>{t('sidebar.ocultar')}</OpcionMenu>
            <OpcionMenu icono={<BellOff size={14} />} onClick={() => onDeshabilitar(item.id)}>{t('sidebar.deshabilitar')}</OpcionMenu>
            <div className="h-px bg-borde-sutil my-1" />
            <OpcionMenu icono={<Trash2 size={14} />} peligro onClick={() => {}}>{t('sidebar.desinstalar')}</OpcionMenu>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export { ItemSortable }
