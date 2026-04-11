'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { MapPin, GripVertical, Route, Navigation, Inbox, Calendar } from 'lucide-react'
import { MapaRecorrido } from '@/componentes/mapa'
import type { PuntoMapa, RutaMapa } from '@/componentes/mapa'
import ConfigRecorrido, { type ConfigPermisos } from './ConfigRecorrido'

/**
 * TarjetaVisitador — Card tipo kanban para un visitador con sus visitas del día.
 * Soporta drag & drop: las visitas son sortables dentro y draggables entre columnas.
 */

// Tipos inline para evitar dependencia circular
interface VisitaPlanificacion {
  id: string
  contacto_nombre: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  estado: string
  prioridad: string
  duracion_estimada_min: number | null
  fecha_programada: string | null
  motivo: string | null
}

interface RecorridoResumen {
  id: string
  estado: string
  total_visitas: number | null
  visitas_completadas: number | null
  distancia_total_km: number | null
  duracion_total_min: number | null
  config: ConfigPermisos | null
}

interface Props {
  usuarioId: string
  nombre: string
  apellido: string
  avatarUrl: string | null
  visitas: VisitaPlanificacion[]
  recorrido: RecorridoResumen | null
  onOptimizarRuta: (usuarioId: string) => void
  onGuardarConfig: (recorridoId: string, config: ConfigPermisos) => Promise<void>
  optimizando?: boolean
  esSinAsignar?: boolean
}

// Colores por estado
type ColorInsignia = 'exito' | 'peligro' | 'advertencia' | 'info' | 'primario' | 'neutro'

const COLORES_ESTADO: Record<string, ColorInsignia> = {
  programada: 'advertencia',
  en_camino: 'exito',
  en_sitio: 'info',
  completada: 'exito',
  cancelada: 'peligro',
  reprogramada: 'advertencia',
}

const COLORES_PRIORIDAD: Record<string, ColorInsignia> = {
  urgente: 'peligro',
  alta: 'peligro',
  normal: 'neutro',
  baja: 'info',
}

// Componente sortable para cada visita dentro de la columna
function ItemVisitaSortable({ visita, indice }: { visita: VisitaPlanificacion; indice: number }) {
  const formato = useFormato()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: visita.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const horaFormateada = visita.fecha_programada ? formato.hora(visita.fecha_programada) : null
  const fechaCorta = visita.fecha_programada
    ? new Date(visita.fecha_programada).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : null

  const colorBorde = visita.prioridad === 'urgente' ? 'border-l-red-400'
    : visita.prioridad === 'alta' ? 'border-l-orange-400'
    : 'border-l-texto-marca/40'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border border-white/[0.06] border-l-2 ${colorBorde} bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-grab active:cursor-grabbing touch-none`}
      {...attributes}
      {...listeners}
    >
      {/* Ícono drag centrado arriba */}
      <div className="flex justify-center py-0.5 opacity-30">
        <GripVertical size={12} />
      </div>

      <div className="px-2.5 pb-2 space-y-1">
        {/* Nombre + número */}
        <div className="flex items-center gap-2">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-texto-marca/15 text-[9px] font-bold text-texto-marca">
            {indice + 1}
          </span>
          <span className="truncate text-[13px] font-medium text-texto-primario">
            {visita.contacto_nombre || 'Sin contacto'}
          </span>
        </div>

        {/* Fecha + hora + duración en una línea */}
        <div className="flex items-center gap-2 text-[11px] text-texto-terciario">
          {fechaCorta && (
            <span className="flex items-center gap-1">
              <Calendar size={9} className="shrink-0" />
              {fechaCorta}
            </span>
          )}
          {horaFormateada && <span>{horaFormateada}</span>}
          {visita.duracion_estimada_min && <span>· {visita.duracion_estimada_min}min</span>}
        </div>

        {/* Dirección (truncada) */}
        {visita.direccion_texto && (
          <div className="flex items-center gap-1">
            <MapPin size={9} className="shrink-0 text-texto-terciario" />
            <span className="truncate text-[11px] text-texto-terciario">{visita.direccion_texto}</span>
          </div>
        )}
      </div>

      {/* Navegar */}
      {visita.direccion_lat && visita.direccion_lng && (
        <button
          className="absolute top-1.5 right-1.5 rounded p-1 text-texto-terciario hover:bg-white/[0.08] hover:text-texto-primario transition-colors"
          onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${visita.direccion_lat},${visita.direccion_lng}`, '_blank') }}
          title="Navegar"
        >
          <Navigation size={11} />
        </button>
      )}
    </div>
  )
}

export default function TarjetaVisitador({
  usuarioId,
  nombre,
  apellido,
  avatarUrl,
  visitas,
  recorrido,
  onOptimizarRuta,
  onGuardarConfig,
  optimizando,
  esSinAsignar,
}: Props) {
  const { t } = useTraduccion()

  // Droppable zone para recibir visitas de otras columnas
  const { setNodeRef, isOver } = useDroppable({ id: usuarioId })

  const nombreCompleto = `${nombre} ${apellido}`.trim() || 'Sin nombre'

  const duracionTotal = useMemo(
    () => visitas.reduce((sum, v) => sum + (v.duracion_estimada_min || 0), 0),
    [visitas]
  )

  const idsVisitas = useMemo(() => visitas.map(v => v.id), [visitas])

  // Ruta para el mapa miniatura (visitas con geo, en orden)
  const rutaMapa = useMemo<RutaMapa | null>(() => {
    const puntos = visitas
      .filter(v => v.direccion_lat && v.direccion_lng)
      .map(v => ({
        id: v.id,
        lat: v.direccion_lat!,
        lng: v.direccion_lng!,
        titulo: v.contacto_nombre || 'Sin contacto',
        subtitulo: v.direccion_texto || undefined,
        estado: v.estado as PuntoMapa['estado'],
      }))
    if (puntos.length === 0) return null
    return {
      puntos,
      origen: { lat: puntos[0].lat, lng: puntos[0].lng, texto: 'Inicio' },
    }
  }, [visitas])

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl border bg-superficie-tarjeta transition-colors w-full md:min-w-[280px] md:max-w-[340px] max-h-[calc(100vh-220px)]
        ${isOver ? 'border-texto-marca/40 bg-texto-marca/5' : 'border-borde-sutil'}
      `}
    >
      {/* Header del visitador */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] p-3">
        {esSinAsignar ? (
          <div className="flex size-8 items-center justify-center rounded-full bg-insignia-advertencia/15">
            <Inbox size={14} className="text-insignia-advertencia" />
          </div>
        ) : (
          <Avatar nombre={nombreCompleto} foto={avatarUrl || undefined} tamano="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-texto-primario">{nombreCompleto}</p>
          <p className="text-[11px] text-texto-terciario">
            {visitas.length} {t('visitas.visitas_del_dia')}
            {duracionTotal > 0 && ` · ${Math.floor(duracionTotal / 60)}h ${duracionTotal % 60}m`}
          </p>
        </div>

        {/* Acciones del header — solo para visitadores reales */}
        {!esSinAsignar && (
          <div className="flex items-center gap-1">
            <Boton
              variante="fantasma"
              tamano="sm"
              soloIcono
              icono={<Route size={14} />}
              tooltip={t('visitas.optimizar_ruta')}
              onClick={() => onOptimizarRuta(usuarioId)}
              cargando={optimizando}
              disabled={visitas.length < 2}
            />
            <ConfigRecorrido
              recorridoId={recorrido?.id || null}
              configActual={recorrido?.config}
              nombreVisitador={nombreCompleto}
              onGuardar={(config) => onGuardarConfig(recorrido?.id || '', config)}
            />
          </div>
        )}
        {esSinAsignar && visitas.length > 0 && (
          <span className="rounded-full bg-insignia-advertencia/15 px-2 py-0.5 text-[11px] font-medium text-insignia-advertencia">
            {visitas.length}
          </span>
        )}
      </div>

      {/* Mapa miniatura con recorrido real */}
      {rutaMapa && (
        <div className="shrink-0 px-2 pt-2">
          <MapaRecorrido
            ruta={rutaMapa}
            className="h-[140px] rounded-lg overflow-hidden"
          />
        </div>
      )}

      {/* Barra de progreso del recorrido */}
      {recorrido && (recorrido.visitas_completadas || 0) > 0 && (
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between text-[11px] text-texto-terciario mb-1">
            <span>{recorrido.visitas_completadas}/{recorrido.total_visitas} completadas</span>
            {recorrido.distancia_total_km && (
              <span>{recorrido.distancia_total_km} km</span>
            )}
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-estado-completado transition-all"
              style={{ width: `${((recorrido.visitas_completadas || 0) / (recorrido.total_visitas || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista de visitas — sortable con scroll */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1.5">
        <SortableContext items={idsVisitas} strategy={verticalListSortingStrategy}>
          {visitas.map((visita, indice) => (
            <ItemVisitaSortable key={visita.id} visita={visita} indice={indice} />
          ))}
        </SortableContext>

        {visitas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            {esSinAsignar ? (
              <>
                <Inbox size={24} className="text-texto-terciario/50 mb-1.5" />
                <p className="text-xs text-texto-terciario">Todas las visitas están asignadas</p>
              </>
            ) : (
              <>
                <div className="mb-1.5 rounded-lg border-2 border-dashed border-borde-sutil p-3">
                  <MapPin size={20} className="text-texto-terciario/40" />
                </div>
                <p className="text-xs text-texto-terciario">Arrastrá visitas acá</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
