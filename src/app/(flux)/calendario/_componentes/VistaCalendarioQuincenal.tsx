'use client'

/**
 * VistaCalendarioQuincenal — Vista quincenal (14 dias) del calendario con cuadricula horaria.
 * Muestra 14 columnas (2 semanas) con franjas de 06:00 a 22:00.
 * Basada en VistaCalendarioSemana, adaptada para 14 dias con columnas mas estrechas.
 * Soporta drag-and-drop para mover eventos y drag-to-select para crear.
 * Se usa en: pagina principal del calendario (vista quincenal).
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import {
  NOMBRES_DIAS_SEMANA,
  NOMBRES_MESES_CORTOS_MIN,
  mismoDia,
  esHoy,
  inicioSemana,
  claveDelDia,
  indiceDiaSemana,
  parsearFecha,
  formatearHoraCorta,
  formatearEtiquetaHora,
  ALTURA_FILA,
} from './constantes'
import type { EventoCalendario } from './tipos'

// --- Constantes locales ---

/** Hora de inicio de la cuadricula */
const HORA_INICIO = 6
/** Hora de fin de la cuadricula */
const HORA_FIN = 22
/** Maximo de eventos todo-el-dia visibles antes de "+N mas" */
const MAX_TODO_DIA = 2
/** Ancho de la columna de horas en px */
const ANCHO_COLUMNA_HORAS = 48
/** Umbral minimo en px antes de iniciar arrastre */
const UMBRAL_ARRASTRE = 5
/** Cantidad de dias en la vista quincenal */
const DIAS_QUINCENA = 14

// --- Utilidades de fecha ---

/** Genera las horas del eje vertical: [6, 7, ..., 22] */
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

/** Convierte hora y minutos a posicion Y en pixeles dentro de la cuadricula */
function tiempoAPx(horas: number, minutos: number): number {
  return (horas * 60 + minutos - HORA_INICIO * 60) * (ALTURA_FILA / 60)
}

/** Genera los 14 dias de la quincena (2 semanas a partir del lunes de la semana actual) */
function diasDeLaQuincena(fecha: Date): Date[] {
  const lunes = inicioSemana(fecha)
  return Array.from({ length: DIAS_QUINCENA }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

// --- Deteccion de solapamiento ---

interface EventoPosicionado {
  evento: EventoCalendario
  /** Minutos desde HORA_INICIO */
  inicioMin: number
  finMin: number
  /** Indice de columna dentro del grupo solapado */
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
  /** Si el formato de hora es 24h (true) o 12h (false) */
  es24h: boolean
}

/**
 * BloqueEventoArrastrable — Envuelve un evento de la cuadricula con drag-and-drop.
 * Version compacta para la vista quincenal (columnas mas estrechas).
 */
function BloqueEventoArrastrable({
  evento,
  posicion,
  onClickEvento,
  es24h,
}: PropiedadesEventoArrastrable) {
  const { inicioMin, finMin, columna, totalColumnas } = posicion
  const duracionMin = finMin - inicioMin
  const alturaPx = Math.max(duracionMin * (ALTURA_FILA / 60), 24)
  const topPx = inicioMin * (ALTURA_FILA / 60)
  const anchoPorc = 100 / totalColumnas
  const izquierdaPorc = columna * anchoPorc
  const colorEvento = evento.color || 'var(--texto-marca)'
  const esCorto = alturaPx < 30

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

  const estiloTransformMover = transformMover
    ? {
        transform: `translate(${transformMover.x}px, ${transformMover.y}px)`,
        zIndex: 50,
        opacity: 0.85,
      }
    : {}

  const alturaConRedimensionado = estaRedimensionando && transformRedimensionar
    ? Math.max(alturaPx + transformRedimensionar.y, 15)
    : alturaPx

  const inicioDate = parsearFecha(evento.fecha_inicio)
  const finDate = parsearFecha(evento.fecha_fin)

  return (
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
        'absolute z-10 rounded-sm overflow-hidden text-left cursor-grab px-1 py-0.5 select-none',
        estaArrastrandoMover ? 'cursor-grabbing shadow-lg ring-2 ring-texto-marca/30' : '',
      ].join(' ')}
      style={{
        top: topPx,
        height: alturaConRedimensionado,
        left: `calc(${izquierdaPorc}% + 1px)`,
        width: `calc(${anchoPorc}% - 2px)`,
        backgroundColor: `color-mix(in srgb, ${colorEvento} 25%, transparent)`,
        borderLeft: `2px solid ${colorEvento}`,
        color: colorEvento,
        ...estiloTransformMover,
      }}
    >
      {esCorto ? (
        <span className="text-[9px] sm:text-[10px] leading-tight truncate block font-medium">
          {evento.titulo}
        </span>
      ) : (
        <>
          <span className="text-[10px] leading-tight truncate block font-medium">
            {evento.titulo}
          </span>
          <span className="text-[9px] sm:text-[10px] leading-tight opacity-70 block">
            {formatearHoraCorta(inicioDate, es24h)} – {formatearHoraCorta(finDate, es24h)}
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
        <div className="w-4 h-0.5 rounded-full bg-current opacity-0 group-hover/asa:opacity-40 transition-opacity" />
      </div>
    </motion.div>
  )
}

// --- Componente principal ---

interface PropiedadesVistaQuincenal {
  fechaActual: Date
  eventos: EventoCalendario[]
  /** Click en franja vacia -> crear evento; fechaFin opcional si se arrastro un rango */
  onClickHora: (fecha: Date, fechaFin?: Date) => void
  /** Click en evento -> editar */
  onClickEvento: (evento: EventoCalendario, posicion?: { x: number; y: number }) => void
  /** Drag para mover evento */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
  /** Hora de inicio de jornada laboral (para overlay visual) */
  horaInicioLaboral?: number
  /** Hora de fin de jornada laboral (para overlay visual) */
  horaFinLaboral?: number
}

/** Estado de la seleccion por arrastre (drag-to-select) */
interface EstadoSeleccionRango {
  /** Dia de la columna donde inicio el arrastre */
  dia: Date
  /** Posicion Y inicial relativa a la columna (en px) */
  inicioY: number
  /** Posicion Y actual relativa a la columna (en px) */
  finY: number
  /** Si el arrastre esta activo (mousedown sin mouseup) */
  activa: boolean
}

/**
 * Redondea una posicion Y a intervalos de 15 minutos dentro de la cuadricula.
 */
function redondearYA15Min(y: number): number {
  const minutos = (y / ALTURA_FILA) * 60
  const minutosRedondeados = Math.round(minutos / 15) * 15
  return (minutosRedondeados / 60) * ALTURA_FILA
}

/**
 * Convierte una posicion Y (px) a hora formateada "HH:MM".
 */
function formatoHoraDesdeY(y: number): string {
  const minutosDesdeInicio = (y / ALTURA_FILA) * 60
  const horaTotal = HORA_INICIO * 60 + minutosDesdeInicio
  const horas = Math.floor(horaTotal / 60)
  const minutos = Math.round(horaTotal % 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/**
 * Convierte una posicion Y (px) y un dia a un objeto Date con hora correspondiente.
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

function VistaCalendarioQuincenal({
  fechaActual,
  eventos,
  onClickHora,
  onClickEvento,
  onMoverEvento,
  horaInicioLaboral,
  horaFinLaboral,
}: PropiedadesVistaQuincenal) {
  const { formatoHora } = useFormato()
  const { t } = useTraduccion()
  const es24h = formatoHora !== '12h'

  // En movil (<768px), mostrar solo 7 dias en vez de 14
  const [esMobile, setEsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  useEffect(() => {
    const manejarResize = () => setEsMobile(window.innerWidth < 768)
    window.addEventListener('resize', manejarResize)
    return () => window.removeEventListener('resize', manejarResize)
  }, [])

  const diasVisibles = esMobile ? 7 : DIAS_QUINCENA

  const refCuadricula = useRef<HTMLDivElement>(null)
  const refColumnas = useRef<HTMLDivElement>(null)
  const [minutosAhora, setMinutosAhora] = useState(() => {
    const ahora = new Date()
    return ahora.getHours() * 60 + ahora.getMinutes()
  })

  // Estado para seleccion de rango por arrastre (drag-to-select)
  const [seleccion, setSeleccion] = useState<EstadoSeleccionRango | null>(null)
  const refSeleccion = useRef<EstadoSeleccionRango | null>(null)
  refSeleccion.current = seleccion

  // Sensor con umbral de distancia para diferenciar click de arrastre
  const sensores = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: UMBRAL_ARRASTRE },
    }),
  )

  // Actualizar linea de hora actual cada minuto
  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date()
      setMinutosAhora(ahora.getHours() * 60 + ahora.getMinutes())
    }, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  // 14 dias de la quincena (lunes de la semana actual + 13 dias)
  const diasQuincena = useMemo(() => diasDeLaQuincena(fechaActual), [fechaActual])

  // Eventos agrupados por dia
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()

    for (const evento of eventos) {
      const fechaInicio = parsearFecha(evento.fecha_inicio)
      const fechaFin = parsearFecha(evento.fecha_fin)

      for (const dia of diasQuincena) {
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
  }, [eventos, diasQuincena])

  // Eventos todo el dia
  const eventosTodoDiaPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()
    for (const [clave, evs] of eventosPorDia) {
      const todoDia = evs.filter((e) => e.todo_el_dia)
      if (todoDia.length > 0) mapa.set(clave, todoDia)
    }
    return mapa
  }, [eventosPorDia])

  // Posiciones calculadas por dia (solo eventos con hora)
  const posicionesPorDia = useMemo(() => {
    const mapa = new Map<string, EventoPosicionado[]>()
    for (const [clave, evs] of eventosPorDia) {
      const posiciones = calcularPosiciones(evs)
      if (posiciones.length > 0) mapa.set(clave, posiciones)
    }
    return mapa
  }, [eventosPorDia])

  // Auto-scroll al montar: ir a la hora actual o 08:00
  useEffect(() => {
    if (!refCuadricula.current) return
    const ahora = new Date()
    const horaObjetivo = Math.min(ahora.getHours(), horaInicioLaboral ?? 8)
    const scrollY = tiempoAPx(horaObjetivo, 0)
    refCuadricula.current.scrollTop = scrollY
  }, [horaInicioLaboral])

  // Altura total de la cuadricula
  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTURA_FILA

  // --- Handlers de seleccion por arrastre ---

  const manejarMouseDown = useCallback(
    (dia: Date, e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
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

  /** Touch: inicia seleccion */
  const manejarTouchStart = useCallback(
    (dia: Date, e: React.TouchEvent<HTMLDivElement>) => {
      const objetivo = e.target as HTMLElement
      if (objetivo.closest('[data-evento-bloque]')) return
      const touch = e.touches[0]
      const rect = e.currentTarget.getBoundingClientRect()
      const y = redondearYA15Min(touch.clientY - rect.top)
      setSeleccion({ dia, inicioY: y, finY: y, activa: true })
    },
    [],
  )

  /** Touch: actualiza seleccion */
  const manejarTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!refSeleccion.current?.activa) return
      e.preventDefault()
      const touch = e.touches[0]
      const claveSeleccion = claveDelDia(refSeleccion.current.dia)
      const columnaDiv = e.currentTarget.querySelector(
        `[data-dia-clave="${claveSeleccion}"]`,
      ) as HTMLElement | null
      if (!columnaDiv) return
      const rect = columnaDiv.getBoundingClientRect()
      const yRelativo = touch.clientY - rect.top
      const yClamped = Math.max(0, Math.min(yRelativo, alturaTotal))
      const yRedondeado = redondearYA15Min(yClamped)
      setSeleccion((prev) => prev ? { ...prev, finY: yRedondeado } : null)
    },
    [alturaTotal],
  )

  const manejarMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!refSeleccion.current?.activa) return

      const claveSeleccion = claveDelDia(refSeleccion.current.dia)
      const columnaDiv = e.currentTarget.querySelector(
        `[data-dia-clave="${claveSeleccion}"]`,
      ) as HTMLElement | null
      if (!columnaDiv) return

      const rect = columnaDiv.getBoundingClientRect()
      const yRelativo = e.clientY - rect.top
      const yClamped = Math.max(0, Math.min(yRelativo, alturaTotal))
      const yRedondeado = redondearYA15Min(yClamped)

      setSeleccion((prev) =>
        prev ? { ...prev, finY: yRedondeado } : null,
      )
    },
    [alturaTotal],
  )

  // Finalizar seleccion por arrastre al soltar el mouse
  useEffect(() => {
    const manejarMouseUp = () => {
      const sel = refSeleccion.current
      if (!sel?.activa) return

      const yMin = Math.min(sel.inicioY, sel.finY)
      const yMax = Math.max(sel.inicioY, sel.finY)
      const alturaSeleccion = yMax - yMin

      const UMBRAL_ARRASTRE_SELECCION = (15 / 60) * ALTURA_FILA * 0.5

      if (alturaSeleccion > UMBRAL_ARRASTRE_SELECCION) {
        const fechaInicio = fechaDesdeY(sel.dia, yMin)
        const fechaFin = fechaDesdeY(sel.dia, yMax)
        onClickHora(fechaInicio, fechaFin)
      } else {
        const fechaClick = fechaDesdeY(sel.dia, yMin)
        onClickHora(fechaClick)
      }

      setSeleccion(null)
    }

    document.addEventListener('mouseup', manejarMouseUp)
    document.addEventListener('touchend', manejarMouseUp)
    return () => {
      document.removeEventListener('mouseup', manejarMouseUp)
      document.removeEventListener('touchend', manejarMouseUp)
    }
  }, [onClickHora])

  /**
   * Maneja el fin de un arrastre (mover o redimensionar).
   * Calcula la nueva fecha/hora basandose en el delta de pixeles.
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

      const inicioOriginal = parsearFecha(eventoOriginal.fecha_inicio)
      const finOriginal = parsearFecha(eventoOriginal.fecha_fin)

      const deltaMinutos = Math.round((delta.y / ALTURA_FILA) * 60 / 15) * 15

      if (esRedimensionar) {
        const nuevaFin = new Date(finOriginal)
        nuevaFin.setMinutes(nuevaFin.getMinutes() + deltaMinutos)
        if (nuevaFin <= inicioOriginal) return
        onMoverEvento(eventoId, inicioOriginal.toISOString(), nuevaFin.toISOString())
      } else {
        let deltaDias = 0
        if (refColumnas.current) {
          const anchoCuadricula = refColumnas.current.getBoundingClientRect().width
          const anchoColumna = anchoCuadricula / diasVisibles
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
    },
    [eventos, onMoverEvento, diasVisibles],
  )

  // Posicion Y de la linea de hora actual
  const lineaAhoraPx = tiempoAPx(Math.floor(minutosAhora / 60), minutosAhora % 60)
  const lineaAhoraVisible =
    minutosAhora >= HORA_INICIO * 60 && minutosAhora <= HORA_FIN * 60

  /**
   * Determina si un dia es el primer dia de un nuevo mes dentro de la quincena,
   * o si cruza de mes y necesita mostrar el nombre del mes abreviado.
   */
  const necesitaEtiquetaMes = (dia: Date, indice: number): boolean => {
    if (indice === 0) return true
    const diaAnterior = diasQuincena[indice - 1]
    return dia.getMonth() !== diaAnterior.getMonth()
  }

  return (
    <DndContext sensors={sensores} onDragEnd={manejarFinArrastre}>
      <motion.div
        role="grid"
        aria-label={t('calendario.a11y.calendario_quincenal')}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Encabezado: 14 dias */}
        <div className="flex border-b border-borde-sutil shrink-0">
          {/* Esquina vacia (columna de horas) */}
          <div
            className="shrink-0 border-r border-borde-sutil"
            style={{ width: ANCHO_COLUMNA_HORAS }}
          />

          {/* Nombres y numeros de dias */}
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${diasVisibles}, 1fr)` }}>
            {diasQuincena.slice(0, diasVisibles).map((dia: Date, indice: number) => {
              const hoyFlag = esHoy(dia)
              const mostrarMes = necesitaEtiquetaMes(dia, indice)
              return (
                <div
                  key={claveDelDia(dia)}
                  className="flex flex-col items-center py-1.5 border-r border-borde-sutil last:border-r-0"
                >
                  <span className="text-[9px] sm:text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
                    {NOMBRES_DIAS_SEMANA[indiceDiaSemana(dia)]}
                  </span>
                  <span
                    className={[
                      'mt-0.5 flex items-center justify-center size-6 rounded-full text-[11px] font-semibold leading-none',
                      hoyFlag
                        ? 'bg-texto-marca/10 text-texto-marca'
                        : 'text-texto-primario',
                    ].join(' ')}
                  >
                    {dia.getDate()}
                  </span>
                  {/* Mostrar mes abreviado cuando cruza de mes */}
                  {mostrarMes && (
                    <span className="text-[8px] sm:text-[9px] text-texto-terciario font-medium mt-0.5">
                      {NOMBRES_MESES_CORTOS_MIN[dia.getMonth()]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Barra de eventos todo el dia */}
        {eventosTodoDiaPorDia.size > 0 && (
          <div className="flex border-b border-borde-sutil shrink-0">
            <div
              className="shrink-0 flex items-start justify-end pr-1 pt-1 text-[9px] sm:text-[10px] text-texto-terciario border-r border-borde-sutil"
              style={{ width: ANCHO_COLUMNA_HORAS }}
            >
              {t('calendario.todo_el_dia')}
            </div>

            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${diasVisibles}, 1fr)` }}>
              {diasQuincena.slice(0, diasVisibles).map((dia: Date) => {
                const clave = claveDelDia(dia)
                const eventosDia = eventosTodoDiaPorDia.get(clave) || []
                const visibles = eventosDia.slice(0, MAX_TODO_DIA)
                const restantes = eventosDia.length - MAX_TODO_DIA

                return (
                  <div
                    key={clave}
                    className="flex flex-col gap-0.5 p-0.5 border-r border-borde-sutil last:border-r-0 min-h-[24px] overflow-hidden min-w-0"
                  >
                    {visibles.map((evento) => (
                      <button
                        key={evento.id}
                        type="button"
                        onClick={() => onClickEvento(evento)}
                        title={evento.titulo}
                        className="w-full text-left truncate rounded px-1 py-0.5 text-[9px] sm:text-[10px] leading-tight transition-opacity hover:opacity-80 block"
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
                      <span className="text-[8px] sm:text-[9px] text-texto-terciario pl-0.5">
                        +{restantes}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cuadricula horaria (scrollable) */}
        <div ref={refCuadricula} className="flex-1 overflow-y-auto min-h-0">
          <div className="flex relative" style={{ height: alturaTotal }}>
            {/* Columna de etiquetas de hora */}
            <div
              className="shrink-0 relative border-r border-borde-sutil"
              style={{ width: ANCHO_COLUMNA_HORAS }}
            >
              {HORAS.map((hora) => (
                <div
                  key={hora}
                  className="absolute right-1 text-[10px] text-texto-terciario leading-none -translate-y-1/2"
                  style={{ top: tiempoAPx(hora, 0) }}
                >
                  {formatearEtiquetaHora(hora, es24h)}
                </div>
              ))}
            </div>

            {/* Columnas de 14 dias */}
            <div
              ref={refColumnas}
              className="grid flex-1 relative"
              style={{ gridTemplateColumns: `repeat(${diasVisibles}, 1fr)` }}
              onMouseMove={manejarMouseMove}
              onTouchMove={manejarTouchMove}
            >
              {/* Lineas horizontales de horas completas */}
              {HORAS.map((hora) => (
                <div
                  key={`linea-hora-${hora}`}
                  className="absolute left-0 right-0 border-t border-borde-sutil pointer-events-none"
                  style={{ top: tiempoAPx(hora, 0) }}
                />
              ))}

              {/* Lineas punteadas de media hora */}
              {HORAS.slice(0, -1).map((hora) => (
                <div
                  key={`linea-media-${hora}`}
                  className="absolute left-0 right-0 border-t border-dashed border-borde-sutil/50 pointer-events-none"
                  style={{ top: tiempoAPx(hora, 30) }}
                />
              ))}

              {/* Separadores de semana: linea mas gruesa entre dia 7 y 8 (solo en desktop) */}
              {!esMobile && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-borde-fuerte/30 pointer-events-none z-[1]"
                  style={{ left: `${(7 / diasVisibles) * 100}%` }}
                />
              )}

              {/* Columnas individuales de cada dia */}
              {diasQuincena.slice(0, diasVisibles).map((dia: Date) => {
                const clave = claveDelDia(dia)
                const posiciones = posicionesPorDia.get(clave) || []
                const hoyFlag = esHoy(dia)
                const seleccionEnEsteDia =
                  seleccion?.activa && claveDelDia(seleccion.dia) === clave
                // Fines de semana con fondo sutil
                const esFindeSemana = dia.getDay() === 0 || dia.getDay() === 6

                return (
                  <div
                    key={clave}
                    data-dia-clave={clave}
                    className={[
                      'relative border-r border-borde-sutil last:border-r-0 cursor-crosshair touch-none',
                      hoyFlag ? 'bg-texto-marca/[0.03]' : '',
                      esFindeSemana && !hoyFlag ? 'bg-superficie-app/50' : '',
                    ].join(' ')}
                    onMouseDown={(e) => manejarMouseDown(dia, e)}
                    onTouchStart={(e) => manejarTouchStart(dia, e)}
                  >
                    {/* Overlay de horas fuera de jornada laboral */}
                    {horaInicioLaboral !== undefined && horaFinLaboral !== undefined && (
                      <>
                        <div className="absolute left-0 right-0 top-0 bg-superficie-app/40 pointer-events-none z-[1]" style={{ height: tiempoAPx(horaInicioLaboral, 0) }} />
                        <div className="absolute left-0 right-0 bg-superficie-app/40 pointer-events-none z-[1]" style={{ top: tiempoAPx(horaFinLaboral, 0), bottom: 0 }} />
                      </>
                    )}

                    {/* Indicador de hora actual (linea roja) */}
                    {hoyFlag && lineaAhoraVisible && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ top: lineaAhoraPx }}
                      >
                        <div className="size-1.5 rounded-full -ml-0.5 shrink-0" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
                        <div className="flex-1 h-[1.5px]" style={{ backgroundColor: 'var(--insignia-peligro)' }} />
                      </div>
                    )}

                    {/* Resaltado de seleccion por arrastre */}
                    {seleccionEnEsteDia && seleccion && (
                      <div
                        className="absolute left-0.5 right-0.5 rounded-sm z-10 pointer-events-none flex items-start p-0.5"
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
                          className="text-[8px] sm:text-[9px] font-medium pointer-events-none select-none"
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
                        es24h={es24h}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </DndContext>
  )
}

export { VistaCalendarioQuincenal }
