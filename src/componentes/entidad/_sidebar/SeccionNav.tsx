'use client'

/**
 * SeccionNav — Renderiza una seccion de navegacion con items reordenables via drag-and-drop.
 * Se usa para las secciones principal, documentos, admin y otros del Sidebar.
 */

import { DndContext, closestCenter, type DragEndEvent, type SensorDescriptor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ItemSortable } from './ItemSortable'
import type { ItemNav } from './tipos'

interface PropiedadesSeccionNav {
  seccionId: string
  etiqueta: string
  items: ItemNav[]
  colapsado: boolean
  sensors: SensorDescriptor<object>[]
  /** Ruta actual para determinar item activo */
  esActivo: (ruta: string) => boolean
  animandoSalida: string | null
  menuItemId: string | null
  menuPos: { top: number; left: number }
  onDragEnd: (event: DragEndEvent) => void
  onNavegar: (ruta: string) => void
  onAbrirMenu: (itemId: string, triggerEl: HTMLElement) => void
  onCerrarMenu: () => void
  onOcultar: (id: string) => void
  onDeshabilitar: (id: string) => void
}

function SeccionNav({
  seccionId,
  etiqueta,
  items,
  colapsado,
  sensors,
  esActivo,
  animandoSalida,
  menuItemId,
  menuPos,
  onDragEnd,
  onNavegar,
  onAbrirMenu,
  onCerrarMenu,
  onOcultar,
  onDeshabilitar,
}: PropiedadesSeccionNav) {
  if (items.length === 0) return null

  return (
    <div className="mt-4 first:mt-0">
      {/* Mismo alto en ambos estados: titulo visible o linea centrada */}
      <div className="px-2 mb-1.5 text-xxs font-semibold uppercase tracking-wider flex items-center" style={{ minHeight: '1rem' }}>
        {colapsado
          ? <div className="h-px bg-borde-sutil w-full" />
          : <span className="sidebar-texto-fade text-texto-secundario/60">{etiqueta}</span>
        }
      </div>
      <DndContext id={`sidebar-dnd-${seccionId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-px">
            {items.map(i => (
              <ItemSortable
                key={i.id}
                item={i}
                sortable={true}
                colapsado={colapsado}
                activo={esActivo(i.ruta)}
                animandoSalida={animandoSalida === i.id}
                menuAbierto={menuItemId === i.id}
                menuPos={menuPos}
                onNavegar={() => onNavegar(i.ruta)}
                onAbrirMenu={onAbrirMenu}
                onCerrarMenu={onCerrarMenu}
                onOcultar={onOcultar}
                onDeshabilitar={onDeshabilitar}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export { SeccionNav }
