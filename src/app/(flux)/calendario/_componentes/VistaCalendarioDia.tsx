'use client'

/**
 * VistaCalendarioDia — Vista diaria del calendario con cuadrícula horaria vertical.
 * Muestra una sola columna amplia con eventos posicionados por hora.
 * Soporta superposición de eventos (columnas lado a lado), eventos de todo el día,
 * y drag-and-drop para mover/redimensionar eventos (solo vertical).
 * Se usa en: página principal del calendario (vista día).
 */

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { EventoCalendario } from './tipos'

// --- Constantes ---

/** Hora de inicio de la cuadrícula */
const HORA_INICIO = 6
/** Hora de fin de la cuadrícula */
const HORA_FIN = 22
/** Altura en píxeles de cada fila de hora */
const ALTURA_FILA_HORA = 60
/** Umbral mínimo en px antes de iniciar arrastre (evita conflictos con click) */
const UMBRAL_ARRASTRE = 5

/** Nombres de días de la semana en español */
const NOMBRES_DIA = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
]

/** Nombres de meses en español */
const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// --- Utilidades de fecha ---

/** Compara si dos fechas son el mismo día */
function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Comprueba si la fecha es hoy */
function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

/** Formatea hora como "08:00" */
function formatearHora(hora: number, minutos = 0): string {
  return `${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`
}

/** Formatea hora desde ISO string */
function horaDesdeISO(isoStr: string): string {
  const fecha = new Date(isoStr)
  if (isNaN(fecha.getTime())) return ''
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Obtiene la posición en minutos desde HORA_INICIO */
function minutosDesdeInicio(fecha: Date): number {
  const horas = fecha.getHours()
  const minutos = fecha.getMinutes()
  return (horas - HORA_INICIO) * 60 + minutos
}

/** Formatea fecha completa: "Martes 8 de abril de 2026" */
function formatearFechaCompleta(fecha: Date): string {
  const diaSemana = NOMBRES_DIA[fecha.getDay()]
  const dia = fecha.getDate()
  const mes = NOMBRES_MES[fecha.getMonth()]
  const anio = fecha.getFullYear()
  return `${diaSemana} ${dia} de ${mes} de ${anio}`
}

// --- Cálculo de superposición ---

interface EventoPosicionado {
  evento: EventoCalendario
  columna: number
  totalColumnas: number
  arribaPixeles: number
  altoPixeles: number
}

/**
 * Calcula las posiciones de eventos con superposición.
 * Asigna columnas lado a lado cuando los eventos se solapan.
 */
function calcularPosiciones(
  eventos: EventoCalendario[],
  fechaReferencia: Date,
): EventoPosicionado[] {
  const eventosConHora = eventos
    .filter((e) => !e.todo_el_dia)
    .map((evento) => {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)

      // Recortar al día visible
      const inicioDia = new Date(fechaReferencia)
      inicioDia.setHours(HORA_INICIO, 0, 0, 0)
      const finDia = new Date(fechaReferencia)
      finDia.setHours(HORA_FIN, 0, 0, 0)

      const inicioEfectivo = inicio < inicioDia ? inicioDia : inicio
      const finEfectivo = fin > finDia ? finDia : fin

      const arribaMin = minutosDesdeInicio(inicioEfectivo)
      const finMin = minutosDesdeInicio(finEfectivo)
      const duracionMin = Math.max(finMin - arribaMin, 15)

      return {
        evento,
        arribaMin,
        finMin: arribaMin + duracionMin,
        arribaPixeles: (arribaMin / 60) * ALTURA_FILA_HORA,
        altoPixeles: (duracionMin / 60) * ALTURA_FILA_HORA,
        columna: 0,
        totalColumnas: 1,
      }
    })
    .sort((a, b) => a.arribaMin - b.arribaMin || b.finMin - a.finMin)

  // Algoritmo de asignación de columnas por grupos de superposición
  const grupos: (typeof eventosConHora)[] = []
  let grupoActual: typeof eventosConHora = []

  for (const ev of eventosConHora) {
    if (grupoActual.length === 0 || ev.arribaMin < Math.max(...grupoActual.map((e) => e.finMin))) {
      grupoActual.push(ev)
    } else {
      grupos.push(grupoActual)
      grupoActual = [ev]
    }
  }
  if (grupoActual.length > 0) grupos.push(grupoActual)

  for (const grupo of grupos) {
    const columnas: number[] = []
    for (const ev of grupo) {
      let colAsignada = -1
      for (let c = 0; c < columnas.length; c++) {
        if (ev.arribaMin >= columnas[c]) {
          colAsignada = c
          break
        }
      }
      if (colAsignada === -1) {
        colAsignada = columnas.length
        columnas.push(0)
      }
      ev.columna = colAsignada
      columnas[colAsignada] = ev.finMin
    }
    const totalCols = columnas.length
    for (const ev of grupo) {
      ev.totalColumnas = totalCols
    }
  }

  return eventosConHora
}

// --- Componente de evento arrastrable para vista día ---

interface PropiedadesEventoDiaArrastrable {
  ep: EventoPosicionado
  indice: number
  onClickEvento: (evento: EventoCalendario) => void
}

/**
 * BloqueEventoDiaArrastrable — Evento individual con soporte drag-and-drop.
 * Mover arrastra todo el evento (solo vertical), redimensionar cambia fin.
 */
function BloqueEventoDiaArrastrable({
  ep,
  indice,
  onClickEvento,
}: PropiedadesEventoDiaArrastrable) {
  const anchoColumna = 100 / ep.totalColumnas
  const izquierda = ep.columna * anchoColumna
  const anchoPorcentaje = anchoColumna - (ep.totalColumnas > 1 ? 1 : 0)

  // Hook para arrastrar (mover)
  const {
    attributes: atributosMover,
    listeners: escuchasMover,
    setNodeRef: refNodoMover,
    transform: transformMover,
    isDragging: estaArrastrandoMover,
  } = useDraggable({ id: `mover-${ep.evento.id}` })

  // Hook para redimensionar (asa inferior)
  const {
    attributes: atributosRedimensionar,
    listeners: escuchasRedimensionar,
    setNodeRef: refNodoRedimensionar,
    transform: transformRedimensionar,
    isDragging: estaRedimensionando,
  } = useDraggable({ id: `redimensionar-${ep.evento.id}` })

  // Estilo de transformación durante el arrastre (solo vertical en vista día)
  const estiloTransformMover = transformMover
    ? {
        transform: `translate(0px, ${transformMover.y}px)`,
        zIndex: 50,
        opacity: 0.85,
      }
    : {}

  // Altura con redimensionado
  const alturaConRedimensionado = estaRedimensionando && transformRedimensionar
    ? Math.max(ep.altoPixeles + transformRedimensionar.y, 15)
    : ep.altoPixeles

  return (
    <motion.div
      ref={refNodoMover}
      {...atributosMover}
      {...escuchasMover}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: indice * 0.03 }}
      className={[
        'absolute rounded-md px-2.5 py-1.5 text-left overflow-hidden cursor-grab transition-shadow hover:shadow-md z-10 select-none',
        estaArrastrandoMover ? 'cursor-grabbing shadow-lg ring-2 ring-texto-marca/30' : '',
      ].join(' ')}
      style={{
        top: `${ep.arribaPixeles}px`,
        height: `${Math.max(alturaConRedimensionado, 24)}px`,
        left: `${izquierda}%`,
        width: `${anchoPorcentaje}%`,
        backgroundColor: ep.evento.color
          ? `${ep.evento.color}20`
          : 'var(--superficie-elevada)',
        borderLeft: ep.evento.color
          ? `3px solid ${ep.evento.color}`
          : '3px solid var(--texto-marca)',
        color: ep.evento.color || 'var(--texto-primario)',
        ...estiloTransformMover,
      }}
      onClick={(e) => {
        if (!estaArrastrandoMover && !estaRedimensionando) {
          e.stopPropagation()
          onClickEvento(ep.evento)
        }
      }}
    >
      {/* Título */}
      <div className="text-sm font-medium truncate leading-tight">
        {ep.evento.titulo}
      </div>

      {/* Hora */}
      <div className="text-[11px] opacity-70 leading-tight">
        {horaDesdeISO(ep.evento.fecha_inicio)} – {horaDesdeISO(ep.evento.fecha_fin)}
      </div>

      {/* Descripción (solo si hay espacio: > 45 min) */}
      {ep.altoPixeles > 50 && ep.evento.descripcion && (
        <div className="text-xs text-texto-terciario mt-0.5 truncate leading-tight">
          {ep.evento.descripcion}
        </div>
      )}

      {/* Ubicación (solo si hay bastante espacio) */}
      {ep.altoPixeles > 70 && ep.evento.ubicacion && (
        <div className="text-[11px] text-texto-terciario mt-0.5 truncate leading-tight opacity-70">
          📍 {ep.evento.ubicacion}
        </div>
      )}

      {/* Asignados (solo si hay mucho espacio) */}
      {ep.altoPixeles > 90 && ep.evento.asignados.length > 0 && (
        <div className="flex items-center gap-1 mt-1">
          {ep.evento.asignados.slice(0, 3).map((asignado) => (
            <span
              key={asignado.id}
              className="inline-flex items-center justify-center size-5 rounded-full bg-superficie-hover text-[10px] font-medium text-texto-secundario"
              title={asignado.nombre}
            >
              {asignado.nombre.charAt(0).toUpperCase()}
            </span>
          ))}
          {ep.evento.asignados.length > 3 && (
            <span className="text-[10px] text-texto-terciario">
              +{ep.evento.asignados.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Asa de redimensionado en la parte inferior */}
      <div
        ref={refNodoRedimensionar}
        {...atributosRedimensionar}
        {...escuchasRedimensionar}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize group/asa flex items-center justify-center"
      >
        <div className="w-8 h-0.5 rounded-full bg-current opacity-0 group-hover/asa:opacity-40 transition-opacity" />
      </div>
    </motion.div>
  )
}

// --- Componente principal ---

interface PropiedadesVistaDia {
  fechaActual: Date
  eventos: EventoCalendario[]
  onClickHora: (fecha: Date) => void
  onClickEvento: (evento: EventoCalendario) => void
  /** Drag para mover evento (solo vertical/tiempo en vista día) */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
}

function VistaCalendarioDia({
  fechaActual,
  eventos,
  onClickHora,
  onClickEvento,
  onMoverEvento,
}: PropiedadesVistaDia) {
  const refContenedor = useRef<HTMLDivElement>(null)

  // Sensor con umbral de distancia para diferenciar click de arrastre
  const sensores = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: UMBRAL_ARRASTRE },
    }),
  )

  /** Eventos que caen en el día actual */
  const eventosDelDia = useMemo(() => {
    return eventos.filter((evento) => {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)
      const inicioDia = new Date(fechaActual)
      inicioDia.setHours(0, 0, 0, 0)
      const finDia = new Date(fechaActual)
      finDia.setHours(23, 59, 59, 999)
      return inicio <= finDia && fin >= inicioDia
    })
  }, [eventos, fechaActual])

  /** Eventos de todo el día */
  const eventosTodoElDia = useMemo(() => {
    return eventosDelDia.filter((e) => e.todo_el_dia)
  }, [eventosDelDia])

  /** Eventos con hora posicionados */
  const eventosPositionados = useMemo(() => {
    return calcularPosiciones(eventosDelDia, fechaActual)
  }, [eventosDelDia, fechaActual])

  /** Filas de horas */
  const filasHoras = useMemo(() => {
    const filas: number[] = []
    for (let h = HORA_INICIO; h <= HORA_FIN; h++) filas.push(h)
    return filas
  }, [])

  /** Posición del indicador de hora actual en píxeles */
  const posicionIndicadorActual = useMemo(() => {
    if (!esHoy(fechaActual)) return null
    const ahora = new Date()
    const min = minutosDesdeInicio(ahora)
    if (min < 0 || min > (HORA_FIN - HORA_INICIO) * 60) return null
    return (min / 60) * ALTURA_FILA_HORA
  }, [fechaActual])

  // Auto-scroll a la hora actual al montar
  useEffect(() => {
    if (!refContenedor.current) return
    const ahora = new Date()
    const horaActual = ahora.getHours()
    const horaObjetivo = Math.max(horaActual - 1, HORA_INICIO)
    const pixelesObjetivo = (horaObjetivo - HORA_INICIO) * ALTURA_FILA_HORA
    refContenedor.current.scrollTop = pixelesObjetivo
  }, [])

  /** Maneja clic en una celda horaria vacía */
  function manejarClickHora(hora: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutosFraccion = Math.floor((y / ALTURA_FILA_HORA) * 60)
    const minutosRedondeados = Math.round(minutosFraccion / 15) * 15
    const fechaHora = new Date(fechaActual)
    fechaHora.setHours(hora, minutosRedondeados, 0, 0)
    onClickHora(fechaHora)
  }

  /**
   * Maneja el fin de un arrastre (mover o redimensionar) en vista día.
   * Solo movimiento vertical (tiempo), sin cambio de día.
   */
  const manejarFinArrastre = useCallback(
    (event: DragEndEvent) => {
      if (!onMoverEvento || !event.delta) return

      const { active, delta } = event
      const idArrastrable = active.id as string

      const esRedimensionar = idArrastrable.startsWith('redimensionar-')
      const eventoId = esRedimensionar
        ? idArrastrable.replace('redimensionar-', '')
        : idArrastrable.replace('mover-', '')

      const eventoOriginal = eventos.find((e) => e.id === eventoId)
      if (!eventoOriginal) return

      const inicioOriginal = new Date(eventoOriginal.fecha_inicio)
      const finOriginal = new Date(eventoOriginal.fecha_fin)

      // Calcular delta en minutos redondeado a 15 min
      const deltaMinutos = Math.round((delta.y / ALTURA_FILA_HORA) * 60 / 15) * 15

      if (esRedimensionar) {
        const nuevaFin = new Date(finOriginal)
        nuevaFin.setMinutes(nuevaFin.getMinutes() + deltaMinutos)
        if (nuevaFin <= inicioOriginal) return
        onMoverEvento(eventoId, inicioOriginal.toISOString(), nuevaFin.toISOString())
      } else {
        const nuevaInicio = new Date(inicioOriginal)
        nuevaInicio.setMinutes(nuevaInicio.getMinutes() + deltaMinutos)
        const nuevaFin = new Date(finOriginal)
        nuevaFin.setMinutes(nuevaFin.getMinutes() + deltaMinutos)
        onMoverEvento(eventoId, nuevaInicio.toISOString(), nuevaFin.toISOString())
      }
    },
    [eventos, onMoverEvento],
  )

  return (
    <DndContext sensors={sensores} onDragEnd={manejarFinArrastre}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-full"
      >
        {/* Encabezado con fecha completa */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-borde-sutil">
          <div className="flex flex-col">
            <span
              className={[
                'text-lg font-semibold',
                esHoy(fechaActual) ? 'text-texto-marca' : 'text-texto-primario',
              ].join(' ')}
            >
              {formatearFechaCompleta(fechaActual)}
            </span>
            {esHoy(fechaActual) && (
              <span className="text-xs text-texto-marca font-medium">Hoy</span>
            )}
          </div>
        </div>

        {/* Barra de eventos de todo el día */}
        {eventosTodoElDia.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-borde-sutil bg-superficie-app/50">
            <span className="text-xs text-texto-terciario mr-1 self-center">Todo el día</span>
            {eventosTodoElDia.map((evento) => (
              <motion.button
                key={evento.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                onClick={() => onClickEvento(evento)}
                className="rounded-md px-2.5 py-1 text-xs font-medium truncate max-w-[200px] transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: evento.color ? `${evento.color}20` : 'var(--superficie-elevada)',
                  color: evento.color || 'var(--texto-primario)',
                  borderLeft: evento.color
                    ? `3px solid ${evento.color}`
                    : '3px solid var(--texto-marca)',
                }}
              >
                {evento.titulo}
              </motion.button>
            ))}
          </div>
        )}

        {/* Cuadrícula horaria con scroll */}
        <div ref={refContenedor} className="flex-1 overflow-y-auto relative">
          <div
            className="relative"
            style={{ height: `${(HORA_FIN - HORA_INICIO + 1) * ALTURA_FILA_HORA}px` }}
          >
            {/* Filas de horas */}
            {filasHoras.map((hora) => (
              <div
                key={hora}
                className="absolute left-0 right-0 flex"
                style={{ top: `${(hora - HORA_INICIO) * ALTURA_FILA_HORA}px`, height: `${ALTURA_FILA_HORA}px` }}
              >
                {/* Etiqueta de hora */}
                <div className="w-16 shrink-0 pr-2 text-right">
                  <span className="text-xs text-texto-terciario -translate-y-1/2 inline-block">
                    {formatearHora(hora)}
                  </span>
                </div>

                {/* Celda clicable */}
                <div
                  className="flex-1 border-t border-borde-sutil cursor-pointer hover:bg-superficie-hover/30 transition-colors"
                  onClick={(e) => manejarClickHora(hora, e)}
                />
              </div>
            ))}

            {/* Indicador de hora actual */}
            {posicionIndicadorActual !== null && (
              <div
                className="absolute left-14 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${posicionIndicadorActual}px` }}
              >
                <div className="size-2.5 rounded-full -ml-1.5 shrink-0" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
              </div>
            )}

            {/* Eventos posicionados con drag-and-drop */}
            <div className="absolute left-16 right-2 top-0 bottom-0">
              {eventosPositionados.map((ep, indice) => (
                <BloqueEventoDiaArrastrable
                  key={ep.evento.id}
                  ep={ep}
                  indice={indice}
                  onClickEvento={onClickEvento}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </DndContext>
  )
}

export { VistaCalendarioDia }
