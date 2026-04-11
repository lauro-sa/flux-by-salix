'use client'

/**
 * ListaParadas — Lista vertical con línea de tiempo centrada.
 * Estructura: línea vertical centrada → nodos con números → cards debajo de cada nodo.
 * Modo edición: lista compacta con drag & drop.
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
import { useFormato } from '@/hooks/useFormato'

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
  onEditar: (visitaId: string) => void
  modoEdicion: boolean
  destinoFinal?: DestinoFinal
  onCambiarDestino?: (destino: DestinoFinal) => void
}

/* ─── Destino final (modo edición) ─── */

const OPCIONES_DESTINO: { valor: DestinoFinal; icono: typeof Flag; label: string }[] = [
  { valor: 'ninguno', icono: Flag, label: 'Sin destino' },
  { valor: 'origen', icono: RotateCcw, label: 'Volver al inicio' },
]

function PuntoFinalEdicion({
  destino,
  onCambiar,
}: {
  destino: DestinoFinal
  onCambiar?: (d: DestinoFinal) => void
}) {
  const esCustom = typeof destino === 'object'
  const textoDestino = destino === 'origen' ? 'Volver al inicio'
    : destino === 'ninguno' ? 'Sin destino final'
    : destino.texto

  const IconoDestino = destino === 'origen' ? RotateCcw
    : esCustom ? Building2
    : Flag

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-borde-sutil">
      <div className={[
        'flex items-center justify-center size-7 rounded-full shrink-0 border',
        destino === 'ninguno'
          ? 'bg-borde-sutil/20 border-borde-sutil'
          : 'bg-[var(--insignia-info)]/15 border-[var(--insignia-info)]/30',
      ].join(' ')}>
        <IconoDestino size={12} className={destino === 'ninguno' ? 'text-texto-terciario' : 'text-[var(--insignia-info)]'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${destino === 'ninguno' ? 'text-texto-terciario' : 'text-texto-primario'}`}>
          {textoDestino}
        </p>
        {esCustom && (
          <p className="text-xs text-texto-terciario mt-0.5 truncate flex items-center gap-1">
            <MapPin size={10} />
            {destino.texto}
          </p>
        )}
        {onCambiar && (
          <div className="flex gap-1.5 mt-2">
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
  )
}

/* ─── Item sortable (modo edición) ─── */

function ItemEdicion({ parada, indice }: { parada: Parada; indice: number }) {
  const formato = useFormato()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: parada.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center size-7 shrink-0 touch-none cursor-grab active:cursor-grabbing text-texto-terciario"
        aria-label="Reordenar"
      >
        <GripVertical size={16} />
      </button>
      <span className="text-xs font-bold text-texto-terciario w-6 shrink-0">
        {String(indice + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-texto-primario truncate">
          {parada.visita.contacto_nombre || parada.visita.direccion_texto}
        </p>
        {parada.visita.contacto_nombre && parada.visita.direccion_texto && (
          <p className="text-xs text-texto-terciario truncate">{parada.visita.direccion_texto}</p>
        )}
      </div>
      {parada.visita.fecha_programada && (
        <span className="text-xs text-texto-terciario tabular-nums shrink-0">
          {formato.hora(parada.visita.fecha_programada)}
        </span>
      )}
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
  onEditar,
  modoEdicion,
  destinoFinal = 'ninguno',
  onCambiarDestino,
}: PropiedadesListaParadas) {
  const { t } = useTraduccion()
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

  const hayEnCurso = paradas.some(p => p.visita?.estado === 'en_camino' || p.visita?.estado === 'en_sitio')

  // ─── Modo edición ───
  if (modoEdicion) {
    return (
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-borde-sutil">
          <div className="flex items-center justify-center size-7 rounded-full bg-texto-marca/15 shrink-0">
            <Home size={12} className="text-texto-marca" />
          </div>
          <p className="text-sm font-medium text-texto-terciario">{t('recorrido.punto_partida')}</p>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={manejarDragEnd}>
          <SortableContext items={paradas.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {paradas.map((parada, indice) => (
              <ItemEdicion key={parada.id} parada={parada} indice={indice} />
            ))}
          </SortableContext>
        </DndContext>
        <PuntoFinalEdicion destino={destinoFinal} onCambiar={onCambiarDestino} />
      </div>
    )
  }

  // ─── Modo normal — línea de tiempo vertical centrada ───
  return (
    <div className="px-4 py-2">
      {/* Nodo de origen */}
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center size-8 rounded-full bg-texto-marca/15 border border-texto-marca/30">
          <Home size={14} className="text-texto-marca" />
        </div>
        <div className="w-px h-2" style={{ backgroundColor: 'var(--borde-sutil)' }} />
      </div>

      {/* Paradas */}
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
          onEditar={onEditar}
          esUltima={indice === paradas.length - 1 && destinoFinal === 'ninguno'}
          otraEnCurso={hayEnCurso}
        />
      ))}

      {/* Nodo de destino */}
      {destinoFinal !== 'ninguno' && (
        <div className="flex flex-col items-center">
          <div className="w-px h-5" style={{ backgroundColor: 'var(--borde-sutil)' }} />
          <div className="flex items-center justify-center size-8 rounded-full bg-[var(--insignia-info)]/15 border border-[var(--insignia-info)]/30">
            {destinoFinal === 'origen'
              ? <RotateCcw size={14} className="text-[var(--insignia-info)]" />
              : <Flag size={14} className="text-[var(--insignia-info)]" />
            }
          </div>
          <p className="text-xs text-texto-terciario mt-1.5">
            {destinoFinal === 'origen' ? 'Volver al inicio' : (typeof destinoFinal === 'object' ? destinoFinal.texto : '')}
          </p>
        </div>
      )}
    </div>
  )
}

export { ListaParadas, type Parada, type DestinoFinal }
