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
import { GripVertical, Home, Flag, RotateCcw, Building2, MapPin, Check, X, Coffee, ArrowDown } from 'lucide-react'
import { type EstadoVisita, type Visita } from './TarjetaParada'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { formatearHora, type ResumenHorarios } from '@/lib/recorrido-horarios'

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
  // Timestamps del progreso de la parada (sólo se usan cuando tipo='parada';
  // para tipo='visita' los timestamps viven en `visita.fecha_*`).
  fecha_inicio?: string | null
  fecha_llegada?: string | null
  fecha_completada?: string | null
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
  /** Horarios estimados + km — calculados en el contenedor y pasados acá. */
  horarios?: ResumenHorarios
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

function ItemEdicion({
  parada,
  indice,
  horario,
  duracionSitio,
}: {
  parada: Parada
  indice: number
  horario?: { llegada: Date | null; tramo: { km: number; min: number; esEstimado: boolean } | null } | null
  duracionSitio: number
}) {
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
  const tramo = horario?.tramo
  const muestraTramo = tramo && (tramo.km > 0 || tramo.min > 0)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Tramo desde la parada anterior — solo se muestra si hay datos (>0) */}
      {muestraTramo && (
        <div className="flex items-center gap-2 pl-4 py-2 text-[11px] text-texto-terciario">
          <ArrowDown size={11} className="shrink-0 opacity-70" />
          <span>
            {tramo.km > 0 && <span className="font-medium text-texto-secundario">{tramo.km.toFixed(1)} km</span>}
            {tramo.km > 0 && tramo.min > 0 && <span className="mx-1.5">·</span>}
            {tramo.min > 0 && <span className="font-medium text-texto-secundario">{tramo.min} min</span>}
            {tramo.esEstimado && <span className="ml-2 opacity-60 italic">estimado</span>}
          </span>
        </div>
      )}

      {/* Item arrastrable — más aire interno que antes */}
      <div className="flex items-start gap-2 px-3 py-3 rounded-card border border-borde-sutil bg-superficie-tarjeta">
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center size-8 shrink-0 touch-none cursor-grab active:cursor-grabbing text-texto-terciario hover:text-texto-secundario mt-0.5"
          aria-label="Reordenar"
        >
          <GripVertical size={18} />
        </button>
        <span className="text-[11px] font-bold text-texto-terciario tabular-nums w-6 shrink-0 mt-1">
          {String(indice + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[14px] font-semibold text-texto-primario truncate">{titulo}</p>
              {esGenerica && (
                <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-texto-terciario">
                  parada
                </span>
              )}
            </div>
            {horario?.llegada && (
              <span className="text-[12px] font-medium text-texto-secundario tabular-nums shrink-0">
                ~{formatearHora(horario.llegada)}
              </span>
            )}
          </div>
          {subtitulo && (
            <p className="text-[12px] text-texto-terciario truncate mt-1 flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />
              {subtitulo}
            </p>
          )}
          <p className="text-[11px] text-texto-terciario mt-1.5">{duracionSitio} min en sitio</p>
        </div>
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
  modoEdicion,
  destinoFinal = 'ninguno',
  onCambiarDestino,
  horarios,
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
  // Al reordenar con drag & drop, el padre llama onReordenar → paradas se actualiza →
  // horarios se recalcula en el useMemo del padre → esta lista refleja las nuevas
  // horas estimadas y km entre paradas automáticamente.
  if (modoEdicion) {
    return (
      <div className="px-4 py-3 space-y-1">
        {/* Punto de partida */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-card border border-dashed border-borde-sutil">
          <div className="flex items-center justify-center size-8 rounded-full bg-texto-marca/15 shrink-0">
            <Home size={14} className="text-texto-marca" />
          </div>
          <p className="text-[13px] font-medium text-texto-secundario">{t('recorrido.punto_partida')}</p>
        </div>

        {/* Lista reordenable con tramos + horas estimadas */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={manejarDragEnd}>
          <SortableContext items={paradas.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {paradas.map((parada, indice) => {
              const esGenerica = parada.tipo === 'parada'
              const duracionSitio = esGenerica ? 10 : (parada.visita?.duracion_estimada_min ?? 30)
              const horario = horarios?.porParada[indice]
              return (
                <ItemEdicion
                  key={parada.id}
                  parada={parada}
                  indice={indice}
                  horario={horario ? { llegada: horario.llegada, tramo: horario.tramo } : null}
                  duracionSitio={duracionSitio}
                />
              )
            })}
          </SortableContext>
        </DndContext>

        {/* Destino final */}
        <PuntoFinalEdicion destino={destinoFinal} onCambiar={onCambiarDestino} />

        {/* Resumen del recorrido — total km y hora estimada de fin */}
        {horarios && paradas.length > 0 && (horarios.horaFin || horarios.kmTotal > 0) && (
          <div className="mt-4 pt-3 border-t border-borde-sutil flex items-center justify-between text-[12px]">
            <span className="text-texto-terciario">Fin estimado</span>
            <div className="flex items-center gap-2 text-texto-secundario">
              {horarios.horaFin && (
                <span className="font-semibold tabular-nums">~{formatearHora(horarios.horaFin)}</span>
              )}
              {horarios.kmTotal > 0 && (
                <>
                  <span className="text-texto-terciario">·</span>
                  <span className="font-medium">{horarios.kmTotal.toFixed(1)} km</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Modo normal — timeline informativo ───
  // Vista de sólo lectura: cada parada muestra hora estimada + estado, y entre
  // paradas hay un tramo con km/tiempo de viaje. Las acciones (cancelar, llegué,
  // etc.) se toman desde la tarjeta colapsada con las flechas — para no duplicar UI.
  return (
    <div className="px-4 py-3">
      {/* Nodo de origen */}
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col items-center shrink-0 w-8">
          <div className="flex items-center justify-center size-8 rounded-full bg-texto-marca/15 border border-texto-marca/30 shrink-0">
            <Home size={14} className="text-texto-marca" />
          </div>
        </div>
        <div className="flex-1 min-w-0 py-1.5">
          <p className="text-[13px] font-medium text-texto-secundario">{t('recorrido.punto_partida')}</p>
        </div>
      </div>

      {/* Paradas con tramos */}
      {paradas.map((parada, indice) => {
        const esGenerica = parada.tipo === 'parada'
        const v = parada.visita
        const titulo = esGenerica
          ? (parada.titulo || 'Parada')
          : (v?.contacto_nombre || v?.direccion_texto || 'Sin contacto')
        const direccionTexto = esGenerica
          ? (parada.direccion_texto || parada.motivo || null)
          : (v?.direccion_texto || null)
        const estado = (esGenerica ? (parada.estado || 'programada') : (v?.estado || 'programada')) as EstadoVisita
        const horario = horarios?.porParada[indice]
        const tramo = horario?.tramo
        const duracionSitio = esGenerica ? 10 : (v?.duracion_estimada_min ?? 30)
        const esActual = indice === paradaActualIndice
        const esSeleccionada = paradaSeleccionada === indice

        const colorEstado = estado === 'completada' ? 'var(--insignia-exito)'
          : estado === 'cancelada' ? 'var(--insignia-peligro)'
          : estado === 'en_camino' || estado === 'en_sitio' ? 'var(--insignia-info)'
          : esActual ? 'var(--insignia-info)' : 'var(--borde-fuerte)'

        // El tramo puede existir tanto para la primera parada (desde el origen/ubicación)
        // como para el resto (desde la anterior). Se calcula en el helper.
        const muestraTramo = tramo && (tramo.km > 0 || tramo.min > 0)

        return (
          <div key={parada.id}>
            {/* Tramo desde la anterior — línea punteada larga con distancia/tiempo en el medio.
                min-h-20 asegura que el espacio entre paradas sea claro (~80px). */}
            {muestraTramo ? (
              <div className="flex items-stretch gap-3 min-h-20 py-1">
                <div className="flex flex-col items-center shrink-0 w-8">
                  <div className="w-px flex-1 border-l-2 border-dashed border-borde-sutil/70" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2 text-[11px] text-texto-terciario">
                  <ArrowDown size={12} className="shrink-0 opacity-70" />
                  <span>
                    {tramo.km > 0 && <span className="font-medium text-texto-secundario">{tramo.km.toFixed(1)} km</span>}
                    {tramo.km > 0 && tramo.min > 0 && <span className="mx-1.5">·</span>}
                    {tramo.min > 0 && <span className="font-medium text-texto-secundario">{tramo.min} min</span>}
                    {tramo.esEstimado && (
                      <span className="ml-2 opacity-60 italic">estimado</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              // Sin datos de tramo (ej: primera parada sin origen/coords): igual
              // dibujamos una línea de conexión para que el timeline no quede cortado.
              indice === 0 && (
                <div className="flex items-stretch gap-3 min-h-12 py-1">
                  <div className="flex flex-col items-center shrink-0 w-8">
                    <div className="w-px flex-1 border-l-2 border-dashed border-borde-sutil/70" />
                  </div>
                  <div className="flex-1" />
                </div>
              )
            )}

            {/* Parada — tocable para seleccionar/deseleccionar */}
            <button
              onClick={() => onSeleccionarParada(esSeleccionada ? null : indice)}
              className={[
                'w-full flex items-stretch gap-3 text-left rounded-card py-3 px-1 transition-colors',
                esSeleccionada ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]',
                estado === 'cancelada' ? 'opacity-50' : '',
              ].join(' ')}
            >
              <div className="flex flex-col items-center shrink-0 w-8">
                {/* Nodo con estado — un poco más grande para mejor legibilidad en móvil */}
                <div
                  className="flex items-center justify-center size-8 rounded-full shrink-0 border-2 text-[12px] font-bold"
                  style={{
                    borderColor: colorEstado,
                    backgroundColor: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? colorEstado : 'transparent',
                    color: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? 'white' : 'var(--texto-terciario)',
                  }}
                >
                  {estado === 'completada' ? <Check size={14} strokeWidth={3} />
                    : estado === 'cancelada' ? <X size={14} strokeWidth={3} />
                    : esGenerica ? <Coffee size={14} />
                    : indice + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className={`text-[14px] font-semibold text-texto-primario truncate ${estado === 'cancelada' ? 'line-through' : ''}`}>
                      {titulo}
                    </p>
                    {esGenerica && (
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-texto-terciario">
                        parada
                      </span>
                    )}
                  </div>
                  {horario?.llegada && estado !== 'cancelada' && (
                    <span className="text-[12px] font-medium tabular-nums shrink-0" style={{ color: estado === 'completada' ? 'var(--insignia-exito)' : 'var(--texto-secundario)' }}>
                      {horario.esReal ? '' : '~'}{formatearHora(horario.llegada)}
                    </span>
                  )}
                </div>
                {direccionTexto && (
                  <p className="text-[12px] text-texto-terciario truncate mt-1 flex items-center gap-1">
                    <MapPin size={10} className="shrink-0" />
                    {direccionTexto}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                  <span className="text-texto-terciario">{duracionSitio} min en sitio</span>
                  {estado !== 'programada' && (
                    <>
                      <span className="text-texto-terciario">·</span>
                      <span className="font-medium" style={{ color: colorEstado }}>
                        {estado === 'en_camino' ? 'En camino'
                          : estado === 'en_sitio' ? 'En sitio'
                          : estado === 'completada' ? 'Completada'
                          : estado === 'cancelada' ? 'Cancelada'
                          : 'Reprogramada'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>
        )
      })}

      {/* Nodo de destino final (si aplica) */}
      {destinoFinal !== 'ninguno' && (
        <>
          <div className="flex items-stretch gap-3 min-h-12 py-1">
            <div className="flex flex-col items-center shrink-0 w-8">
              <div className="w-px flex-1 border-l-2 border-dashed border-borde-sutil/70" />
            </div>
            <div className="flex-1" />
          </div>
          <div className="flex items-stretch gap-3 py-1">
            <div className="flex flex-col items-center shrink-0 w-8">
              <div className="flex items-center justify-center size-8 rounded-full bg-[var(--insignia-info)]/15 border border-[var(--insignia-info)]/30 shrink-0">
                {destinoFinal === 'origen'
                  ? <RotateCcw size={14} className="text-[var(--insignia-info)]" />
                  : <Flag size={14} className="text-[var(--insignia-info)]" />
                }
              </div>
            </div>
            <div className="flex-1 min-w-0 py-1.5">
              <p className="text-[13px] font-medium text-texto-secundario">
                {destinoFinal === 'origen' ? 'Volver al inicio' : (typeof destinoFinal === 'object' ? destinoFinal.texto : '')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Resumen final del recorrido — totales de tiempo y distancia */}
      {horarios && paradas.length > 0 && (horarios.horaFin || horarios.kmTotal > 0) && (
        <div className="mt-5 pt-4 border-t border-borde-sutil flex items-center justify-between text-[12px]">
          <span className="text-texto-terciario">Fin estimado</span>
          <div className="flex items-center gap-2 text-texto-secundario">
            {horarios.horaFin && (
              <span className="font-semibold tabular-nums">~{formatearHora(horarios.horaFin)}</span>
            )}
            {horarios.kmTotal > 0 && (
              <>
                <span className="text-texto-terciario">·</span>
                <span className="font-medium">{horarios.kmTotal.toFixed(1)} km</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { ListaParadas, type Parada, type DestinoFinal }
