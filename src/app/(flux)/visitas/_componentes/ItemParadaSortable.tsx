'use client'

/**
 * ItemParadaSortable — Tarjeta sortable de una parada dentro de ModalRecorrido.
 *
 * Soporta dos tipos de parada:
 *  - tipo='visita': Visita real a un contacto (datos tomados de `parada.visita`).
 *  - tipo='parada': Parada genérica (café, combustible, etc.) — usa los campos propios
 *    de `parada.titulo`/`motivo`/`direccion_texto`/`contacto_nombre` y su propio estado.
 *
 * Drag & drop con @dnd-kit.
 * Se usa en: ModalRecorrido.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MapPin, Navigation, Clock, Trash2, Coffee } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

// ── Tipos exportados ──

export interface VisitaParada {
  id: string
  contacto_nombre: string
  contacto_telefono: string | null
  direccion_texto: string
  direccion_lat: number | null
  direccion_lng: number | null
  estado: string
  motivo: string | null
  prioridad: string | null
  fecha_programada: string | null
  duracion_estimada_min: number | null
}

export interface Parada {
  id: string
  orden: number
  tipo: 'visita' | 'parada'
  // Presente solo si tipo='visita'
  visita: VisitaParada | null
  // Campos propios de paradas genéricas
  titulo?: string | null
  motivo?: string | null
  direccion_texto?: string | null
  direccion_lat?: number | null
  direccion_lng?: number | null
  contacto_nombre?: string | null
  estado?: string | null // estado propio (tipo='parada')
  distancia_km: number | null
  duracion_viaje_min: number | null
}

// ── Colores de estado ──

const colorEstado: Record<string, string> = {
  programada: 'bg-insignia-advertencia/15 text-insignia-advertencia',
  en_camino: 'bg-insignia-exito/15 text-insignia-exito',
  en_sitio: 'bg-insignia-info/15 text-insignia-info',
  completada: 'bg-insignia-exito/15 text-insignia-exito',
  cancelada: 'bg-insignia-peligro/15 text-insignia-peligro',
}

// ── Componente ──

interface Props {
  parada: Parada
  indice: number
  onQuitar?: (paradaId: string) => void
}

export function ItemParadaSortable({ parada, indice, onQuitar }: Props) {
  const formato = useFormato()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: parada.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // Normalizar campos según el tipo (misma UI para ambos)
  const esParadaGenerica = parada.tipo === 'parada'
  const v = parada.visita
  const tituloPrincipal = esParadaGenerica
    ? (parada.titulo || 'Parada')
    : (v?.contacto_nombre || 'Sin contacto')
  const subtitulo = esParadaGenerica
    ? (parada.motivo || parada.contacto_nombre || null)
    : null
  const direccion = esParadaGenerica
    ? (parada.direccion_texto || null)
    : v?.direccion_texto || null
  const lat = esParadaGenerica ? parada.direccion_lat : v?.direccion_lat
  const lng = esParadaGenerica ? parada.direccion_lng : v?.direccion_lng
  const estado = esParadaGenerica
    ? (parada.estado || 'programada')
    : (v?.estado || 'programada')
  const horaFormateada = !esParadaGenerica && v?.fecha_programada ? formato.hora(v.fecha_programada) : null
  const duracionEstimada = esParadaGenerica ? null : v?.duracion_estimada_min

  const colorBorde = esParadaGenerica
    ? 'border-l-texto-terciario/40'
    : v?.prioridad === 'urgente' ? 'border-l-insignia-peligro'
    : v?.prioridad === 'alta' ? 'border-l-insignia-advertencia'
    : 'border-l-texto-marca/40'

  const esCompletada = estado === 'completada'
  const esActiva = estado === 'en_camino' || estado === 'en_sitio'
  const esCancelada = estado === 'cancelada'

  const colorNumero = esCompletada ? 'bg-insignia-exito/20 text-insignia-exito'
    : esActiva ? 'bg-texto-marca text-white'
    : esCancelada ? 'bg-insignia-peligro/15 text-insignia-peligro'
    : esParadaGenerica ? 'bg-white/[0.06] text-texto-terciario'
    : 'bg-texto-marca/15 text-texto-marca'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-card border border-l-2 transition-colors ${
        esCompletada ? 'border-white/[0.04] bg-white/[0.01] opacity-60' :
        esActiva ? 'border-texto-marca/30 bg-texto-marca/5' :
        'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
      } ${colorBorde} ${esCompletada || esCancelada ? '' : 'cursor-grab active:cursor-grabbing'}`}
      {...(esCompletada || esCancelada ? {} : attributes)}
      {...(esCompletada || esCancelada ? {} : listeners)}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Drag handle + número/icono */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          {!esCompletada && !esCancelada && (
            <GripVertical size={12} className="text-texto-terciario/50" />
          )}
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${colorNumero}`}>
            {esCompletada ? '✓' : esParadaGenerica ? <Coffee size={10} /> : indice + 1}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[13px] font-medium ${esCompletada ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
              {tituloPrincipal}
            </span>
            {esParadaGenerica && (
              <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-texto-terciario">
                parada
              </span>
            )}
            {!esParadaGenerica && estado !== 'programada' && (
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorEstado[estado] || colorEstado.programada}`}>
                {estado.replace('_', ' ')}
              </span>
            )}
            {esParadaGenerica && estado !== 'programada' && (
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorEstado[estado] || colorEstado.programada}`}>
                {estado.replace('_', ' ')}
              </span>
            )}
          </div>

          {subtitulo && (
            <p className="text-[11px] text-texto-terciario leading-tight line-clamp-1">{subtitulo}</p>
          )}

          {direccion && (
            <div className="flex items-start gap-1">
              <MapPin size={10} className="shrink-0 text-texto-terciario mt-0.5" />
              <span className="text-[11px] text-texto-terciario leading-tight line-clamp-1">{direccion}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-texto-terciario">
            {horaFormateada && (
              <span className="flex items-center gap-1">
                <Clock size={9} />
                {horaFormateada}
              </span>
            )}
            {duracionEstimada && <span>· {duracionEstimada} min</span>}
            {parada.distancia_km != null && parada.distancia_km > 0 && (
              <span>· {parada.distancia_km.toFixed(1)} km</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-0.5 shrink-0">
          {lat && lng && (
            <button
              className="rounded p-1.5 text-texto-terciario hover:bg-white/[0.08] hover:text-texto-primario transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
              }}
              title="Navegar"
            >
              <Navigation size={12} />
            </button>
          )}
          {onQuitar && !esCompletada && !esActiva && (
            <button
              className="rounded p-1.5 text-texto-terciario hover:bg-insignia-peligro/15 hover:text-insignia-peligro transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onQuitar(parada.id)
              }}
              title={esParadaGenerica ? 'Eliminar parada' : 'Quitar del recorrido'}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
