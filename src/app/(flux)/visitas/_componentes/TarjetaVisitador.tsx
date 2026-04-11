'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { MapPin, GripVertical, Clock, Route, Navigation, Inbox } from 'lucide-react'
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
  const { t } = useTraduccion()
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
    opacity: isDragging ? 0.5 : 1,
  }

  const horaEstimada = visita.fecha_programada
    ? new Date(visita.fecha_programada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2.5 hover:bg-white/[0.06] transition-colors"
    >
      {/* Handle de drag */}
      <button
        className="mt-0.5 cursor-grab text-texto-terciario opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {/* Número de orden */}
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-texto-marca/15 text-[10px] font-bold text-texto-marca">
        {indice + 1}
      </span>

      {/* Info de la visita */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-texto-primario">
            {visita.contacto_nombre || 'Sin contacto'}
          </span>
          <Insignia color={COLORES_PRIORIDAD[visita.prioridad] || 'neutro'} tamano="sm">
            {visita.prioridad}
          </Insignia>
        </div>

        {visita.direccion_texto && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="shrink-0 text-texto-terciario" />
            <span className="truncate text-xs text-texto-terciario">{visita.direccion_texto}</span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          {horaEstimada && (
            <span className="flex items-center gap-1 text-[11px] text-texto-terciario">
              <Clock size={10} />
              {horaEstimada}
            </span>
          )}
          {visita.duracion_estimada_min && (
            <span className="text-[11px] text-texto-terciario">
              {visita.duracion_estimada_min} min
            </span>
          )}
          <Insignia color={COLORES_ESTADO[visita.estado] || 'neutro'} tamano="sm">
            {t(`visitas.estados.${visita.estado}` as 'visitas.estados.programada')}
          </Insignia>
        </div>
      </div>

      {/* Botón navegar */}
      {visita.direccion_lat && visita.direccion_lng && (
        <button
          className="mt-0.5 shrink-0 rounded p-1 text-texto-terciario hover:bg-white/[0.06] hover:text-texto-primario transition-colors"
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${visita.direccion_lat},${visita.direccion_lng}`, '_blank')}
          title={t('recorrido.abrir_navegacion')}
        >
          <Navigation size={12} />
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
