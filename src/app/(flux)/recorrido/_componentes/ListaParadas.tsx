'use client'

/**
 * ListaParadas — Lista en formato timeline estilo Spoke.
 * Incluye punto de partida, paradas numeradas, destino final y modo edición con drag & drop.
 * Se usa en: PaginaRecorrido dentro del sheet inferior.
 */

import { useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Home, Flag, RotateCcw, Building2, MapPin } from 'lucide-react'
import { TarjetaParada, type EstadoVisita, type Visita } from './TarjetaParada'
import { useTraduccion } from '@/lib/i18n'

interface Parada {
  id: string
  orden: number
  visita: Visita
  distancia_km: number | null
  duracion_viaje_min: number | null
}

type DestinoFinal = 'origen' | 'ninguno' | { lat: number; lng: number; texto: string }

interface PropiedadesListaParadas {
  paradas: Parada[]
  paradaActualIndice: number
  paradaSeleccionada: number | null
  onSeleccionarParada: (indice: number | null) => void
  onReordenar: (paradasReordenadas: Parada[]) => void
  onCambiarEstado: (visitaId: string, estado: EstadoVisita) => void
  onRegistrar: (visitaId: string) => void
  modoEdicion: boolean
  destinoFinal?: DestinoFinal
  onCambiarDestino?: (destino: DestinoFinal) => void
}

/* ─── Punto de partida (primer item del timeline) ─── */

function PuntoPartida() {
  const { t } = useTraduccion()

  return (
    <div className="flex gap-0">
      <div className="flex flex-col items-center w-12 shrink-0">
        <div className="flex items-center justify-center size-7 rounded-full bg-texto-marca/20 border-2 border-texto-marca shrink-0">
          <Home size={12} className="text-texto-marca" />
        </div>
        <div className="w-px flex-1 min-h-[16px] bg-borde-sutil" />
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="p-3 -mt-1">
          <p className="text-sm font-semibold text-texto-primario">{t('recorrido.punto_partida')}</p>
          <p className="text-xs text-texto-terciario mt-0.5">{t('recorrido.mi_ubicacion')}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Punto final del recorrido ─── */

const OPCIONES_DESTINO: { valor: DestinoFinal; icono: typeof Flag; label: string; descripcion: string }[] = [
  { valor: 'ninguno', icono: Flag, label: 'Sin destino', descripcion: 'Terminar en la última parada' },
  { valor: 'origen', icono: RotateCcw, label: 'Volver al inicio', descripcion: 'Ruta circular al punto de partida' },
]

function PuntoFinal({
  destino,
  onCambiar,
  editable,
}: {
  destino: DestinoFinal
  onCambiar?: (d: DestinoFinal) => void
  editable: boolean
}) {
  const esCustom = typeof destino === 'object'
  const textoDestino = destino === 'origen' ? 'Volver al inicio'
    : destino === 'ninguno' ? 'Sin destino final'
    : destino.texto

  const IconoDestino = destino === 'origen' ? RotateCcw
    : esCustom ? Building2
    : Flag

  return (
    <div className="flex gap-0">
      <div className="flex flex-col items-center w-12 shrink-0">
        <div className={[
          'flex items-center justify-center size-7 rounded-full shrink-0 border-2',
          destino === 'ninguno'
            ? 'bg-borde-sutil/30 border-borde-sutil'
            : 'bg-[var(--insignia-info)]/20 border-[var(--insignia-info)]',
        ].join(' ')}>
          <IconoDestino size={12} className={destino === 'ninguno' ? 'text-texto-terciario' : 'text-[var(--insignia-info)]'} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="p-3 -mt-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${destino === 'ninguno' ? 'text-texto-terciario' : 'text-texto-primario'}`}>
                {textoDestino}
              </p>
              {esCustom && (
                <p className="text-xs text-texto-terciario mt-0.5 truncate flex items-center gap-1">
                  <MapPin size={10} />
                  {destino.texto}
                </p>
              )}
            </div>
          </div>

          {/* Selector de destino (solo en modo edición) */}
          {editable && onCambiar && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {OPCIONES_DESTINO.map(op => {
                const Icono = op.icono
                const activo = destino === op.valor
                return (
                  <button
                    key={String(op.valor)}
                    onClick={() => onCambiar(op.valor)}
                    className={[
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      activo
                        ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-marca'
                        : 'border-borde-sutil text-texto-terciario hover:bg-superficie-elevada',
                    ].join(' ')}
                  >
                    <Icono size={12} />
                    <span>{op.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Item sortable (modo edición) ─── */

function ParadaSortable({
  parada,
  indice,
  esActual,
  esUltima,
  onCambiarEstado,
  onRegistrar,
}: {
  parada: Parada
  indice: number
  esActual: boolean
  esUltima: boolean
  onCambiarEstado: (visitaId: string, estado: EstadoVisita) => void
  onRegistrar: (visitaId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: parada.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-0">
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center size-8 mt-2 shrink-0 touch-none cursor-grab active:cursor-grabbing text-texto-terciario hover:text-texto-secundario"
        aria-label="Reordenar"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <TarjetaParada
          orden={indice + 1}
          visita={parada.visita}
          esActual={esActual}
          seleccionada={false}
          onSeleccionar={() => {}}
          onCambiarEstado={onCambiarEstado}
          onRegistrar={onRegistrar}
          esUltima={esUltima}
          otraEnCurso={false}
        />
      </div>
    </div>
  )
}

/* ─── Lista principal ─── */

function ListaParadas({
  paradas,
  paradaActualIndice,
  paradaSeleccionada,
  onSeleccionarParada,
  onReordenar,
  onCambiarEstado,
  onRegistrar,
  modoEdicion,
  destinoFinal = 'ninguno',
  onCambiarDestino,
}: PropiedadesListaParadas) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const manejarDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const indiceViejo = paradas.findIndex(p => p.id === active.id)
    const indiceNuevo = paradas.findIndex(p => p.id === over.id)
    if (indiceViejo === -1 || indiceNuevo === -1) return

    const reordenadas = arrayMove(paradas, indiceViejo, indiceNuevo).map((p, i) => ({
      ...p,
      orden: i + 1,
    }))
    onReordenar(reordenadas)
  }, [paradas, onReordenar])

  // Modo edición con drag & drop
  if (modoEdicion) {
    return (
      <div className="px-2 py-3">
        <PuntoPartida />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={manejarDragEnd}>
          <SortableContext items={paradas.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {paradas.map((parada, indice) => (
              <ParadaSortable
                key={parada.id}
                parada={parada}
                indice={indice}
                esActual={indice === paradaActualIndice}
                esUltima={indice === paradas.length - 1 && destinoFinal === 'ninguno'}
                onCambiarEstado={onCambiarEstado}
                onRegistrar={onRegistrar}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Destino final editable */}
        <PuntoFinal destino={destinoFinal} onCambiar={onCambiarDestino} editable />
      </div>
    )
  }

  // ¿Hay alguna parada en camino o en sitio? → bloquear las demás
  const hayEnCurso = paradas.some(p => p.visita?.estado === 'en_camino' || p.visita?.estado === 'en_sitio')

  // Modo normal — timeline estilo Spoke
  return (
    <div className="px-3 py-3">
      <PuntoPartida />

      {paradas.map((parada, indice) => (
        <TarjetaParada
          key={parada.id}
          orden={indice + 1}
          visita={parada.visita}
          esActual={indice === paradaActualIndice}
          seleccionada={paradaSeleccionada === indice}
          onSeleccionar={() => onSeleccionarParada(paradaSeleccionada === indice ? null : indice)}
          onCambiarEstado={onCambiarEstado}
          onRegistrar={onRegistrar}
          esUltima={indice === paradas.length - 1 && destinoFinal === 'ninguno'}
          otraEnCurso={hayEnCurso}
        />
      ))}

      {/* Destino final (solo se muestra si no es 'ninguno') */}
      {destinoFinal !== 'ninguno' && (
        <PuntoFinal destino={destinoFinal} editable={false} />
      )}
    </div>
  )
}

export { ListaParadas, type Parada, type DestinoFinal }
