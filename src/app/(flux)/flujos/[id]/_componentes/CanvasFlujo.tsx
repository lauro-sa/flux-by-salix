'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TarjetaDisparador from './TarjetaDisparador'
import TarjetaPaso from './TarjetaPaso'
import TarjetaCondicionBranch from './TarjetaCondicionBranch'
import { BotonAgregarPasoIntermedio, BotonAgregarPasoFinal } from './BotonAgregarPaso'
import type { AccionConId } from '@/lib/workflows/ids-pasos'
import type { AccionWorkflow, TipoDisparador } from '@/tipos/workflow'

/**
 * Canvas vertical centrado del editor visual de flujos (sub-PR 19.2).
 *
 *   • Max-width 720px en desktop, sin max en mobile (D12 del plan).
 *   • Disparador como primera tarjeta (no draggable).
 *   • SortableContext raíz con verticalListSortingStrategy.
 *   • "+" intermedios entre pasos (visible al hover del canvas).
 *   • "+ Agregar paso" fijo abajo.
 *   • Branches: SortableContext anidado por rama (sin cross-rama, D6).
 *
 * El canvas solo gestiona LAYOUT y DND. La lógica de mutación
 * (insertar/reordenar/seleccionar) se delega al padre `EditorFlujo`
 * vía callbacks — esa pieza es la que llama a `useEditorFlujo.actualizar`.
 */

interface DisparadorRaw {
  tipo?: TipoDisparador
  configuracion?: Record<string, unknown>
}

interface Props {
  disparador: DisparadorRaw | null
  pasosRaiz: AccionConId[]
  pasoSeleccionadoId: string | null
  disparadorSeleccionado: boolean
  soloLectura: boolean
  onSeleccionarDisparador: () => void
  onSeleccionarPaso: (id: string) => void
  /** Click en el card placeholder de disparador (cuando no hay uno). */
  onElegirDisparador: () => void
  /** Reordenar el array raíz tras drag end. */
  onReordenarRaiz: (pasos: AccionConId[]) => void
  /** Insertar un paso nuevo en el array raíz, en `posicion`. */
  onAgregarRaiz: (posicion: number) => void
  /** Insertar un paso nuevo en una rama de un branch específico. */
  onAgregarEnRama: (branchId: string, rama: 'si' | 'no', posicion: number) => void
  /** Reordenar dentro de una rama de un branch específico. */
  onReordenarRama: (branchId: string, rama: 'si' | 'no', pasos: AccionConId[]) => void
  /** Ícono custom del flujo (de la columna `flujos.icono`). */
  iconoCustom: string | null
}

export default function CanvasFlujo({
  disparador,
  pasosRaiz,
  pasoSeleccionadoId,
  disparadorSeleccionado,
  soloLectura,
  onSeleccionarDisparador,
  onSeleccionarPaso,
  onElegirDisparador,
  onReordenarRaiz,
  onAgregarRaiz,
  onAgregarEnRama,
  onReordenarRama,
  iconoCustom,
}: Props) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEndRaiz(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = pasosRaiz.findIndex((p) => p.id === active.id)
    const newIdx = pasosRaiz.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = [...pasosRaiz]
    const [movido] = next.splice(oldIdx, 1)
    next.splice(newIdx, 0, movido)
    onReordenarRaiz(next)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-none md:max-w-[720px] px-3 sm:px-6 py-6 group/canvas">
        <div className="flex flex-col gap-1.5">
          {/* Disparador siempre primero, no draggable */}
          <TarjetaDisparador
            disparador={disparador as DisparadorRaw | null}
            seleccionado={disparadorSeleccionado}
            soloLectura={soloLectura}
            onSeleccionar={onSeleccionarDisparador}
            onElegirDisparador={onElegirDisparador}
            iconoCustom={iconoCustom}
          />

          {/* Pasos raíz con dnd */}
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={handleDragEndRaiz}>
            <SortableContext items={pasosRaiz.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {pasosRaiz.map((p, idx) => (
                  <div key={p.id}>
                    {/* "+" intermedio antes de cada paso (excepto del primero,
                        cuya posición de inserción "0" se cubre con el botón
                        intermedio entre disparador y primer paso solo si
                        idx >= 1). Diseño consistente con plan §1.6.5. */}
                    {!soloLectura && idx > 0 && (
                      <BotonAgregarPasoIntermedio onClick={() => onAgregarRaiz(idx)} posicion={idx} />
                    )}
                    {p.tipo === 'condicion_branch' ? (
                      <TarjetaCondicionBranch
                        paso={p as AccionConId & { tipo: 'condicion_branch' }}
                        pasosSiConId={((p as unknown as { acciones_si?: AccionConId[] }).acciones_si) ?? []}
                        pasosNoConId={((p as unknown as { acciones_no?: AccionConId[] }).acciones_no) ?? []}
                        seleccionada={pasoSeleccionadoId === p.id}
                        pasoSeleccionadoId={pasoSeleccionadoId}
                        soloLectura={soloLectura}
                        onSeleccionar={() => onSeleccionarPaso(p.id)}
                        onSeleccionarHijo={onSeleccionarPaso}
                        onAgregarEnRama={(rama, pos) => onAgregarEnRama(p.id, rama, pos)}
                        onReordenarRamaSi={(pasos) => onReordenarRama(p.id, 'si', pasos)}
                        onReordenarRamaNo={(pasos) => onReordenarRama(p.id, 'no', pasos)}
                      />
                    ) : (
                      <TarjetaPaso
                        paso={p}
                        seleccionada={pasoSeleccionadoId === p.id}
                        soloLectura={soloLectura}
                        onSeleccionar={() => onSeleccionarPaso(p.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Botón final */}
          {!soloLectura && (
            <BotonAgregarPasoFinal onClick={() => onAgregarRaiz(pasosRaiz.length)} />
          )}
        </div>
      </div>
    </div>
  )
}
