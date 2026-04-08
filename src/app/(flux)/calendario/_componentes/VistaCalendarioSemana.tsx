'use client'

/**
 * VistaCalendarioSemana — Vista semanal del calendario con cuadrícula horaria.
 * Muestra 7 columnas (lun–dom) con franjas de 06:00 a 22:00.
 * Eventos posicionados según hora y duración, con detección de solapamiento.
 * Se usa en: página principal del calendario (vista semana).
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameDay,
  format,
  parseISO,
  differenceInMinutes,
} from 'date-fns'
import { es } from 'date-fns/locale'
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

// --- Utilidades ---

/** Genera las horas del eje vertical: [6, 7, ..., 22] */
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

/** Convierte hora y minutos a posición Y en píxeles dentro de la cuadrícula */
function tiempoAPx(horas: number, minutos: number): number {
  return (horas * 60 + minutos - HORA_INICIO * 60) * (ALTURA_FILA / 60)
}

/** Parsea un string ISO a Date de forma segura */
function parsearFecha(iso: string): Date {
  return parseISO(iso)
}

/** Formatea hora corta: "09:30" */
function formatearHoraCorta(fecha: Date): string {
  return format(fecha, 'HH:mm')
}

// --- Detección de solapamiento ---

interface EventoPosicionado {
  evento: EventoCalendario
  inicioMin: number // minutos desde HORA_INICIO
  finMin: number
  columna: number // índice dentro del grupo solapado
  totalColumnas: number // tamaño del grupo
}

/**
 * Agrupa eventos solapados y asigna columnas side-by-side.
 * Algoritmo: ordenar por inicio, agrupar en clusters solapados,
 * asignar columna incremental dentro de cada cluster.
 */
function calcularPosiciones(eventosDelDia: EventoCalendario[]): EventoPosicionado[] {
  // Filtrar solo eventos con hora (no todo el día)
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

  // Agrupar en clusters solapados
  const clusters: typeof conHora[] = []
  let clusterActual = [conHora[0]]

  for (let i = 1; i < conHora.length; i++) {
    const item = conHora[i]
    const finMaxCluster = Math.max(...clusterActual.map((c) => c.finMin))
    if (item.inicioMin < finMaxCluster) {
      // Solapamiento → agregar al cluster
      clusterActual.push(item)
    } else {
      clusters.push(clusterActual)
      clusterActual = [item]
    }
  }
  clusters.push(clusterActual)

  // Asignar columnas dentro de cada cluster
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

// --- Componente ---

interface PropiedadesVistaSemana {
  fechaActual: Date
  eventos: EventoCalendario[]
  /** Click en franja vacía → crear evento */
  onClickHora: (fecha: Date) => void
  /** Click en evento → editar */
  onClickEvento: (evento: EventoCalendario) => void
  /** Drag para mover evento (futuro) */
  onMoverEvento?: (id: string, nuevaInicio: string, nuevaFin: string) => void
}

function VistaCalendarioSemana({
  fechaActual,
  eventos,
  onClickHora,
  onClickEvento,
}: PropiedadesVistaSemana) {
  const refCuadricula = useRef<HTMLDivElement>(null)
  const [minutosAhora, setMinutosAhora] = useState(() => {
    const ahora = new Date()
    return ahora.getHours() * 60 + ahora.getMinutes()
  })

  // --- Actualizar línea de hora actual cada minuto ---
  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date()
      setMinutosAhora(ahora.getHours() * 60 + ahora.getMinutes())
    }, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  // --- Días de la semana (lunes a domingo) ---
  const diasSemana = useMemo(() => {
    const inicio = startOfWeek(fechaActual, { weekStartsOn: 1 })
    const fin = endOfWeek(fechaActual, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: inicio, end: fin })
  }, [fechaActual])

  // --- Eventos agrupados por día ---
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()

    for (const evento of eventos) {
      const fechaInicio = parsearFecha(evento.fecha_inicio)
      const fechaFin = parsearFecha(evento.fecha_fin)

      // Agregar el evento a cada día que abarca
      for (const dia of diasSemana) {
        const inicioDia = new Date(dia)
        inicioDia.setHours(0, 0, 0, 0)
        const finDia = new Date(dia)
        finDia.setHours(23, 59, 59, 999)

        if (fechaInicio <= finDia && fechaFin >= inicioDia) {
          const clave = format(dia, 'yyyy-MM-dd')
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

  // --- Auto-scroll al montar: ir a la hora actual o 08:00 ---
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

  // --- Posición Y de la línea de hora actual ---
  const lineaAhoraPx = tiempoAPx(
    Math.floor(minutosAhora / 60),
    minutosAhora % 60,
  )
  const lineaAhoraVisible =
    minutosAhora >= HORA_INICIO * 60 && minutosAhora <= HORA_FIN * 60

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col flex-1 min-h-0"
    >
      {/* ═══ Encabezado: días de la semana ═══ */}
      <div className="flex border-b border-borde-sutil shrink-0">
        {/* Esquina vacía (columna de horas) */}
        <div
          className="shrink-0 border-r border-borde-sutil"
          style={{ width: ANCHO_COLUMNA_HORAS }}
        />

        {/* Nombres y números de días */}
        <div className="grid grid-cols-7 flex-1">
          {diasSemana.map((dia) => {
            const esHoyFlag = isToday(dia)
            return (
              <div
                key={dia.toISOString()}
                className="flex flex-col items-center py-2 border-r border-borde-sutil last:border-r-0"
              >
                <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  {format(dia, 'EEE', { locale: es })}
                </span>
                <span
                  className={[
                    'mt-0.5 flex items-center justify-center size-7 rounded-full text-sm font-semibold leading-none',
                    esHoyFlag
                      ? 'bg-texto-marca/10 text-texto-marca'
                      : 'text-texto-primario',
                  ].join(' ')}
                >
                  {format(dia, 'd')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Barra de eventos todo el día ═══ */}
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
            {diasSemana.map((dia) => {
              const clave = format(dia, 'yyyy-MM-dd')
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

      {/* ═══ Cuadrícula horaria (scrollable) ═══ */}
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
          <div className="grid grid-cols-7 flex-1 relative">
            {/* Líneas horizontales de horas */}
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
            {diasSemana.map((dia, indiceDia) => {
              const clave = format(dia, 'yyyy-MM-dd')
              const posiciones = posicionesPorDia.get(clave) || []
              const esHoyFlag = isToday(dia)

              return (
                <div
                  key={clave}
                  className={[
                    'relative border-r border-borde-sutil last:border-r-0',
                    esHoyFlag ? 'bg-texto-marca/[0.03]' : '',
                  ].join(' ')}
                  onClick={(e) => manejarClickCuadricula(dia, e)}
                >
                  {/* Indicador de hora actual */}
                  {esHoyFlag && lineaAhoraVisible && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{ top: lineaAhoraPx }}
                    >
                      <div className="size-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  )}

                  {/* Eventos posicionados */}
                  {posiciones.map(({ evento, inicioMin, finMin, columna, totalColumnas }) => {
                    const duracionMin = finMin - inicioMin
                    const alturaPx = Math.max(duracionMin * (ALTURA_FILA / 60), 20)
                    const topPx = inicioMin * (ALTURA_FILA / 60)
                    const anchoPorc = 100 / totalColumnas
                    const izquierdaPorc = columna * anchoPorc
                    const colorEvento = evento.color || 'var(--texto-marca)'
                    const inicioDate = parsearFecha(evento.fecha_inicio)
                    const finDate = parsearFecha(evento.fecha_fin)
                    const esCorto = alturaPx < 35

                    return (
                      <motion.button
                        key={evento.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.1 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onClickEvento(evento)
                        }}
                        className="absolute z-10 rounded-md overflow-hidden text-left cursor-pointer px-1.5 py-0.5"
                        style={{
                          top: topPx,
                          height: alturaPx,
                          left: `calc(${izquierdaPorc}% + 2px)`,
                          width: `calc(${anchoPorc}% - 4px)`,
                          backgroundColor: `color-mix(in srgb, ${colorEvento} 25%, transparent)`,
                          borderLeft: `3px solid ${colorEvento}`,
                          color: colorEvento,
                        }}
                      >
                        {esCorto ? (
                          // Evento corto: título y hora en una línea
                          <span className="text-[11px] leading-tight truncate block font-medium">
                            {evento.titulo}
                          </span>
                        ) : (
                          // Evento normal: título + rango de hora
                          <>
                            <span className="text-[11px] leading-tight truncate block font-medium">
                              {evento.titulo}
                            </span>
                            <span className="text-[10px] leading-tight opacity-70 block">
                              {formatearHoraCorta(inicioDate)} – {formatearHoraCorta(finDate)}
                            </span>
                          </>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export { VistaCalendarioSemana }
