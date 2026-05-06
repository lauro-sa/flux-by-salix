'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import { ChevronDown, ChevronRight, GitBranch, GripVertical } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import TarjetaPaso from './TarjetaPaso'
import { BotonAgregarPasoIntermedio, BotonAgregarPasoFinal } from './BotonAgregarPaso'
import type { AccionWorkflow } from '@/tipos/workflow'

/**
 * Tarjeta de un paso `condicion_branch` (§1.6.4 del plan):
 * sub-flujos colapsables verticales con sangría visual.
 *
 *   ┌─────────────────────────────┐
 *   │ [icono] Si condición X     │  ← header de la tarjeta
 *   │   ▼ Si SÍ → 2 pasos         │  ← rama plegable
 *   │     [paso 1]                │
 *   │     [paso 2]                │
 *   │   ▶ Si NO → vacío           │  ← otra rama plegable
 *   └─────────────────────────────┘
 *
 * dnd-kit (D6 del plan): cada rama es un `SortableContext`
 * independiente, NO se permite drag cross-rama. La tarjeta de branch
 * en sí también es draggable dentro de su rama padre.
 *
 * El `id` que recibe es del paso branch (estable a nivel del array
 * padre); los hijos `acciones_si` y `acciones_no` traen sus propios
 * IDs derivados por el caller.
 */

type PasoConId = AccionWorkflow & { id: string }

interface Props {
  paso: PasoConId & { tipo: 'condicion_branch' }
  /** IDs de los pasos hijo, alineados con `paso.acciones_si` y `_no`. */
  pasosSiConId: PasoConId[]
  pasosNoConId: PasoConId[]
  seleccionada: boolean
  pasoSeleccionadoId: string | null
  soloLectura: boolean
  onSeleccionar: () => void
  onSeleccionarHijo: (id: string) => void
  /** Reordenar pasos dentro de la rama `si`. */
  onReordenarRamaSi: (pasos: PasoConId[]) => void
  /** Reordenar pasos dentro de la rama `no`. */
  onReordenarRamaNo: (pasos: PasoConId[]) => void
  /** Insertar un paso nuevo en una rama. `posicion` es el índice donde
   *  debe quedar el nuevo (0 = primero). */
  onAgregarEnRama: (rama: 'si' | 'no', posicion: number) => void
}

export default function TarjetaCondicionBranch({
  paso,
  pasosSiConId,
  pasosNoConId,
  seleccionada,
  pasoSeleccionadoId,
  soloLectura,
  onSeleccionar,
  onSeleccionarHijo,
  onReordenarRamaSi,
  onReordenarRamaNo,
  onAgregarEnRama,
}: Props) {
  const { t } = useTraduccion()
  const [siAbierta, setSiAbierta] = useState(true)
  const [noAbierta, setNoAbierta] = useState(true)

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: paso.id,
    disabled: soloLectura,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col rounded-card border bg-superficie-tarjeta transition-colors ${
        seleccionada
          ? 'border-texto-marca shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]'
          : 'border-borde-sutil hover:border-borde-fuerte'
      }`}
    >
      {/* Header de la tarjeta */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onSeleccionar}
          className="flex-1 flex items-center gap-3 px-3 py-3 text-left min-w-0 cursor-pointer rounded-tl-card"
        >
          <span
            className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/10 text-texto-marca"
            aria-hidden="true"
          >
            <GitBranch size={16} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-texto-primario truncate">
              {t('flujos.paso.condicion_branch.titulo')}
            </p>
            <p className="text-xs text-texto-terciario truncate mt-0.5">
              {t('flujos.editor.branch.resumen')
                .replace('{{si}}', String(pasosSiConId.length))
                .replace('{{no}}', String(pasosNoConId.length))}
            </p>
          </div>
        </button>
        {!soloLectura && (
          <div
            {...attributes}
            {...listeners}
            aria-label={t('flujos.editor.drag_handle')}
            className="shrink-0 flex items-center justify-center w-9 sm:w-7 cursor-grab active:cursor-grabbing text-texto-terciario hover:text-texto-secundario rounded-tr-card touch-target select-none"
          >
            <GripVertical size={14} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Rama Si */}
      <RamaCollapsable
        abierta={siAbierta}
        onToggle={() => setSiAbierta((x) => !x)}
        etiqueta={t('flujos.editor.branch.rama_si')}
        pasos={pasosSiConId}
        seleccionId={pasoSeleccionadoId}
        soloLectura={soloLectura}
        onSeleccionar={onSeleccionarHijo}
        onReordenar={onReordenarRamaSi}
        onAgregar={(pos) => onAgregarEnRama('si', pos)}
      />

      {/* Rama No */}
      <RamaCollapsable
        abierta={noAbierta}
        onToggle={() => setNoAbierta((x) => !x)}
        etiqueta={t('flujos.editor.branch.rama_no')}
        pasos={pasosNoConId}
        seleccionId={pasoSeleccionadoId}
        soloLectura={soloLectura}
        onSeleccionar={onSeleccionarHijo}
        onReordenar={onReordenarRamaNo}
        onAgregar={(pos) => onAgregarEnRama('no', pos)}
        sinBordeInferior
      />
    </div>
  )
}

interface PropsRama {
  abierta: boolean
  onToggle: () => void
  etiqueta: string
  pasos: PasoConId[]
  seleccionId: string | null
  soloLectura: boolean
  onSeleccionar: (id: string) => void
  onReordenar: (pasos: PasoConId[]) => void
  onAgregar: (pos: number) => void
  sinBordeInferior?: boolean
}

function RamaCollapsable({
  abierta,
  onToggle,
  etiqueta,
  pasos,
  seleccionId,
  soloLectura,
  onSeleccionar,
  onReordenar,
  onAgregar,
  sinBordeInferior,
}: PropsRama) {
  const { t } = useTraduccion()
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = pasos.findIndex((p) => p.id === active.id)
    const newIdx = pasos.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = [...pasos]
    const [movido] = next.splice(oldIdx, 1)
    next.splice(newIdx, 0, movido)
    onReordenar(next)
  }

  return (
    <div className={`border-t border-borde-sutil ${sinBordeInferior ? '' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left cursor-pointer hover:bg-superficie-hover transition-colors"
      >
        {abierta ? (
          <ChevronDown size={12} className="text-texto-terciario" aria-hidden="true" />
        ) : (
          <ChevronRight size={12} className="text-texto-terciario" aria-hidden="true" />
        )}
        <span className="text-[11px] font-semibold tracking-wider uppercase text-texto-terciario">
          {etiqueta}
        </span>
        <span className="text-[11px] text-texto-terciario ml-auto">
          {pasos.length === 0
            ? t('flujos.editor.branch.rama_vacia')
            : t('flujos.editor.branch.rama_count').replace('{{n}}', String(pasos.length))}
        </span>
      </button>
      {abierta && (
        <div
          // Sangría visual de las acciones de la rama (memoria patrón
          // "código indentado" del plan §1.6.4).
          className="pl-6 pr-3 pb-3 group/canvas"
        >
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pasos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {pasos.map((p, idx) => (
                  <div key={p.id}>
                    {idx > 0 && !soloLectura && (
                      <BotonAgregarPasoIntermedio onClick={() => onAgregar(idx)} posicion={idx} />
                    )}
                    <TarjetaPaso
                      paso={p}
                      seleccionada={seleccionId === p.id}
                      soloLectura={soloLectura}
                      onSeleccionar={() => onSeleccionar(p.id)}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!soloLectura && (
            <div className="mt-2">
              <BotonAgregarPasoFinal onClick={() => onAgregar(pasos.length)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
