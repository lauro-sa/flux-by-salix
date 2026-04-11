'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { MapPin, GripVertical, Clock, Route, Navigation } from 'lucide-react'
import { MapaVisitas } from '@/componentes/mapa'
import type { PuntoMapa } from '@/componentes/mapa'
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

  // Puntos para el mapa miniatura (solo visitas con geo)
  const puntosMapa = useMemo<PuntoMapa[]>(
    () => visitas
      .filter(v => v.direccion_lat && v.direccion_lng)
      .map(v => ({
        id: v.id,
        lat: v.direccion_lat!,
        lng: v.direccion_lng!,
        titulo: v.contacto_nombre || 'Sin contacto',
        subtitulo: v.direccion_texto || undefined,
        estado: v.estado as PuntoMapa['estado'],
      })),
    [visitas]
  )

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl border bg-superficie-tarjeta transition-colors w-full md:min-w-[300px] md:max-w-[380px]
        ${isOver ? 'border-texto-marca/40 bg-texto-marca/5' : 'border-borde-sutil'}
      `}
    >
      {/* Header del visitador */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] p-3">
        <Avatar nombre={nombreCompleto} foto={avatarUrl || undefined} tamano="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-texto-primario">{nombreCompleto}</p>
          <p className="text-[11px] text-texto-terciario">
            {visitas.length} {t('visitas.visitas_del_dia')}
            {duracionTotal > 0 && ` · ${Math.floor(duracionTotal / 60)}h ${duracionTotal % 60}m`}
          </p>
        </div>

        {/* Acciones del header */}
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
      </div>

      {/* Mapa miniatura */}
      {puntosMapa.length > 0 && (
        <div className="px-2 pt-2">
          <MapaVisitas
            puntos={puntosMapa}
            className="h-[120px] rounded-lg overflow-hidden"
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

      {/* Lista de visitas — sortable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: '400px' }}>
        <SortableContext items={idsVisitas} strategy={verticalListSortingStrategy}>
          {visitas.map((visita, indice) => (
            <ItemVisitaSortable key={visita.id} visita={visita} indice={indice} />
          ))}
        </SortableContext>

        {visitas.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-texto-terciario">
            {t('visitas.sin_visitas')}
          </div>
        )}
      </div>
    </div>
  )
}
