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
  tipo: 'visita' | 'parada'
  // tipo='visita' trae la visita asociada
  visita: Visita | null
  // Campos propios de paradas genéricas (tipo='parada')
  titulo?: string | null
  motivo?: string | null
  direccion_texto?: string | null
  direccion_lat?: number | null
  direccion_lng?: number | null
  contacto_nombre?: string | null
  estado?: string | null
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
  /** Cambia el estado de la parada. Recibe parada_id (universal para visita/parada). */
  onCambiarEstado: (paradaId: string, estado: EstadoVisita) => void
  /** Solo aplica a paradas tipo 'visita'. Recibe visita_id (legacy). */
  onRegistrar: (visitaId: string) => void
  /** Solo aplica a paradas tipo 'visita'. Recibe visita_id (legacy). */
  onEditar: (visitaId: string) => void
  /** Eliminar una parada (tipo 'parada') del recorrido. */
  onQuitarParada?: (paradaId: string) => void
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
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-card border border-dashed border-borde-sutil">
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
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium border transition-colors',
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

  const esGenerica = parada.tipo === 'parada'
  const titulo = esGenerica
    ? (parada.titulo || 'Parada')
    : (parada.visita?.contacto_nombre || parada.visita?.direccion_texto || 'Sin contacto')
  const subtitulo = esGenerica
    ? (parada.motivo || parada.direccion_texto || null)
    : (parada.visita?.contacto_nombre && parada.visita?.direccion_texto ? parada.visita.direccion_texto : null)
  const hora = !esGenerica && parada.visita?.fecha_programada
    ? formato.hora(parada.visita.fecha_programada)
    : null

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2.5 rounded-card border border-borde-sutil bg-superficie-tarjeta">
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
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-texto-primario truncate">{titulo}</p>
          {esGenerica && (
            <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-texto-terciario">
              parada
            </span>
          )}
        </div>
        {subtitulo && (
          <p className="text-xs text-texto-terciario truncate">{subtitulo}</p>
        )}
      </div>
      {hora && (
        <span className="text-xs text-texto-terciario tabular-nums shrink-0">
          {hora}
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
  onQuitarParada,
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

  // Estado efectivo (visita o parada genérica)
  const estadoDe = (p: Parada): string => p.tipo === 'parada' ? (p.estado || 'programada') : (p.visita?.estado || 'programada')
  const hayEnCurso = paradas.some(p => ['en_camino', 'en_sitio'].includes(estadoDe(p)))

  // ─── Modo edición ───
  if (modoEdicion) {
    return (
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-card border border-dashed border-borde-sutil">
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
          parada={parada}
          esActual={indice === paradaActualIndice}
          seleccionada={paradaSeleccionada === indice}
          onSeleccionar={() => onSeleccionarParada(paradaSeleccionada === indice ? null : indice)}
          onCambiarEstado={onCambiarEstado}
          onRegistrar={onRegistrar}
          onEditar={onEditar}
          onQuitar={onQuitarParada}
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
