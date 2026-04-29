'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { formatearFechaISO } from '@/lib/formato-fecha'
import { MapPin, Navigation, Inbox, Calendar, ChevronLeft, ChevronRight, Map, ExternalLink, Play, Check, CheckCircle, XCircle, Sparkles } from 'lucide-react'
import { MapaRecorrido } from '@/componentes/mapa'
import type { PuntoMapa, RutaMapa } from '@/componentes/mapa'
import type { ConfigPermisos } from './ConfigRecorrido'

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
  tiene_hora_especifica?: boolean | null
  fecha_inicio?: string | null
  fecha_llegada?: string | null
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
  onMoverColumna?: (usuarioId: string, direccion: -1 | 1) => void
  onAbrirRecorrido?: (usuarioId: string, fecha: string) => void
  onAbrirVisita?: (visitaId: string) => void
  onConfirmarProvisoria?: (visitaId: string) => void
  onRechazarProvisoria?: (visitaId: string) => void
  esSinAsignar?: boolean
}

// Colores por estado
type ColorInsignia = 'exito' | 'peligro' | 'advertencia' | 'info' | 'primario' | 'neutro'

const COLORES_ESTADO: Record<string, ColorInsignia> = {
  provisoria: 'advertencia',
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
function ItemVisitaSortable({
  visita,
  indice,
  onAbrirVisita,
  onConfirmarProvisoria,
  onRechazarProvisoria,
}: {
  visita: VisitaPlanificacion
  indice: number
  onAbrirVisita?: (id: string) => void
  onConfirmarProvisoria?: (visitaId: string) => void
  onRechazarProvisoria?: (visitaId: string) => void
}) {
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

  // Hora real si existe (visitador ya empezó), sino la programada solo si tiene hora
  // específica. Si no tiene hora específica y no empezó, no mostramos hora — la visita
  // está programada solo por día.
  const horaReal = visita.fecha_inicio || visita.fecha_llegada
  const horaFormateada = horaReal
    ? formato.hora(horaReal)
    : (visita.fecha_programada && visita.tiene_hora_especifica
        ? formato.hora(visita.fecha_programada)
        : null)
  const fechaConDia = visita.fecha_programada
    ? new Date(visita.fecha_programada).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: formato.zonaHoraria })
        .replace(/^\w/, c => c.toUpperCase())
    : null

  const esCompletada = visita.estado === 'completada'
  const esCancelada = visita.estado === 'cancelada'
  const esInactiva = esCompletada || esCancelada
  const esActiva = visita.estado === 'en_camino' || visita.estado === 'en_sitio'
  const esProvisoria = visita.estado === 'provisoria'
  const fueCreadaPorIA = !!(visita.motivo && /agente\s*ia|whatsapp/i.test(visita.motivo))
    || esProvisoria // por ahora, toda provisoria viene del agente

  const colorBorde = esCancelada ? 'border-l-insignia-peligro/40'
    : esCompletada ? 'border-l-insignia-exito/40'
    : esProvisoria ? 'border-l-insignia-advertencia'
    : visita.prioridad === 'urgente' ? 'border-l-insignia-peligro'
    : visita.prioridad === 'alta' ? 'border-l-insignia-advertencia'
    : 'border-l-texto-marca/40'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-card border border-l-2 ${colorBorde} transition-colors ${
        esInactiva ? 'border-white/[0.04] bg-white/[0.01] opacity-50' :
        esActiva ? 'border-texto-marca/30 bg-texto-marca/5' :
        esProvisoria ? 'border-insignia-advertencia/30 bg-insignia-advertencia/5 hover:bg-insignia-advertencia/10' :
        'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      {/* Drag area = todo el cuerpo de info de la card (no el footer de botones).
          Esto da mucho más superficie agarrable que un iconito chiquito. Los botones
          del footer hacen stopPropagation para que no se interpreten como drag. */}
      <div
        className="px-3 pt-2.5 pb-2.5 space-y-1.5 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        {/* Fila 1: Número + Nombre ... Estado/Tipo */}
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
          {esProvisoria && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-insignia-advertencia/15 text-insignia-advertencia flex items-center gap-1">
              {fueCreadaPorIA && <Sparkles size={9} />}
              A confirmar
            </span>
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

        {/* Fila 3: Dirección (texto solo) */}
        {visita.direccion_texto && (
          <div className="flex items-start gap-1.5 pl-7">
            <MapPin size={10} className="shrink-0 text-texto-terciario mt-0.5" />
            <span className="text-[11px] text-texto-terciario leading-tight line-clamp-2 flex-1">{visita.direccion_texto}</span>
          </div>
        )}

        {/* Acciones provisoria: Confirmar / Rechazar */}
        {esProvisoria && (onConfirmarProvisoria || onRechazarProvisoria) && (
          <div className="flex items-center gap-1.5 pl-7 pt-1">
            {onConfirmarProvisoria && (
              <button
                onClick={(e) => { e.stopPropagation(); onConfirmarProvisoria(visita.id) }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-insignia-exito/10 text-insignia-exito hover:bg-insignia-exito/20 transition-colors"
              >
                <CheckCircle size={10} /> Confirmar
              </button>
            )}
            {onRechazarProvisoria && (
              <button
                onClick={(e) => { e.stopPropagation(); onRechazarProvisoria(visita.id) }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10 transition-colors"
              >
                <XCircle size={10} /> Rechazar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer con dos botones que usan TODO el ancho de la tarjeta:
          [Abrir visita | Navegar en Maps]. Si solo una acción está disponible,
          ocupa el ancho completo. Se muestran SIEMPRE (incluso en visitas
          completadas/canceladas) — abrirlas para revisar el registro o navegar
          al lugar sigue siendo útil aunque ya hayan ocurrido.
          Stop propagation para no chocar con dnd-kit. */}
      {(() => {
        const tieneCoords = !!(visita.direccion_lat && visita.direccion_lng)
        const mostrarAbrir = !!onAbrirVisita
        const mostrarNavegar = tieneCoords
        if (!mostrarAbrir && !mostrarNavegar) return null
        const cols = (mostrarAbrir && mostrarNavegar) ? 'grid-cols-2 divide-x divide-white/[0.06]' : 'grid-cols-1'
        return (
          <div className={`grid ${cols} border-t border-white/[0.06]`}>
            {mostrarAbrir && (
              <button
                onClick={(e) => { e.stopPropagation(); onAbrirVisita!(visita.id) }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-texto-secundario hover:bg-texto-marca/10 hover:text-texto-marca transition-colors"
              >
                <ExternalLink size={12} />
                <span>Abrir visita</span>
              </button>
            )}
            {mostrarNavegar && (
              <button
                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${visita.direccion_lat},${visita.direccion_lng}`, '_blank') }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-texto-secundario hover:bg-white/[0.06] hover:text-texto-primario transition-colors"
              >
                <Navigation size={12} />
                <span>Navegar</span>
              </button>
            )}
          </div>
        )
      })()}
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
  onMoverColumna,
  onAbrirRecorrido,
  onAbrirVisita,
  onConfirmarProvisoria,
  onRechazarProvisoria,
  esSinAsignar,
}: Props) {
  const { t } = useTraduccion()
  const { zonaHoraria } = useFormato()

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
        flex flex-col rounded-card border bg-superficie-tarjeta transition-colors w-full md:min-w-[340px] md:max-w-[400px] md:h-[calc(100dvh-200px)]
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

        {/* Acciones del header — solo reordenar columnas.
            Optimizar ruta y config de recorrido viven adentro del modal de UN día
            (donde tiene sentido hacerlo): la columna mensual mezcla varios días
            y optimizar todo junto rompe el agrupamiento por fecha. */}
        {!esSinAsignar && onMoverColumna && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => onMoverColumna(usuarioId, -1)} className="p-1 text-texto-terciario hover:text-texto-secundario transition-colors rounded hover:bg-white/[0.06]" title="Mover izquierda">
              <ChevronLeft size={12} />
            </button>
            <button onClick={() => onMoverColumna(usuarioId, 1)} className="p-1 text-texto-terciario hover:text-texto-secundario transition-colors rounded hover:bg-white/[0.06]" title="Mover derecha">
              <ChevronRight size={12} />
            </button>
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
            className="h-[140px] rounded-card overflow-hidden"
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

      {/* Lista de visitas — agrupadas por fecha en sub-cards.
          Cada grupo es un bloque visual distinto con su header (fecha + CTA Recorrido)
          y sus items adentro. Esto deja claro que MAR 28 es un bloque y JUE 23 es otro,
          en vez de una lista plana con separadores. La numeración 1/2/3 reinicia por
          grupo (orden del recorrido del día), no es un contador global del mes. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-3.5">
        <SortableContext items={idsVisitas} strategy={verticalListSortingStrategy}>
          {(() => {
            // Clave de agrupamiento: día local en la zona horaria de la empresa.
            const claveDia = (fecha: string | null): string =>
              fecha ? formatearFechaISO(fecha, zonaHoraria) : 'sin-fecha'

            // Agrupar visitas por día preservando el orden original de la lista.
            const grupos: { fKey: string; fechaTexto: string; visitas: VisitaPlanificacion[] }[] = []
            for (const v of visitas) {
              const fKey = claveDia(v.fecha_programada)
              let g = grupos.find(g => g.fKey === fKey)
              if (!g) {
                const fechaTexto = v.fecha_programada
                  ? new Date(v.fecha_programada).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zonaHoraria })
                      .replace(/^\w/, c => c.toUpperCase())
                  : 'Sin fecha'
                g = { fKey, fechaTexto, visitas: [] }
                grupos.push(g)
              }
              g.visitas.push(v)
            }

            // Ordenar visitas dentro de cada día por la hora que mejor representa
            // su lugar real en la jornada:
            //   1) hora real (fecha_inicio o fecha_llegada) — si el visitador ya pasó
            //   2) hora programada (solo si tiene_hora_especifica)
            //   3) sin hora — al final del grupo (no inventamos una posición)
            // Así una visita completada a las 11:56 no aparece después de otra completada
            // a las 14:03 sólo porque se cargó después.
            const horaOrdenamiento = (v: VisitaPlanificacion): number => {
              const real = v.fecha_inicio || v.fecha_llegada
              if (real) return new Date(real).getTime()
              if (v.tiene_hora_especifica && v.fecha_programada) return new Date(v.fecha_programada).getTime()
              return Number.POSITIVE_INFINITY
            }
            for (const g of grupos) {
              g.visitas.sort((a, b) => horaOrdenamiento(a) - horaOrdenamiento(b))
            }

            return grupos.map((grupo) => {
              const total = grupo.visitas.length
              const completadas = grupo.visitas.filter(v => v.estado === 'completada').length
              const enCurso = grupo.visitas.some(v => v.estado === 'en_camino' || v.estado === 'en_sitio')
              const completado = total > 0 && completadas === total
              const tieneCoords = grupo.visitas.some(v => v.direccion_lat != null && v.direccion_lng != null)

              return (
                <div
                  key={grupo.fKey}
                  className={`rounded-card border overflow-hidden ${
                    enCurso ? 'border-insignia-advertencia/30 bg-insignia-advertencia/[0.03]' :
                    completado ? 'border-insignia-exito/20 bg-insignia-exito/[0.02]' :
                    'border-borde-sutil bg-white/[0.015]'
                  }`}
                >
                  {/* Header del grupo: fecha + estado + CTA Recorrido */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
                    {!esSinAsignar && enCurso && (
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-insignia-advertencia/20">
                        <Play size={7} className="text-insignia-advertencia ml-px" fill="currentColor" />
                      </span>
                    )}
                    {!esSinAsignar && completado && (
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-insignia-exito/20">
                        <Check size={8} className="text-insignia-exito" />
                      </span>
                    )}
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                      enCurso ? 'text-insignia-advertencia' :
                      completado ? 'text-insignia-exito' :
                      'text-texto-secundario'
                    }`}>
                      {grupo.fechaTexto}
                    </span>
                    {enCurso && (
                      <span className="text-[9px] font-medium text-insignia-advertencia bg-insignia-advertencia/10 px-1.5 py-0.5 rounded-full">
                        en curso
                      </span>
                    )}
                    {!esSinAsignar && completadas > 0 && !completado && (
                      <span className="text-[10px] text-texto-terciario">
                        {completadas}/{total}
                      </span>
                    )}
                    <div className="flex-1" />
                    {/* CTA Recorrido — acción principal del grupo, con texto + icono.
                        Solo aparece si hay coordenadas en al menos una visita. */}
                    {!esSinAsignar && onAbrirRecorrido && tieneCoords && (
                      <button
                        onClick={() => onAbrirRecorrido(usuarioId, grupo.fKey)}
                        className={`shrink-0 rounded-boton px-2 py-1 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                          enCurso
                            ? 'bg-insignia-advertencia/15 text-insignia-advertencia hover:bg-insignia-advertencia/25'
                            : 'bg-texto-marca/10 text-texto-marca hover:bg-texto-marca/20'
                        }`}
                        title="Abrir recorrido del día"
                      >
                        <Map size={11} />
                        <span>Recorrido</span>
                      </button>
                    )}
                  </div>

                  {/* Items del grupo — numeración local 1, 2, 3 dentro del día */}
                  <div className="p-2 space-y-2">
                    {grupo.visitas.map((visita, idx) => (
                      <ItemVisitaSortable
                        key={visita.id}
                        visita={visita}
                        indice={idx}
                        onAbrirVisita={onAbrirVisita}
                        onConfirmarProvisoria={onConfirmarProvisoria}
                        onRechazarProvisoria={onRechazarProvisoria}
                      />
                    ))}
                  </div>
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
                <div className="mb-1.5 rounded-card border-2 border-dashed border-borde-sutil p-3">
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
