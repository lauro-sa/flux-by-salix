'use client'

/**
 * VistaCalendarioSemana — Vista semanal del calendario con cuadrícula horaria.
 * Muestra 7 columnas (lun–dom) con franjas de 06:00 a 22:00.
 * Eventos posicionados según hora y duración, con detección de solapamiento.
 * Soporta drag-and-drop para mover eventos (cambio de día y hora) y redimensionar.
 * Se usa en: página principal del calendario (vista semana).
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
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
import type { EventoCalendario } from './tipos'

// --- Constantes ---

/** Hora de inicio de la cuadrícula */
const HORA_INICIO = 6
/** Hora de fin de la cuadrícula */
const HORA_FIN = 22
/** Altura en px de cada fila de 1 hora */
const ALTURA_FILA = 60
/** Máximo de eventos todo-el-día visibles antes de "+N más" */
const MAX_TODO_DIA = 2
/** Ancho de la columna de horas en px */
const ANCHO_COLUMNA_HORAS = 56
/** Umbral mínimo en px antes de iniciar arrastre (evita conflictos con click) */
const UMBRAL_ARRASTRE = 5

/** Nombres cortos de días (lunes primero) */
const NOMBRES_DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

// --- Utilidades de fecha ---

/** Genera las horas del eje vertical: [6, 7, ..., 22] */
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

/** Convierte hora y minutos a posición Y en píxeles dentro de la cuadrícula */
function tiempoAPx(horas: number, minutos: number): number {
  return (horas * 60 + minutos - HORA_INICIO * 60) * (ALTURA_FILA / 60)
}

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

/** Inicio de semana (lunes) para una fecha dada */
function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diff)
  return d
}

/** Genera los 7 días de la semana que contiene la fecha dada (lun–dom) */
function diasDeLaSemana(fecha: Date): Date[] {
  const lunes = inicioSemana(fecha)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

/** Formatea fecha como YYYY-MM-DD para usar como clave de mapa */
function claveDelDia(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Formatea hora corta desde un Date: "09:30" */
function formatearHoraCorta(fecha: Date): string {
  return fecha.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Parsea un string ISO a Date */
function parsearFecha(iso: string): Date {
  return new Date(iso)
}

/** Obtiene índice del día en la semana (0=lun, 6=dom) para obtener nombre */
function indiceDiaSemana(fecha: Date): number {
  const dia = fecha.getDay()
  return dia === 0 ? 6 : dia - 1
}

// --- Detección de solapamiento ---

interface EventoPosicionado {
  evento: EventoCalendario
  /** Minutos desde HORA_INICIO */
  inicioMin: number
  finMin: number
  /** Índice de columna dentro del grupo solapado */
  columna: number
  /** Total de columnas en el grupo solapado */
  totalColumnas: number
}

/**
 * Agrupa eventos solapados y asigna columnas side-by-side.
 * Algoritmo: ordenar por inicio, agrupar en clusters solapados,
 * asignar columna incremental dentro de cada cluster.
 */
function calcularPosiciones(eventosDelDia: EventoCalendario[]): EventoPosicionado[] {
  const conHora = eventosDelDia
    .filter((e) => !e.todo_el_dia)
    .map((evento) => {
      const inicio = parsearFecha(evento.fecha_inicio)
      const fin = parsearFecha(evento.fecha_fin)
      const inicioMin = inicio.getHours() * 60 + inicio.getMinutes() - HORA_INICIO * 60
      const finMin = fin.getHours() * 60 + fin.getMinutes() - HORA_INICIO * 60
      return { evento, inicioMin, finMin: Math.max(finMin, inicioMin + 15) }
    })
    .sort((a, b) => a.inicioMin - b.inicioMin || a.finMin - b.finMin)

  if (conHora.length === 0) return []

  const clusters: (typeof conHora)[] = []
  let clusterActual = [conHora[0]]

  for (let i = 1; i < conHora.length; i++) {
    const item = conHora[i]
    const finMaxCluster = Math.max(...clusterActual.map((c) => c.finMin))
    if (item.inicioMin < finMaxCluster) {
      clusterActual.push(item)
    } else {
      clusters.push(clusterActual)
      clusterActual = [item]
    }
  }
  clusters.push(clusterActual)

  const resultado: EventoPosicionado[] = []
  for (const cluster of clusters) {
    const totalColumnas = cluster.length
    for (let col = 0; col < cluster.length; col++) {
      const { evento, inicioMin, finMin } = cluster[col]
      resultado.push({ evento, inicioMin, finMin, columna: col, totalColumnas })
    }
  }

  return resultado
}

// --- Componente de evento arrastrable ---

interface PropiedadesEventoArrastrable {
  evento: EventoCalendario
  posicion: EventoPosicionado
  onClickEvento: (evento: EventoCalendario) => void
}

/**
 * BloqueEventoArrastrable — Envuelve un evento de la cuadrícula con drag-and-drop.
 * Soporta arrastre para mover (cuerpo completo) y redimensionar (asa inferior).
 */
function BloqueEventoArrastrable({
  evento,
  posicion,
  onClickEvento,
}: PropiedadesEventoArrastrable) {
  const { inicioMin, finMin, columna, totalColumnas } = posicion
  const duracionMin = finMin - inicioMin
  const alturaPx = Math.max(duracionMin * (ALTURA_FILA / 60), 20)
  const topPx = inicioMin * (ALTURA_FILA / 60)
  const anchoPorc = 100 / totalColumnas
  const izquierdaPorc = columna * anchoPorc
  const colorEvento = evento.color || 'var(--texto-marca)'
  const inicioDate = parsearFecha(evento.fecha_inicio)
  const finDate = parsearFecha(evento.fecha_fin)
  const esCorto = alturaPx < 35

  // Hook para arrastrar el evento completo (mover)
  const {
    attributes: atributosMover,
    listeners: escuchasMover,
    setNodeRef: refNodoMover,
    transform: transformMover,
    isDragging: estaArrastrandoMover,
  } = useDraggable({ id: `mover-${evento.id}` })

  // Hook para redimensionar (asa inferior)
  const {
    attributes: atributosRedimensionar,
    listeners: escuchasRedimensionar,
    setNodeRef: refNodoRedimensionar,
    transform: transformRedimensionar,
    isDragging: estaRedimensionando,
  } = useDraggable({ id: `redimensionar-${evento.id}` })

  // Estilo de transformación durante el arrastre de mover
  const estiloTransformMover = transformMover
    ? {
        transform: `translate(${transformMover.x}px, ${transformMover.y}px)`,
        zIndex: 50,
        opacity: 1,
      }
    : {}

  // Altura con redimensionado aplicado (solo cambia el alto)
  const alturaConRedimensionado = estaRedimensionando && transformRedimensionar
    ? Math.max(alturaPx + transformRedimensionar.y, 15)
    : alturaPx

  const estiloBase = {
    top: topPx,
    left: `calc(${izquierdaPorc}% + 2px)`,
    width: `calc(${anchoPorc}% - 4px)`,
    backgroundColor: `color-mix(in srgb, ${colorEvento} 25%, transparent)`,
    borderLeft: `3px solid ${colorEvento}`,
    color: colorEvento,
  }

  return (
      /* Bloque original — cuando se arrastra para mover, se vuelve fantasma (DragOverlay muestra la copia flotante) */
      <motion.div
        ref={refNodoMover}
        data-evento-bloque
        {...atributosMover}
        {...escuchasMover}
        whileHover={!estaArrastrandoMover ? { scale: 1.02 } : undefined}
        transition={{ duration: 0.1 }}
        onClick={(e) => {
          if (!estaArrastrandoMover && !estaRedimensionando) {
            e.stopPropagation()
            onClickEvento(evento)
          }
        }}
        className={[
          'absolute z-10 rounded-md overflow-hidden text-left cursor-grab px-1.5 py-0.5 select-none transition-shadow',
          estaArrastrandoMover ? 'cursor-grabbing' : '',
          estaRedimensionando ? 'shadow-lg ring-1 ring-texto-marca/20' : '',
        ].join(' ')}
        style={{
          ...estiloBase,
          height: alturaConRedimensionado,
          // Al mover: el original queda como fantasma en su lugar, DragOverlay muestra la copia flotante
          opacity: estaArrastrandoMover ? 0.3 : 1,
          borderStyle: estaArrastrandoMover ? 'dashed' : 'solid',
          // No aplicar transform al original — DragOverlay se encarga del movimiento visual
          ...(!estaArrastrandoMover ? estiloTransformMover : {}),
        }}
      >
      {esCorto ? (
        <span className="text-[11px] leading-tight truncate block font-medium">
          {evento.titulo}
        </span>
      ) : (
        <>
          <span className="text-[11px] leading-tight truncate block font-medium">
            {evento.titulo}
          </span>
          <span className="text-[10px] leading-tight opacity-70 block">
            {formatearHoraCorta(inicioDate)} – {formatearHoraCorta(finDate)}
          </span>
        </>
      )}

      {/* Asa de redimensionado en la parte inferior */}
      <div
        ref={refNodoRedimensionar}
        {...atributosRedimensionar}
        {...escuchasRedimensionar}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize group/asa flex items-center justify-center"
      >
        <div className="w-6 h-0.5 rounded-full bg-current opacity-0 group-hover/asa:opacity-40 transition-opacity" />
      </div>
    </motion.div>
  )
}

// --- Componente principal ---

interface PropiedadesVistaSemana {
  fechaActual: Date
  eventos: EventoCalendario[]
  /** Click en franja vacía → crear evento; fechaFin opcional si se arrastró un rango */
  onClickHora: (fecha: Date, fechaFin?: Date) => void
  /** Click en evento → editar */
  onClickEvento: (evento: EventoCalendario) => void
  /** Drag para mover evento */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
}

/** Estado de la selección por arrastre (drag-to-select) */
interface EstadoSeleccionRango {
  /** Día de la columna donde inició el arrastre */
  dia: Date
  /** Posición Y inicial relativa a la columna (en px) */
  inicioY: number
  /** Posición Y actual relativa a la columna (en px) */
  finY: number
  /** Si el arrastre está activo (mousedown sin mouseup) */
  activa: boolean
}

/**
 * Redondea una posición Y a intervalos de 15 minutos dentro de la cuadrícula.
 * Devuelve la posición redondeada en px.
 */
function redondearYA15Min(y: number): number {
  const minutos = (y / ALTURA_FILA) * 60
  const minutosRedondeados = Math.round(minutos / 15) * 15
  return (minutosRedondeados / 60) * ALTURA_FILA
}

/** Convierte una posición Y (px) a hora decimal (ej: 8.5 = 08:30) */
function horaDecimalDesdeYSemana(y: number): number {
  return HORA_INICIO + (y / ALTURA_FILA)
}

/**
 * Convierte una posición Y (px) a hora formateada "HH:MM".
 * Se usa para mostrar etiquetas durante la selección por arrastre.
 */
function formatoHoraDesdeY(y: number): string {
  const minutosDesdeInicio = (y / ALTURA_FILA) * 60
  const horaTotal = HORA_INICIO * 60 + minutosDesdeInicio
  const horas = Math.floor(horaTotal / 60)
  const minutos = Math.round(horaTotal % 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/**
 * Convierte una posición Y (px) y un día a un objeto Date con hora correspondiente.
 */
function fechaDesdeY(dia: Date, y: number): Date {
  const minutosDesdeInicio = (y / ALTURA_FILA) * 60
  const horaTotal = HORA_INICIO * 60 + minutosDesdeInicio
  const horas = Math.floor(horaTotal / 60)
  const minutos = Math.round(horaTotal % 60)
  const fecha = new Date(dia)
  fecha.setHours(horas, minutos, 0, 0)
  return fecha
}

function VistaCalendarioSemana({
  fechaActual,
  eventos,
  onClickHora,
  onClickEvento,
  onMoverEvento,
}: PropiedadesVistaSemana) {
  const refCuadricula = useRef<HTMLDivElement>(null)
  const refColumnas = useRef<HTMLDivElement>(null)
  const [minutosAhora, setMinutosAhora] = useState(() => {
    const ahora = new Date()
    return ahora.getHours() * 60 + ahora.getMinutes()
  })

  // --- Estado para selección de rango por arrastre (drag-to-select) ---
  const [seleccion, setSeleccion] = useState<EstadoSeleccionRango | null>(null)
  /** Ref para acceder al estado actual de selección dentro de listeners del documento */
  const refSeleccion = useRef<EstadoSeleccionRango | null>(null)
  refSeleccion.current = seleccion

  // --- Rango de horas activo para resaltar etiquetas de hora ---
  const [rangoHorasActivo, setRangoHorasActivo] = useState<{ horaInicio: number; horaFin: number } | null>(null)

  // --- Estado para DragOverlay (evento activo durante arrastre) ---
  const [eventoDragActivo, setEventoDragActivo] = useState<EventoCalendario | null>(null)
  const [alturaDragActivo, setAlturaDragActivo] = useState(60)
  const [tipoDrag, setTipoDrag] = useState<'mover' | 'redimensionar' | null>(null)
  const [dragDeltaY, setDragDeltaY] = useState(0)
  const [dragDeltaX, setDragDeltaX] = useState(0)

  // Sensor con umbral de distancia para diferenciar click de arrastre
  const sensores = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: UMBRAL_ARRASTRE },
    }),
  )

  // --- Actualizar línea de hora actual cada minuto ---
  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date()
      setMinutosAhora(ahora.getHours() * 60 + ahora.getMinutes())
    }, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  // --- Días de la semana (lunes a domingo) ---
  const diasSemana = useMemo(() => diasDeLaSemana(fechaActual), [fechaActual])

  // --- Eventos agrupados por día ---
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()

    for (const evento of eventos) {
      const fechaInicio = parsearFecha(evento.fecha_inicio)
      const fechaFin = parsearFecha(evento.fecha_fin)

      for (const dia of diasSemana) {
        const inicioDia = new Date(dia)
        inicioDia.setHours(0, 0, 0, 0)
        const finDia = new Date(dia)
        finDia.setHours(23, 59, 59, 999)

        if (fechaInicio <= finDia && fechaFin >= inicioDia) {
          const clave = claveDelDia(dia)
          if (!mapa.has(clave)) mapa.set(clave, [])
          mapa.get(clave)!.push(evento)
        }
      }
    }

    return mapa
  }, [eventos, diasSemana])

  // --- Eventos todo el día ---
  const eventosTodoDiaPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()
    for (const [clave, evs] of eventosPorDia) {
      const todoDia = evs.filter((e) => e.todo_el_dia)
      if (todoDia.length > 0) mapa.set(clave, todoDia)
    }
    return mapa
  }, [eventosPorDia])

  // --- Posiciones calculadas por día (solo eventos con hora) ---
  const posicionesPorDia = useMemo(() => {
    const mapa = new Map<string, EventoPosicionado[]>()
    for (const [clave, evs] of eventosPorDia) {
      const posiciones = calcularPosiciones(evs)
      if (posiciones.length > 0) mapa.set(clave, posiciones)
    }
    return mapa
  }, [eventosPorDia])

  // --- Auto-scroll al montar: ir a la hora actual o 08:00 (la menor) ---
  useEffect(() => {
    if (!refCuadricula.current) return
    const ahora = new Date()
    const horaObjetivo = Math.min(ahora.getHours(), 8)
    const scrollY = tiempoAPx(horaObjetivo, 0)
    refCuadricula.current.scrollTop = scrollY
  }, [])

  // --- Altura total de la cuadrícula ---
  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTURA_FILA

  // --- Handlers de selección por arrastre (drag-to-select) ---

  /**
   * Inicia la selección al hacer mousedown en un espacio vacío de la columna.
   * No se activa si el click fue sobre un bloque de evento (useDraggable de @dnd-kit).
   */
  const manejarMouseDown = useCallback(
    (dia: Date, e: React.MouseEvent<HTMLDivElement>) => {
      // Solo botón izquierdo
      if (e.button !== 0) return
      // Evitar activar si el clic fue sobre un evento (elemento hijo con z-10)
      const objetivo = e.target as HTMLElement
      if (objetivo !== e.currentTarget && objetivo.closest('[data-evento-bloque]')) return

      const rect = e.currentTarget.getBoundingClientRect()
      const y = redondearYA15Min(e.clientY - rect.top)

      setSeleccion({
        dia,
        inicioY: y,
        finY: y,
        activa: true,
      })
    },
    [],
  )

  /**
   * Actualiza el fin de la selección mientras se arrastra.
   * Se escucha en el contenedor de columnas para permitir arrastre fluido.
   */
  const manejarMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!refSeleccion.current?.activa) return

      // Obtener la columna del día correspondiente a la selección
      const claveSeleccion = claveDelDia(refSeleccion.current.dia)
      const columnaDiv = e.currentTarget.querySelector(
        `[data-dia-clave="${claveSeleccion}"]`,
      ) as HTMLElement | null
      if (!columnaDiv) return

      const rect = columnaDiv.getBoundingClientRect()
      const yRelativo = e.clientY - rect.top
      // Limitar entre 0 y la altura total de la cuadrícula
      const yClamped = Math.max(0, Math.min(yRelativo, alturaTotal))
      const yRedondeado = redondearYA15Min(yClamped)

      setSeleccion((prev) => {
        if (!prev) return null
        // Actualizar rango activo para resaltar etiquetas de hora
        const yMin = Math.min(prev.inicioY, yRedondeado)
        const yMax = Math.max(prev.inicioY, yRedondeado)
        setRangoHorasActivo({ horaInicio: horaDecimalDesdeYSemana(yMin), horaFin: horaDecimalDesdeYSemana(yMax) })
        return { ...prev, finY: yRedondeado }
      })
    },
    [alturaTotal],
  )

  /**
   * Finaliza la selección por arrastre al soltar el mouse.
   * Si la selección tiene altura mínima (>= 15 min), llama onClickHora con rango.
   * Si no, se trata como un click simple en la cuadrícula.
   */
  useEffect(() => {
    const manejarMouseUp = () => {
      const sel = refSeleccion.current
      if (!sel?.activa) return

      // Limpiar rango activo de etiquetas de hora
      setRangoHorasActivo(null)

      const yMin = Math.min(sel.inicioY, sel.finY)
      const yMax = Math.max(sel.inicioY, sel.finY)
      const alturaSeleccion = yMax - yMin

      // Umbral mínimo: si la diferencia es menor a ~7px (medio intervalo de 15 min),
      // se trata como click simple (sin rango de fin)
      const UMBRAL_ARRASTRE_SELECCION = (15 / 60) * ALTURA_FILA * 0.5

      if (alturaSeleccion > UMBRAL_ARRASTRE_SELECCION) {
        // Selección con rango: pasar inicio y fin
        const fechaInicio = fechaDesdeY(sel.dia, yMin)
        const fechaFin = fechaDesdeY(sel.dia, yMax)
        onClickHora(fechaInicio, fechaFin)
      } else {
        // Click simple: sin rango
        const fechaClick = fechaDesdeY(sel.dia, yMin)
        onClickHora(fechaClick)
      }

      setSeleccion(null)
    }

    document.addEventListener('mouseup', manejarMouseUp)
    return () => document.removeEventListener('mouseup', manejarMouseUp)
  }, [onClickHora])

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
      // Calcular altura del bloque en px
      const inicio = parsearFecha(evento.fecha_inicio)
      const fin = parsearFecha(evento.fecha_fin)
      const durMin = (fin.getTime() - inicio.getTime()) / 60000
      setAlturaDragActivo(Math.max(durMin * (ALTURA_FILA / 60), 20))
    }
  }, [eventos])

  /**
   * Cancela el arrastre: limpia el estado de DragOverlay.
   */
  const manejarCancelDrag = useCallback(() => {
    setEventoDragActivo(null)
    setTipoDrag(null)
    setDragDeltaY(0)
    setDragDeltaX(0)
    setRangoHorasActivo(null)
  }, [])

  const manejarMovimientoDrag = useCallback((event: DragMoveEvent) => {
    if (event.delta) {
      setDragDeltaY(event.delta.y)
      setDragDeltaX(event.delta.x)

      // Actualizar rango de horas activo durante arrastre de evento
      const idStr = event.active.id as string
      const esRedimensionar = idStr.startsWith('redimensionar-')
      const eventoId = esRedimensionar ? idStr.replace('redimensionar-', '') : idStr.replace('mover-', '')
      const eventoOrig = eventos.find(e => e.id === eventoId)
      if (eventoOrig) {
        const inicio = parsearFecha(eventoOrig.fecha_inicio)
        const fin = parsearFecha(eventoOrig.fecha_fin)
        const deltaMin = Math.round((event.delta.y / ALTURA_FILA) * 60 / 15) * 15
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
   * Maneja el fin de un arrastre (mover o redimensionar).
   * Calcula la nueva fecha/hora basándose en el delta de píxeles.
   */
  const manejarFinArrastre = useCallback(
    (event: DragEndEvent) => {
      if (!onMoverEvento || !event.delta) return

      const { active, delta } = event
      const idArrastrable = active.id as string

      // Determinar si es mover o redimensionar
      const esRedimensionar = idArrastrable.startsWith('redimensionar-')
      const eventoId = esRedimensionar
        ? idArrastrable.replace('redimensionar-', '')
        : idArrastrable.replace('mover-', '')

      // Buscar el evento original
      const eventoOriginal = eventos.find((e) => e.id === eventoId)
      if (!eventoOriginal) return

      const inicioOriginal = parsearFecha(eventoOriginal.fecha_inicio)
      const finOriginal = parsearFecha(eventoOriginal.fecha_fin)

      // Calcular delta en minutos (eje Y) redondeado a 15 min
      const deltaMinutos = Math.round((delta.y / ALTURA_FILA) * 60 / 15) * 15

      if (esRedimensionar) {
        // Solo cambiar la hora de fin
        const nuevaFin = new Date(finOriginal)
        nuevaFin.setMinutes(nuevaFin.getMinutes() + deltaMinutos)

        // Evitar que la fin sea antes del inicio
        if (nuevaFin <= inicioOriginal) return

        onMoverEvento(eventoId, inicioOriginal.toISOString(), nuevaFin.toISOString())
      } else {
        // Calcular delta en días (eje X) basado en ancho de columna
        let deltaDias = 0
        if (refColumnas.current) {
          const anchoCuadricula = refColumnas.current.getBoundingClientRect().width
          const anchoColumna = anchoCuadricula / 7
          deltaDias = Math.round(delta.x / anchoColumna)
        }

        const nuevaInicio = new Date(inicioOriginal)
        nuevaInicio.setDate(nuevaInicio.getDate() + deltaDias)
        nuevaInicio.setMinutes(nuevaInicio.getMinutes() + deltaMinutos)

        const nuevaFin = new Date(finOriginal)
        nuevaFin.setDate(nuevaFin.getDate() + deltaDias)
        nuevaFin.setMinutes(nuevaFin.getMinutes() + deltaMinutos)

        onMoverEvento(eventoId, nuevaInicio.toISOString(), nuevaFin.toISOString())
      }

      // Limpiar estado de DragOverlay al finalizar arrastre
      setEventoDragActivo(null)
      setTipoDrag(null)
      setDragDeltaY(0)
      setDragDeltaX(0)
      setRangoHorasActivo(null)
    },
    [eventos, onMoverEvento],
  )

  // --- Posición Y de la línea de hora actual ---
  const lineaAhoraPx = tiempoAPx(Math.floor(minutosAhora / 60), minutosAhora % 60)
  const lineaAhoraVisible =
    minutosAhora >= HORA_INICIO * 60 && minutosAhora <= HORA_FIN * 60

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
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Encabezado: días de la semana */}
        <div className="flex border-b border-borde-sutil shrink-0">
          {/* Esquina vacía (columna de horas) */}
          <div
            className="shrink-0 border-r border-borde-sutil"
            style={{ width: ANCHO_COLUMNA_HORAS }}
          />

          {/* Nombres y números de días */}
          <div className="grid grid-cols-7 flex-1">
            {diasSemana.map((dia: Date) => {
              const hoyFlag = esHoy(dia)
              return (
                <div
                  key={claveDelDia(dia)}
                  className="flex flex-col items-center py-2 border-r border-borde-sutil last:border-r-0"
                >
                  <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                    {NOMBRES_DIAS[indiceDiaSemana(dia)]}
                  </span>
                  <span
                    className={[
                      'mt-0.5 flex items-center justify-center size-7 rounded-full text-sm font-semibold leading-none',
                      hoyFlag
                        ? 'bg-texto-marca/10 text-texto-marca'
                        : 'text-texto-primario',
                    ].join(' ')}
                  >
                    {dia.getDate()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Barra de eventos todo el día */}
        {eventosTodoDiaPorDia.size > 0 && (
          <div className="flex border-b border-borde-sutil shrink-0">
            {/* Etiqueta */}
            <div
              className="shrink-0 flex items-start justify-end pr-2 pt-1 text-[10px] text-texto-terciario border-r border-borde-sutil"
              style={{ width: ANCHO_COLUMNA_HORAS }}
            >
              Todo el día
            </div>

            {/* Píldoras por columna */}
            <div className="grid grid-cols-7 flex-1">
              {diasSemana.map((dia: Date) => {
                const clave = claveDelDia(dia)
                const eventosDia = eventosTodoDiaPorDia.get(clave) || []
                const visibles = eventosDia.slice(0, MAX_TODO_DIA)
                const restantes = eventosDia.length - MAX_TODO_DIA

                return (
                  <div
                    key={clave}
                    className="flex flex-col gap-0.5 p-1 border-r border-borde-sutil last:border-r-0 min-h-[28px] overflow-hidden min-w-0"
                  >
                    {visibles.map((evento) => (
                      <button
                        key={evento.id}
                        type="button"
                        onClick={() => onClickEvento(evento)}
                        title={evento.titulo}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] leading-tight transition-opacity hover:opacity-80 block"
                        style={{
                          backgroundColor: evento.color
                            ? `${evento.color}40`
                            : 'var(--superficie-elevada)',
                          color: evento.color || 'var(--texto-primario)',
                        }}
                      >
                        {evento.titulo}
                      </button>
                    ))}
                    {restantes > 0 && (
                      <span className="text-[10px] text-texto-terciario pl-1">
                        +{restantes} más
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cuadrícula horaria (scrollable) */}
        <div ref={refCuadricula} className="flex-1 overflow-y-auto min-h-0">
          <div className="flex relative" style={{ height: alturaTotal }}>
            {/* Columna de etiquetas de hora con resaltado de rango activo */}
            <div
              className="shrink-0 relative border-r border-borde-sutil"
              style={{ width: ANCHO_COLUMNA_HORAS }}
            >
              {HORAS.map((hora) => {
                const enRango = rangoHorasActivo !== null &&
                  hora >= Math.floor(rangoHorasActivo.horaInicio) &&
                  hora < Math.ceil(rangoHorasActivo.horaFin)

                return (
                  <div
                    key={hora}
                    className="absolute flex items-center -translate-y-1/2"
                    style={{ top: tiempoAPx(hora, 0), left: 0, right: 0 }}
                  >
                    {/* Barra vertical indicadora de rango activo */}
                    <div
                      className="w-[3px] h-4 rounded-full shrink-0 ml-1 transition-colors duration-150"
                      style={{
                        backgroundColor: enRango ? 'var(--texto-marca)' : 'transparent',
                      }}
                    />
                    <span
                      className={[
                        'text-xs leading-none ml-auto mr-2 transition-colors duration-150',
                        enRango
                          ? 'text-texto-marca font-bold'
                          : 'text-texto-terciario',
                      ].join(' ')}
                    >
                      {String(hora).padStart(2, '0')}:00
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Columnas de días */}
            <div ref={refColumnas} className="grid grid-cols-7 flex-1 relative" onMouseMove={manejarMouseMove}>
              {/* Líneas horizontales de horas completas */}
              {HORAS.map((hora) => (
                <div
                  key={`linea-hora-${hora}`}
                  className="absolute left-0 right-0 border-t border-borde-sutil pointer-events-none"
                  style={{ top: tiempoAPx(hora, 0) }}
                />
              ))}

              {/* Líneas punteadas de media hora */}
              {HORAS.slice(0, -1).map((hora) => (
                <div
                  key={`linea-media-${hora}`}
                  className="absolute left-0 right-0 border-t border-dashed border-borde-sutil/50 pointer-events-none"
                  style={{ top: tiempoAPx(hora, 30) }}
                />
              ))}

              {/* Columnas individuales de cada día con soporte drag-to-select */}
              {diasSemana.map((dia: Date) => {
                const clave = claveDelDia(dia)
                const posiciones = posicionesPorDia.get(clave) || []
                const hoyFlag = esHoy(dia)
                // Verificar si hay selección activa en esta columna
                const seleccionEnEsteDia =
                  seleccion?.activa && claveDelDia(seleccion.dia) === clave

                return (
                  <div
                    key={clave}
                    data-dia-clave={clave}
                    className={[
                      'relative border-r border-borde-sutil last:border-r-0 cursor-crosshair',
                      hoyFlag ? 'bg-texto-marca/[0.03]' : '',
                    ].join(' ')}
                    onMouseDown={(e) => manejarMouseDown(dia, e)}
                  >
                    {/* Indicador de hora actual (línea roja) */}
                    {hoyFlag && lineaAhoraVisible && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ top: lineaAhoraPx }}
                      >
                        <div className="size-2 rounded-full -ml-1 shrink-0" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
                        <div className="flex-1 h-[2px]" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
                      </div>
                    )}

                    {/* Resaltado de selección por arrastre (drag-to-select) */}
                    {seleccionEnEsteDia && seleccion && (
                      <div
                        className="absolute left-1 right-1 rounded-md z-10 pointer-events-none flex items-start p-1"
                        style={{
                          top: Math.min(seleccion.inicioY, seleccion.finY),
                          height: Math.max(
                            Math.abs(seleccion.finY - seleccion.inicioY),
                            (15 / 60) * ALTURA_FILA,
                          ),
                          backgroundColor: 'var(--texto-marca)',
                          opacity: 0.15,
                        }}
                      >
                        <span
                          className="text-[10px] font-medium pointer-events-none select-none"
                          style={{ color: 'var(--texto-marca)', opacity: 1 }}
                        >
                          {formatoHoraDesdeY(Math.min(seleccion.inicioY, seleccion.finY))}
                          {' – '}
                          {formatoHoraDesdeY(Math.max(seleccion.inicioY, seleccion.finY))}
                        </span>
                      </div>
                    )}

                    {/* Eventos posicionados como bloques arrastrables */}
                    {posiciones.map((posicion) => (
                      <BloqueEventoArrastrable
                        key={posicion.evento.id}
                        evento={posicion.evento}
                        posicion={posicion}
                        onClickEvento={onClickEvento}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overlay flotante que sigue al cursor durante el arrastre de mover */}
      <DragOverlay dropAnimation={null}>
        {eventoDragActivo && tipoDrag === 'mover' && (() => {
          const color = eventoDragActivo.color || 'var(--texto-marca)'
          const inicio = parsearFecha(eventoDragActivo.fecha_inicio)
          const fin = parsearFecha(eventoDragActivo.fecha_fin)

          // Calcular nuevas horas basándose en el delta actual
          const deltaMinutos = Math.round((dragDeltaY / ALTURA_FILA) * 60 / 15) * 15
          const nuevaInicio = new Date(inicio.getTime() + deltaMinutos * 60000)
          const nuevaFin = new Date(fin.getTime() + deltaMinutos * 60000)

          // Calcular nuevo día
          let deltaDias = 0
          if (refColumnas.current) {
            const anchoColumna = refColumnas.current.getBoundingClientRect().width / 7
            deltaDias = Math.round(dragDeltaX / anchoColumna)
          }
          if (deltaDias !== 0) {
            nuevaInicio.setDate(nuevaInicio.getDate() + deltaDias)
            nuevaFin.setDate(nuevaFin.getDate() + deltaDias)
          }

          const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

          return (
            <div
              className="rounded-md overflow-hidden px-1.5 py-1 shadow-2xl ring-2 ring-texto-marca/30 pointer-events-none"
              style={{
                width: 150,
                height: alturaDragActivo,
                backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                borderLeft: `3px solid ${color}`,
                color: color,
              }}
            >
              <span className="text-[11px] font-medium truncate block">{eventoDragActivo.titulo}</span>
              <span className="text-[10px] opacity-70 block">
                {deltaDias !== 0 && `${DIAS_CORTOS[nuevaInicio.getDay()]} ${nuevaInicio.getDate()} · `}
                {formatearHoraCorta(nuevaInicio)} – {formatearHoraCorta(nuevaFin)}
              </span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}

export { VistaCalendarioSemana }
