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
        opacity: 0.85,
      }
    : {}

  // Altura con redimensionado aplicado (solo cambia el alto)
  const alturaConRedimensionado = estaRedimensionando && transformRedimensionar
    ? Math.max(alturaPx + transformRedimensionar.y, 15)
    : alturaPx

  return (
    <motion.div
      ref={refNodoMover}
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
        'absolute z-10 rounded-md overflow-hidden text-left cursor-grab px-1.5 py-0.5 select-none',
        estaArrastrandoMover ? 'cursor-grabbing shadow-lg ring-2 ring-texto-marca/30' : '',
      ].join(' ')}
      style={{
        top: topPx,
        height: alturaConRedimensionado,
        left: `calc(${izquierdaPorc}% + 2px)`,
        width: `calc(${anchoPorc}% - 4px)`,
        backgroundColor: `color-mix(in srgb, ${colorEvento} 25%, transparent)`,
        borderLeft: `3px solid ${colorEvento}`,
        color: colorEvento,
        ...estiloTransformMover,
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
  /** Click en franja vacía → crear evento */
  onClickHora: (fecha: Date) => void
  /** Click en evento → editar */
  onClickEvento: (evento: EventoCalendario) => void
  /** Drag para mover evento */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
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

  // --- Handler de click en área vacía ---
  const manejarClickCuadricula = useCallback(
    (dia: Date, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const minutosDesdeInicio = (y / ALTURA_FILA) * 60
      const minutosRedondeados = Math.floor(minutosDesdeInicio / 15) * 15
      const horaTotal = HORA_INICIO * 60 + minutosRedondeados
      const horas = Math.floor(horaTotal / 60)
      const minutos = horaTotal % 60

      const fechaClick = new Date(dia)
      fechaClick.setHours(horas, minutos, 0, 0)
      onClickHora(fechaClick)
    },
    [onClickHora],
  )

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
    },
    [eventos, onMoverEvento],
  )

  // --- Posición Y de la línea de hora actual ---
  const lineaAhoraPx = tiempoAPx(Math.floor(minutosAhora / 60), minutosAhora % 60)
  const lineaAhoraVisible =
    minutosAhora >= HORA_INICIO * 60 && minutosAhora <= HORA_FIN * 60

  return (
    <DndContext sensors={sensores} onDragEnd={manejarFinArrastre}>
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
                    className="flex flex-col gap-0.5 p-1 border-r border-borde-sutil last:border-r-0 min-h-[28px]"
                  >
                    {visibles.map((evento) => (
                      <button
                        key={evento.id}
                        type="button"
                        onClick={() => onClickEvento(evento)}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] leading-tight transition-opacity hover:opacity-80"
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
            {/* Columna de etiquetas de hora */}
            <div
              className="shrink-0 relative border-r border-borde-sutil"
              style={{ width: ANCHO_COLUMNA_HORAS }}
            >
              {HORAS.map((hora) => (
                <div
                  key={hora}
                  className="absolute right-2 text-xs text-texto-terciario leading-none -translate-y-1/2"
                  style={{ top: tiempoAPx(hora, 0) }}
                >
                  {String(hora).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            <div ref={refColumnas} className="grid grid-cols-7 flex-1 relative">
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

              {/* Columnas individuales de cada día */}
              {diasSemana.map((dia: Date) => {
                const clave = claveDelDia(dia)
                const posiciones = posicionesPorDia.get(clave) || []
                const hoyFlag = esHoy(dia)

                return (
                  <div
                    key={clave}
                    className={[
                      'relative border-r border-borde-sutil last:border-r-0',
                      hoyFlag ? 'bg-texto-marca/[0.03]' : '',
                    ].join(' ')}
                    onClick={(e) => manejarClickCuadricula(dia, e)}
                  >
                    {/* Indicador de hora actual (línea roja) */}
                    {hoyFlag && lineaAhoraVisible && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ top: lineaAhoraPx }}
                      >
                        <div className="size-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                        <div className="flex-1 h-[2px] bg-red-500" />
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
    </DndContext>
  )
}

export { VistaCalendarioSemana }
