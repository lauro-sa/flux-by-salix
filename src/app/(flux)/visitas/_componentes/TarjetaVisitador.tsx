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
import { MapPin, GripVertical, Route, Navigation, Inbox, Calendar, ChevronLeft, ChevronRight, Map, ExternalLink, Play, Check } from 'lucide-react'
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
  contacto?: { tipo_contacto?: { clave: string; etiqueta: string } | null } | null
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
  onMoverColumna?: (usuarioId: string, direccion: -1 | 1) => void
  onAbrirRecorrido?: (usuarioId: string, fecha: string) => void
  onAbrirVisita?: (visitaId: string) => void
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
function ItemVisitaSortable({ visita, indice, onAbrirVisita }: { visita: VisitaPlanificacion; indice: number; onAbrirVisita?: (id: string) => void }) {
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
  const fechaConDia = visita.fecha_programada
    ? new Date(visita.fecha_programada).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
        .replace(/^\w/, c => c.toUpperCase())
    : null

  const esCompletada = visita.estado === 'completada'
  const esCancelada = visita.estado === 'cancelada'
  const esInactiva = esCompletada || esCancelada
  const esActiva = visita.estado === 'en_camino' || visita.estado === 'en_sitio'

  const colorBorde = esCancelada ? 'border-l-insignia-peligro/40'
    : esCompletada ? 'border-l-insignia-exito/40'
    : visita.prioridad === 'urgente' ? 'border-l-insignia-peligro'
    : visita.prioridad === 'alta' ? 'border-l-insignia-advertencia'
    : 'border-l-texto-marca/40'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border border-l-2 ${colorBorde} transition-colors ${
        esInactiva ? 'border-white/[0.04] bg-white/[0.01] opacity-50' :
        esActiva ? 'border-texto-marca/30 bg-texto-marca/5' :
        'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      {/* Drag handle — solo si no está completada */}
      {!esInactiva ? (
        <div
          className="flex justify-center py-0.5 opacity-30 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={12} />
        </div>
      ) : (
        <div className="h-1" />
      )}

      <div className="px-3 pb-2.5 space-y-1.5">
        {/* Fila 1: Número + Nombre ... Estado/Tipo + Abrir */}
        <div className="flex items-center gap-2">
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            esCancelada ? 'bg-insignia-peligro/20 text-insignia-peligro' :
            esCompletada ? 'bg-insignia-exito/20 text-insignia-exito' :
            esActiva ? 'bg-texto-marca text-white' :
            'bg-texto-marca/15 text-texto-marca'
          }`}>
            {esCancelada ? '✕' : esCompletada ? '✓' : indice + 1}
          </span>
          <span className={`truncate text-[13px] font-medium flex-1 ${esInactiva ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
            {visita.contacto_nombre || 'Sin contacto'}
          </span>
          {visita.contacto?.tipo_contacto?.etiqueta && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
              {visita.contacto.tipo_contacto.etiqueta}
            </span>
          )}
          {esActiva && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
              visita.estado === 'en_camino' ? 'bg-insignia-exito/15 text-insignia-exito' : 'bg-insignia-info/15 text-insignia-info'
            }`}>
              {visita.estado === 'en_camino' ? 'en camino' : 'en sitio'}
            </span>
          )}
          {onAbrirVisita && (
            <button
              className="shrink-0 rounded p-1 text-texto-terciario hover:bg-texto-marca/10 hover:text-texto-marca transition-colors"
              onClick={(e) => { e.stopPropagation(); onAbrirVisita(visita.id) }}
              title="Abrir visita"
            >
              <ExternalLink size={11} />
            </button>
          )}
        </div>

        {/* Fila 2: Fecha + hora + duración */}
        <div className="flex items-center gap-1.5 text-[11px] text-texto-terciario flex-wrap pl-7">
          {fechaConDia && (
            <span className="flex items-center gap-1">
              <Calendar size={9} className="shrink-0" />
              {fechaConDia}
            </span>
          )}
          {horaFormateada && <span>· {horaFormateada}</span>}
          {visita.duracion_estimada_min && <span>· {visita.duracion_estimada_min}min</span>}
        </div>

        {/* Fila 3: Dirección + botón navegar */}
        {visita.direccion_texto && (
          <div className="flex items-start gap-1.5 pl-7">
            <MapPin size={10} className="shrink-0 text-texto-terciario mt-0.5" />
            <span className="text-[11px] text-texto-terciario leading-tight line-clamp-2 flex-1">{visita.direccion_texto}</span>
            {visita.direccion_lat && visita.direccion_lng && (
              <button
                className="shrink-0 rounded p-1 text-texto-terciario hover:bg-white/[0.08] hover:text-texto-primario transition-colors"
                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${visita.direccion_lat},${visita.direccion_lng}`, '_blank') }}
                title="Navegar"
              >
                <Navigation size={11} />
              </button>
            )}
          </div>
        )}
      </div>
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
  onMoverColumna,
  onAbrirRecorrido,
  onAbrirVisita,
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
        flex flex-col rounded-xl border bg-superficie-tarjeta transition-colors w-full md:min-w-[280px] md:max-w-[340px] md:h-[calc(100dvh-200px)]
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
          <div className="flex items-center gap-0.5">
            {onMoverColumna && (
              <>
                <button onClick={() => onMoverColumna(usuarioId, -1)} className="p-1 text-texto-terciario hover:text-texto-secundario transition-colors rounded hover:bg-white/[0.06]" title="Mover izquierda">
                  <ChevronLeft size={12} />
                </button>
                <button onClick={() => onMoverColumna(usuarioId, 1)} className="p-1 text-texto-terciario hover:text-texto-secundario transition-colors rounded hover:bg-white/[0.06]" title="Mover derecha">
                  <ChevronRight size={12} />
                </button>
              </>
            )}
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

      {/* Lista de visitas — agrupadas por fecha con separadores */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
        <SortableContext items={idsVisitas} strategy={verticalListSortingStrategy}>
          {(() => {
            let ultimaFecha = ''
            let contadorGlobal = 0

            // Pre-calcular estado por fecha
            const estadoPorFecha: Record<string, { enCurso: boolean; completadas: number; total: number }> = {}
            visitas.forEach(v => {
              const fKey = v.fecha_programada?.split('T')[0] || 'sin-fecha'
              if (!estadoPorFecha[fKey]) estadoPorFecha[fKey] = { enCurso: false, completadas: 0, total: 0 }
              const grupo = estadoPorFecha[fKey]
              grupo.total++
              if (v.estado === 'en_camino' || v.estado === 'en_sitio') grupo.enCurso = true
              if (v.estado === 'completada') grupo.completadas++
            })

            return visitas.map((visita) => {
              const fechaVisita = visita.fecha_programada
                ? new Date(visita.fecha_programada).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
                    .replace(/^\w/, c => c.toUpperCase())
                : 'Sin fecha'
              const mostrarSeparador = fechaVisita !== ultimaFecha
              ultimaFecha = fechaVisita
              contadorGlobal++

              const fKey = visita.fecha_programada?.split('T')[0] || 'sin-fecha'
              const estadoGrupo = estadoPorFecha[fKey]
              const grupoEnCurso = estadoGrupo?.enCurso || false
              const grupoCompletado = estadoGrupo ? estadoGrupo.completadas === estadoGrupo.total && estadoGrupo.total > 0 : false

              return (
                <div key={visita.id}>
                  {mostrarSeparador && (
                    <div className={`flex items-center gap-2 pt-3 pb-1.5 first:pt-0 ${grupoEnCurso ? '' : ''}`}>
                      {/* Indicador de estado del grupo */}
                      {!esSinAsignar && grupoEnCurso && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-insignia-advertencia/20">
                          <Play size={7} className="text-insignia-advertencia ml-px" fill="currentColor" />
                        </span>
                      )}
                      {!esSinAsignar && grupoCompletado && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-insignia-exito/20">
                          <Check size={8} className="text-insignia-exito" />
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        grupoEnCurso ? 'text-insignia-advertencia' : grupoCompletado ? 'text-insignia-exito' : 'text-texto-terciario'
                      }`}>
                        {fechaVisita}
                      </span>
                      {grupoEnCurso && (
                        <span className="text-[9px] font-medium text-insignia-advertencia bg-insignia-advertencia/10 px-1.5 py-0.5 rounded-full">
                          en curso
                        </span>
                      )}
                      {!esSinAsignar && estadoGrupo && estadoGrupo.completadas > 0 && !grupoCompletado && (
                        <span className="text-[9px] text-texto-terciario">
                          {estadoGrupo.completadas}/{estadoGrupo.total}
                        </span>
                      )}
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      {!esSinAsignar && onAbrirRecorrido && visita.fecha_programada && (
                        <button
                          onClick={() => {
                            const fechaISO = new Date(visita.fecha_programada!).toISOString().split('T')[0]
                            onAbrirRecorrido(usuarioId, fechaISO)
                          }}
                          className={`shrink-0 rounded-md px-1.5 py-1 transition-colors flex items-center gap-1 ${
                            grupoEnCurso
                              ? 'text-insignia-advertencia bg-insignia-advertencia/10 hover:bg-insignia-advertencia/20'
                              : 'text-texto-terciario hover:bg-texto-marca/10 hover:text-texto-marca'
                          }`}
                          title="Organizar recorrido"
                        >
                          <Map size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  <ItemVisitaSortable visita={visita} indice={contadorGlobal - 1} onAbrirVisita={onAbrirVisita} />
                </div>
              )
            })
          })()}
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
