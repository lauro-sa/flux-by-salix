'use client'

/**
 * VistaCalendarioDia — Vista diaria del calendario con cuadrícula horaria vertical.
 * Muestra una sola columna amplia con eventos posicionados por hora.
 * Soporta superposición de eventos (columnas lado a lado), eventos de todo el día,
 * y drag-and-drop para mover/redimensionar eventos (solo vertical).
 * Se usa en: página principal del calendario (vista día).
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Route } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
} from '@dnd-kit/core'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import type { EventoCalendario } from './tipos'
import {
  NOMBRES_DIAS_COMPLETOS,
  NOMBRES_MESES,
  mismoDia,
  esHoy,
  formatearHoraCorta,
  formatearHoraISO,
  formatearEtiquetaHora,
  formatearDuracion,
  formatearDuracionDesdeY,
} from './constantes'

// --- Constantes ---

/** Hora de inicio por defecto si no hay config */
const HORA_INICIO_DEFAULT = 6
/** Hora de fin por defecto si no hay config */
const HORA_FIN_DEFAULT = 22
/** Altura en píxeles de cada fila de hora */
const ALTURA_FILA_HORA = 60
/** Umbral mínimo en px antes de iniciar arrastre (evita conflictos con click) */
const UMBRAL_ARRASTRE = 5

/** Formatea fecha completa: "Martes 8 de abril de 2026" */
function formatearFechaCompleta(fecha: Date): string {
  const diaSemana = NOMBRES_DIAS_COMPLETOS[fecha.getDay()]
  const dia = fecha.getDate()
  const mes = NOMBRES_MESES[fecha.getMonth()].toLowerCase()
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
  horaInicio: number,
  horaFin: number,
): EventoPosicionado[] {
  /** Obtiene la posición en minutos desde horaInicio */
  function minutosDesdeInicio(fecha: Date): number {
    return (fecha.getHours() - horaInicio) * 60 + fecha.getMinutes()
  }

  const eventosConHora = eventos
    .filter((e) => !e.todo_el_dia)
    .map((evento) => {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)

      // Recortar al día visible
      const inicioDia = new Date(fechaReferencia)
      inicioDia.setHours(horaInicio, 0, 0, 0)
      const finDia = new Date(fechaReferencia)
      finDia.setHours(horaFin, 0, 0, 0)

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
  /** Formato 24h para mostrar horas */
  es24h: boolean
}

/**
 * BloqueEventoDiaArrastrable — Evento individual con soporte drag-and-drop.
 * Mover arrastra todo el evento (solo vertical), redimensionar cambia fin.
 */
function BloqueEventoDiaArrastrable({
  ep,
  indice,
  onClickEvento,
  es24h,
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
        opacity: 1,
      }
    : {}

  // Altura con redimensionado
  const alturaConRedimensionado = estaRedimensionando && transformRedimensionar
    ? Math.max(ep.altoPixeles + transformRedimensionar.y, 15)
    : ep.altoPixeles

  const colorEvento = ep.evento.color || 'var(--texto-marca)'
  const estiloBase = {
    top: `${ep.arribaPixeles}px`,
    left: `${izquierda}%`,
    width: `${anchoPorcentaje}%`,
    backgroundColor: ep.evento.color ? `${ep.evento.color}20` : 'var(--superficie-elevada)',
    borderLeft: ep.evento.color ? `3px solid ${ep.evento.color}` : '3px solid var(--texto-marca)',
    color: ep.evento.color || 'var(--texto-primario)',
  }

  return (
      /* Bloque original — cuando se arrastra para mover, se vuelve fantasma (DragOverlay muestra la copia flotante) */
      <motion.div
        ref={refNodoMover}
        data-evento-bloque
        {...atributosMover}
        {...escuchasMover}
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15, delay: indice * 0.03 }}
        className={[
          'absolute rounded-md px-2.5 py-1.5 text-left overflow-hidden cursor-grab transition-shadow hover:shadow-md z-10 select-none',
          estaArrastrandoMover ? 'cursor-grabbing' : '',
          estaRedimensionando ? 'shadow-lg ring-1 ring-texto-marca/20' : '',
        ].join(' ')}
        style={{
          ...estiloBase,
          height: `${Math.max(alturaConRedimensionado, 32)}px`,
          // Al mover: el original queda como fantasma en su lugar, DragOverlay muestra la copia flotante
          opacity: estaArrastrandoMover ? 0.3 : 1,
          borderStyle: estaArrastrandoMover ? 'dashed' : 'solid',
          // No aplicar transform al original — DragOverlay se encarga del movimiento visual
          ...(!estaArrastrandoMover ? estiloTransformMover : {}),
        }}
        onClick={(e) => {
          if (!estaArrastrandoMover && !estaRedimensionando) {
            e.stopPropagation()
            onClickEvento(ep.evento)
          }
        }}
      >
      {/* Título */}
      <div className="text-sm font-medium truncate leading-tight flex items-center gap-1">
        {ep.evento._es_visita && <MapPin size={12} className="shrink-0" />}
        {ep.evento._es_recorrido && <Route size={12} className="shrink-0" />}
        {ep.evento.titulo}
      </div>

      {/* Hora — actualiza en tiempo real durante resize */}
      <div className="text-[11px] sm:text-xs opacity-70 leading-tight">
        {(() => {
          const finEnVivo = estaRedimensionando && transformRedimensionar
            ? new Date(new Date(ep.evento.fecha_fin).getTime() + Math.round((transformRedimensionar.y / ALTURA_FILA_HORA) * 60 / 15) * 15 * 60000)
            : new Date(ep.evento.fecha_fin)
          return (
            <>
              {formatearHoraISO(ep.evento.fecha_inicio, es24h)} – {formatearHoraCorta(finEnVivo, es24h)}
              <span className="opacity-60 ml-1">· {formatearDuracion(ep.evento.fecha_inicio, finEnVivo)}</span>
            </>
          )
        })()}
      </div>

      {/* Descripción (solo si hay espacio: > 45 min) */}
      {ep.altoPixeles > 50 && ep.evento.descripcion && (
        <div className="text-xs text-texto-terciario mt-0.5 truncate leading-tight">
          {ep.evento.descripcion}
        </div>
      )}

      {/* Ubicación (solo si hay bastante espacio) */}
      {ep.altoPixeles > 70 && ep.evento.ubicacion && (
        <div className="text-[11px] sm:text-xs text-texto-terciario mt-0.5 truncate leading-tight opacity-70">
          📍 {ep.evento.ubicacion}
        </div>
      )}

      {/* Asignados (solo si hay mucho espacio) */}
      {ep.altoPixeles > 90 && ep.evento.asignados.length > 0 && (
        <div className="flex items-center gap-1 mt-1">
          {ep.evento.asignados.slice(0, 3).map((asignado) => (
            <span
              key={asignado.id}
              className="inline-flex items-center justify-center size-5 rounded-full bg-superficie-hover text-[10px] sm:text-[11px] font-medium text-texto-secundario"
              title={asignado.nombre}
            >
              {asignado.nombre.charAt(0).toUpperCase()}
            </span>
          ))}
          {ep.evento.asignados.length > 3 && (
            <span className="text-[10px] sm:text-[11px] text-texto-terciario">
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
  /** Click en franja vacía → crear evento; fechaFin opcional si se arrastró un rango */
  onClickHora: (fecha: Date, fechaFin?: Date) => void
  onClickEvento: (evento: EventoCalendario) => void
  /** Drag para mover evento (solo vertical/tiempo en vista día) */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
  /** Hora de inicio laboral (define el rango visible de la cuadrícula) */
  horaInicioLaboral?: number
  /** Hora de fin laboral (define el rango visible de la cuadrícula) */
  horaFinLaboral?: number
}

/** Estado de la selección por arrastre (drag-to-select) en vista día */
interface EstadoSeleccionRangoDia {
  /** Posición Y inicial relativa a la cuadrícula (en px) */
  inicioY: number
  /** Posición Y actual relativa a la cuadrícula (en px) */
  finY: number
  /** Si el arrastre está activo */
  activa: boolean
}

/**
 * Redondea una posición Y a intervalos de 15 minutos.
 */
function redondearYA15MinDia(y: number): number {
  const minutos = (y / ALTURA_FILA_HORA) * 60
  const minutosRedondeados = Math.round(minutos / 15) * 15
  return (minutosRedondeados / 60) * ALTURA_FILA_HORA
}

function VistaCalendarioDia({
  fechaActual,
  eventos,
  onClickHora,
  onClickEvento,
  onMoverEvento,
  horaInicioLaboral,
  horaFinLaboral,
}: PropiedadesVistaDia) {
  // --- Rango horario de la cuadrícula (desde config o defaults) ---
  const HORA_INICIO = horaInicioLaboral ?? HORA_INICIO_DEFAULT
  const HORA_FIN = horaFinLaboral ?? HORA_FIN_DEFAULT

  /** Obtiene la posición en minutos desde HORA_INICIO */
  function minutosDesdeInicio(fecha: Date): number {
    return (fecha.getHours() - HORA_INICIO) * 60 + fecha.getMinutes()
  }

  /** Convierte una posición Y (px) a hora decimal (ej: 8.5 = 08:30) */
  function horaDecimalDesdeYDia(y: number): number {
    return HORA_INICIO + (y / ALTURA_FILA_HORA)
  }

  /** Convierte una posición Y (px) a hora formateada "HH:MM" para vista día */
  function formatoHoraDesdeYDia(y: number): string {
    const mdi = (y / ALTURA_FILA_HORA) * 60
    const horaTotal = HORA_INICIO * 60 + mdi
    const h = Math.floor(horaTotal / 60)
    const m = Math.round(horaTotal % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  /** Convierte una posición Y (px) y una fecha a un objeto Date con hora correspondiente */
  function fechaDesdeYDia(dia: Date, y: number): Date {
    const mdi = (y / ALTURA_FILA_HORA) * 60
    const horaTotal = HORA_INICIO * 60 + mdi
    const h = Math.floor(horaTotal / 60)
    const m = Math.round(horaTotal % 60)
    const fecha = new Date(dia)
    fecha.setHours(h, m, 0, 0)
    return fecha
  }
  const { formatoHora } = useFormato()
  const { t } = useTraduccion()
  const es24h = formatoHora !== '12h'

  const refContenedor = useRef<HTMLDivElement>(null)
  /** Ref a la cuadrícula interior donde se renderizan las filas de hora */
  const refCuadricula = useRef<HTMLDivElement>(null)

  // --- Estado para selección de rango por arrastre (drag-to-select) ---
  const [seleccionDia, setSeleccionDia] = useState<EstadoSeleccionRangoDia | null>(null)
  const refSeleccionDia = useRef<EstadoSeleccionRangoDia | null>(null)
  refSeleccionDia.current = seleccionDia

  // --- Rango de horas activo para resaltar etiquetas de hora ---
  const [rangoHorasActivo, setRangoHorasActivo] = useState<{ horaInicio: number; horaFin: number } | null>(null)

  // --- Estado de hover crosshair (resaltado sutil de hora al pasar el mouse) ---
  const [hoverHora, setHoverHora] = useState<number | null>(null)

  // --- Estado para DragOverlay (evento activo durante arrastre) ---
  const [eventoDragActivo, setEventoDragActivo] = useState<EventoCalendario | null>(null)
  const [tipoDrag, setTipoDrag] = useState<'mover' | 'redimensionar' | null>(null)
  const [dragDeltaY, setDragDeltaY] = useState(0)

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
    return calcularPosiciones(eventosDelDia, fechaActual, HORA_INICIO, HORA_FIN)
  }, [eventosDelDia, fechaActual, HORA_INICIO, HORA_FIN])

  /** Filas de horas */
  const filasHoras = useMemo(() => {
    const filas: number[] = []
    for (let h = HORA_INICIO; h <= HORA_FIN; h++) filas.push(h)
    return filas
  }, [HORA_INICIO, HORA_FIN])

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
  }, [HORA_INICIO])

  // --- Handlers de selección por arrastre (drag-to-select) en vista día ---

  /** Altura total de la cuadrícula en px */
  const alturaTotalDia = (HORA_FIN - HORA_INICIO + 1) * ALTURA_FILA_HORA

  /**
   * Inicia la selección al hacer mousedown en un espacio vacío.
   */
  const manejarMouseDownDia = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const objetivo = e.target as HTMLElement
      if (objetivo.closest('[data-evento-bloque]')) return

      // Calcular Y relativo a la cuadrícula completa
      if (!refCuadricula.current) return
      const rect = refCuadricula.current.getBoundingClientRect()
      const y = redondearYA15MinDia(e.clientY - rect.top)

      setSeleccionDia({
        inicioY: y,
        finY: y,
        activa: true,
      })
    },
    [],
  )

  /** Touch: inicia selección */
  const manejarTouchStartDia = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const objetivo = e.target as HTMLElement
      if (objetivo.closest('[data-evento-bloque]')) return
      if (!refCuadricula.current) return
      const touch = e.touches[0]
      const rect = refCuadricula.current.getBoundingClientRect()
      const y = redondearYA15MinDia(touch.clientY - rect.top)
      setSeleccionDia({ inicioY: y, finY: y, activa: true })
    },
    [],
  )

  /** Touch: actualiza selección */
  const manejarTouchMoveDia = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!refSeleccionDia.current?.activa) return
      e.preventDefault() // Prevenir scroll durante drag-to-select
      if (!refCuadricula.current) return
      const touch = e.touches[0]
      const rect = refCuadricula.current.getBoundingClientRect()
      const yRelativo = touch.clientY - rect.top
      const yClamped = Math.max(0, Math.min(yRelativo, alturaTotalDia))
      const yRedondeado = redondearYA15MinDia(yClamped)
      setSeleccionDia((prev) => {
        if (!prev) return null
        const yMin = Math.min(prev.inicioY, yRedondeado)
        const yMax = Math.max(prev.inicioY, yRedondeado)
        setRangoHorasActivo({ horaInicio: horaDecimalDesdeYDia(yMin), horaFin: horaDecimalDesdeYDia(yMax) })
        return { ...prev, finY: yRedondeado }
      })
    },
    [alturaTotalDia],
  )

  /**
   * Actualiza el fin de la selección mientras se arrastra.
   */
  const manejarMouseMoveDia = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // --- Hover crosshair: rastrear posición del mouse para resaltar hora ---
      if (!refSeleccionDia.current?.activa && !eventoDragActivo) {
        if (refCuadricula.current) {
          const rectCuad = refCuadricula.current.getBoundingClientRect()
          const y = e.clientY - rectCuad.top
          const horaDecimal = HORA_INICIO + (y / ALTURA_FILA_HORA)
          setHoverHora(Math.floor(horaDecimal * 2) / 2)
        }
      } else {
        setHoverHora(null)
      }

      if (!refSeleccionDia.current?.activa) return
      if (!refCuadricula.current) return

      const rect = refCuadricula.current.getBoundingClientRect()
      const yRelativo = e.clientY - rect.top
      const yClamped = Math.max(0, Math.min(yRelativo, alturaTotalDia))
      const yRedondeado = redondearYA15MinDia(yClamped)

      setSeleccionDia((prev) => {
        if (!prev) return null
        // Actualizar rango activo para resaltar etiquetas de hora
        const yMin = Math.min(prev.inicioY, yRedondeado)
        const yMax = Math.max(prev.inicioY, yRedondeado)
        setRangoHorasActivo({ horaInicio: horaDecimalDesdeYDia(yMin), horaFin: horaDecimalDesdeYDia(yMax) })
        return { ...prev, finY: yRedondeado }
      })
    },
    [alturaTotalDia, eventoDragActivo],
  )

  /**
   * Finaliza la selección al soltar el mouse.
   */
  useEffect(() => {
    const manejarMouseUpDia = () => {
      const sel = refSeleccionDia.current
      if (!sel?.activa) return

      // Limpiar rango activo de etiquetas de hora
      setRangoHorasActivo(null)

      const yMin = Math.min(sel.inicioY, sel.finY)
      const yMax = Math.max(sel.inicioY, sel.finY)
      const alturaSeleccion = yMax - yMin

      const UMBRAL = (15 / 60) * ALTURA_FILA_HORA * 0.5

      if (alturaSeleccion > UMBRAL) {
        const fechaInicio = fechaDesdeYDia(fechaActual, yMin)
        const fechaFin = fechaDesdeYDia(fechaActual, yMax)
        onClickHora(fechaInicio, fechaFin)
      } else {
        const fechaClick = fechaDesdeYDia(fechaActual, yMin)
        onClickHora(fechaClick)
      }

      setSeleccionDia(null)
    }

    document.addEventListener('mouseup', manejarMouseUpDia)
    document.addEventListener('touchend', manejarMouseUpDia)
    return () => {
      document.removeEventListener('mouseup', manejarMouseUpDia)
      document.removeEventListener('touchend', manejarMouseUpDia)
    }
  }, [fechaActual, onClickHora])

  /**
   * Inicia el arrastre: guarda el evento activo y tipo para renderizar DragOverlay.
   */
  const manejarInicioDrag = useCallback((event: DragStartEvent) => {
    const idStr = event.active.id as string
    const esRedimensionar = idStr.startsWith('redimensionar-')
    const eventoId = esRedimensionar
      ? idStr.replace('redimensionar-', '')
      : idStr.replace('mover-', '')
    const evento = eventos.find(e => e.id === eventoId)
    if (evento) {
      setEventoDragActivo(evento)
      setTipoDrag(esRedimensionar ? 'redimensionar' : 'mover')
    }
  }, [eventos])

  /**
   * Cancela el arrastre: limpia el estado de DragOverlay.
   */
  const manejarCancelDrag = useCallback(() => {
    setEventoDragActivo(null)
    setTipoDrag(null)
    setDragDeltaY(0)
    setRangoHorasActivo(null)
  }, [])

  const manejarMovimientoDrag = useCallback((event: DragMoveEvent) => {
    if (event.delta) {
      setDragDeltaY(event.delta.y)

      // Actualizar rango de horas activo durante arrastre de evento
      const idStr = event.active.id as string
      const esRedimensionar = idStr.startsWith('redimensionar-')
      const eventoId = esRedimensionar ? idStr.replace('redimensionar-', '') : idStr.replace('mover-', '')
      const eventoOrig = eventos.find(e => e.id === eventoId)
      if (eventoOrig) {
        const inicio = new Date(eventoOrig.fecha_inicio)
        const fin = new Date(eventoOrig.fecha_fin)
        const deltaMin = Math.round((event.delta.y / ALTURA_FILA_HORA) * 60 / 15) * 15
        if (esRedimensionar) {
          const hInicio = inicio.getHours() + inicio.getMinutes() / 60
          const hFin = fin.getHours() + fin.getMinutes() / 60 + deltaMin / 60
          setRangoHorasActivo({ horaInicio: hInicio, horaFin: Math.max(hFin, hInicio + 0.25) })
        } else {
          const hInicio = inicio.getHours() + inicio.getMinutes() / 60 + deltaMin / 60
          const hFin = fin.getHours() + fin.getMinutes() / 60 + deltaMin / 60
          setRangoHorasActivo({ horaInicio: hInicio, horaFin: hFin })
        }
      }
    }
  }, [eventos])

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

      // No permitir mover visitas ni recorridos desde el calendario
      if (eventoOriginal._es_visita || eventoOriginal._es_recorrido) return

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

      // Limpiar estado de DragOverlay al finalizar arrastre
      setEventoDragActivo(null)
      setTipoDrag(null)
      setDragDeltaY(0)
      setRangoHorasActivo(null)
    },
    [eventos, onMoverEvento],
  )

  return (
    <DndContext
      sensors={sensores}
      onDragStart={manejarInicioDrag}
      onDragMove={manejarMovimientoDrag}
      onDragEnd={manejarFinArrastre}
      onDragCancel={manejarCancelDrag}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        role="grid"
        aria-label={t('calendario.a11y.calendario_diario')}
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
              <span className="text-xs text-texto-marca font-medium">{t('calendario.hoy')}</span>
            )}
          </div>
        </div>

        {/* Barra de eventos de todo el día */}
        {eventosTodoElDia.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-borde-sutil bg-superficie-app/50">
            <span className="text-xs text-texto-terciario mr-1 self-center">{t('calendario.todo_el_dia')}</span>
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
                {evento._es_visita && <MapPin size={10} className="inline-block mr-0.5" />}
                {evento._es_recorrido && <Route size={10} className="inline-block mr-0.5" />}
                {evento.titulo}
              </motion.button>
            ))}
          </div>
        )}

        {/* Cuadrícula horaria con scroll y soporte drag-to-select */}
        <div
          ref={refContenedor}
          className="flex-1 overflow-y-auto relative"
          onMouseMove={manejarMouseMoveDia}
          onTouchMove={manejarTouchMoveDia}
          onMouseLeave={() => setHoverHora(null)}
        >
          {/* Spacer para que la primera etiqueta de hora (-translate-y-1/2) sea visible */}
          <div className="shrink-0" style={{ height: 10 }} />
          <div
            ref={refCuadricula}
            className="relative cursor-crosshair touch-none"
            style={{ height: `${alturaTotalDia}px` }}
            onMouseDown={manejarMouseDownDia}
            onTouchStart={manejarTouchStartDia}
          >
            {/* Filas de horas */}
            {filasHoras.map((hora) => {
              const enRango = rangoHorasActivo !== null &&
                hora >= Math.floor(rangoHorasActivo.horaInicio) &&
                hora <= Math.ceil(rangoHorasActivo.horaFin - 0.01)

              // Hover crosshair: resaltar hora bajo el cursor (más sutil que el rango activo)
              const enHover = !enRango && hoverHora !== null && rangoHorasActivo === null &&
                hoverHora >= hora && hoverHora < hora + 1

              return (
                <div
                  key={hora}
                  className="absolute left-0 right-0 flex pointer-events-none"
                  style={{ top: `${(hora - HORA_INICIO) * ALTURA_FILA_HORA}px`, height: `${ALTURA_FILA_HORA}px` }}
                >
                  {/* Etiqueta de hora con resaltado de rango activo o hover */}
                  <div className="w-16 shrink-0 flex items-start">
                    {/* Barra vertical indicadora de rango activo o hover */}
                    <div
                      className="shrink-0 ml-1 -translate-y-1/2 rounded-full transition-colors duration-150"
                      style={{
                        width: enRango ? 3 : enHover ? 2 : 3,
                        height: 16,
                        backgroundColor: enRango
                          ? 'var(--texto-marca)'
                          : enHover
                            ? 'color-mix(in srgb, var(--texto-marca) 50%, transparent)'
                            : 'transparent',
                      }}
                    />
                    <span
                      className={[
                        'text-xs -translate-y-1/2 ml-auto mr-2 transition-colors duration-150',
                        enRango
                          ? 'text-texto-marca font-bold'
                          : enHover
                            ? 'text-texto-marca/70 font-medium'
                            : 'text-texto-terciario',
                      ].join(' ')}
                    >
                      {formatearEtiquetaHora(hora, es24h)}
                    </span>
                  </div>

                  {/* Línea separadora */}
                  <div className="flex-1 border-t border-borde-sutil" />
                </div>
              )
            })}

            {/* Resaltado de selección por arrastre (drag-to-select) */}
            {seleccionDia?.activa && (() => {
              const yMin = Math.min(seleccionDia.inicioY, seleccionDia.finY)
              const yMax = Math.max(seleccionDia.inicioY, seleccionDia.finY)
              const alturaBloque = Math.max(yMax - yMin, (15 / 60) * ALTURA_FILA_HORA)

              return (
                <div
                  className="absolute left-16 right-2 rounded-md z-10 pointer-events-none flex flex-col justify-between p-1.5"
                  style={{
                    top: yMin,
                    height: alturaBloque,
                    backgroundColor: 'color-mix(in srgb, var(--texto-marca) 15%, transparent)',
                    borderLeft: '3px solid var(--texto-marca)',
                  }}
                >
                  <span className="text-[10px] sm:text-[11px] font-semibold select-none" style={{ color: 'var(--texto-marca)' }}>
                    {formatoHoraDesdeYDia(yMin)} – {formatoHoraDesdeYDia(yMax)}
                    <span className="opacity-60 ml-1 font-normal">· {formatearDuracionDesdeY(seleccionDia.inicioY, seleccionDia.finY, ALTURA_FILA_HORA)}</span>
                  </span>
                  {alturaBloque > 40 && (
                    <span className="text-[9px] sm:text-[10px] select-none" style={{ color: 'var(--texto-marca)', opacity: 0.6 }}>
                      {formatoHoraDesdeYDia(yMax)}
                    </span>
                  )}
                </div>
              )
            })()}

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
                  es24h={es24h}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overlay flotante que sigue al cursor durante el arrastre de mover */}
      <DragOverlay dropAnimation={null}>
        {eventoDragActivo && tipoDrag === 'mover' && (() => {
          const color = eventoDragActivo.color || 'var(--texto-marca)'
          const inicio = new Date(eventoDragActivo.fecha_inicio)
          const fin = new Date(eventoDragActivo.fecha_fin)
          const durMin = (fin.getTime() - inicio.getTime()) / 60000
          const altura = Math.max(durMin * (ALTURA_FILA_HORA / 60), 24)

          // Calcular nuevas horas en tiempo real
          const deltaMinutos = Math.round((dragDeltaY / ALTURA_FILA_HORA) * 60 / 15) * 15
          const nuevaInicio = new Date(inicio.getTime() + deltaMinutos * 60000)
          const nuevaFin = new Date(fin.getTime() + deltaMinutos * 60000)
          const hI = formatearHoraCorta(nuevaInicio, es24h)
          const hF = formatearHoraCorta(nuevaFin, es24h)

          return (
            <div
              className="rounded-md overflow-hidden px-2.5 py-1.5 shadow-2xl ring-2 ring-texto-marca/30 pointer-events-none"
              style={{
                width: 250,
                height: altura,
                backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                borderLeft: `3px solid ${color}`,
                color: color,
              }}
            >
              <span className="text-sm font-medium truncate block">{eventoDragActivo.titulo}</span>
              <span className="text-xs opacity-70 block">
                {hI} – {hF}
                <span className="opacity-60 ml-1">· {formatearDuracion(nuevaInicio, nuevaFin)}</span>
              </span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}

export { VistaCalendarioDia }
