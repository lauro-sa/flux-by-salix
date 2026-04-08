'use client'

/**
 * VistaCalendarioEquipo — Vista de calendario por equipo (team view).
 * Muestra un día completo con una columna por cada miembro del equipo.
 * Eventos filtrados por asignado_ids de cada miembro.
 * Cuadrícula horaria de 06:00 a 22:00, 60px por hora.
 * Se usa en: página principal del calendario (vista equipo).
 */

import { useMemo, useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { EventoCalendario } from './tipos'

// --- Constantes ---

/** Hora de inicio de la cuadrícula */
const HORA_INICIO = 6
/** Hora de fin de la cuadrícula */
const HORA_FIN = 22
/** Altura en píxeles de cada fila de hora */
const ALTURA_FILA = 60
/** Ancho de la columna de etiquetas de hora */
const ANCHO_COLUMNA_HORAS = 56

/** Genera las horas del eje vertical */
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

// --- Tipos ---

interface MiembroEquipo {
  usuario_id: string
  nombre: string
  apellido: string
}

interface PropiedadesVistaEquipo {
  /** Fecha del día a mostrar */
  fechaActual: Date
  /** Todos los eventos del día */
  eventos: EventoCalendario[]
  /** Lista de miembros (se carga internamente si está vacía) */
  miembros: MiembroEquipo[]
  /** Click en franja vacía → crear evento */
  onClickHora: (fecha: Date) => void
  /** Click en evento → editar */
  onClickEvento: (evento: EventoCalendario, posicion?: { x: number; y: number }) => void
}

// --- Utilidades ---

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

/** Convierte hora y minutos a posición Y en píxeles */
function tiempoAPx(horas: number, minutos: number): number {
  return (horas * 60 + minutos - HORA_INICIO * 60) * (ALTURA_FILA / 60)
}

/** Obtiene minutos desde HORA_INICIO para un Date */
function minutosDesdeInicio(fecha: Date): number {
  return (fecha.getHours() - HORA_INICIO) * 60 + fecha.getMinutes()
}

/** Formatea hora como "08:00" */
function formatearHora(hora: number): string {
  return `${hora.toString().padStart(2, '0')}:00`
}

/** Formatea hora desde ISO string: "09:30" */
function horaDesdeISO(iso: string): string {
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) return ''
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Inicial del nombre para el avatar */
function inicialNombre(nombre: string): string {
  return nombre.charAt(0).toUpperCase()
}

// --- Cálculo de posiciones con solapamiento por columna de miembro ---

interface EventoPosicionado {
  evento: EventoCalendario
  arribaPixeles: number
  altoPixeles: number
  columna: number
  totalColumnas: number
}

/**
 * Calcula posiciones de eventos de un miembro, con solapamiento lado a lado.
 */
function calcularPosicionesMiembro(
  eventos: EventoCalendario[],
  fechaReferencia: Date,
): EventoPosicionado[] {
  const eventosConHora = eventos
    .filter((e) => !e.todo_el_dia)
    .map((evento) => {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)

      // Recortar al rango visible
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
        arribaPixeles: (arribaMin / 60) * ALTURA_FILA,
        altoPixeles: (duracionMin / 60) * ALTURA_FILA,
        columna: 0,
        totalColumnas: 1,
      }
    })
    .sort((a, b) => a.arribaMin - b.arribaMin || b.finMin - a.finMin)

  // Agrupar solapados y asignar columnas
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

// --- Componente principal ---

function VistaCalendarioEquipo({
  fechaActual,
  eventos,
  miembros: miembrosExternos,
  onClickHora,
  onClickEvento,
}: PropiedadesVistaEquipo) {
  const refCuadricula = useRef<HTMLDivElement>(null)
  const [miembrosInternos, setMiembrosInternos] = useState<MiembroEquipo[]>([])

  // Usar miembros externos si los hay, si no cargar internamente
  const miembros = miembrosExternos.length > 0 ? miembrosExternos : miembrosInternos

  // Cargar miembros del equipo desde Supabase si no se pasan por props
  useEffect(() => {
    if (miembrosExternos.length > 0) return

    const cargarMiembros = async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return

      const { data } = await supabase
        .from('miembros')
        .select('usuario_id, perfiles!inner(nombre, apellido)')
        .eq('empresa_id', empresaId)
        .eq('activo', true)

      if (data) {
        setMiembrosInternos(
          data.map((m: Record<string, unknown>) => ({
            usuario_id: m.usuario_id as string,
            nombre: (m.perfiles as Record<string, unknown>).nombre as string,
            apellido: (m.perfiles as Record<string, unknown>).apellido as string,
          })),
        )
      }
    }
    cargarMiembros()
  }, [miembrosExternos.length])

  // Filtrar eventos del día actual
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

  // Eventos con posiciones calculadas por miembro
  const eventosPorMiembro = useMemo(() => {
    const mapa = new Map<string, EventoPosicionado[]>()

    for (const miembro of miembros) {
      // Filtrar eventos asignados a este miembro
      const eventosMiembro = eventosDelDia.filter(
        (e) => e.asignado_ids.includes(miembro.usuario_id),
      )
      const posiciones = calcularPosicionesMiembro(eventosMiembro, fechaActual)
      mapa.set(miembro.usuario_id, posiciones)
    }

    return mapa
  }, [eventosDelDia, miembros, fechaActual])

  // Posición del indicador de hora actual
  const posicionIndicadorActual = useMemo(() => {
    if (!esHoy(fechaActual)) return null
    const ahora = new Date()
    const min = minutosDesdeInicio(ahora)
    if (min < 0 || min > (HORA_FIN - HORA_INICIO) * 60) return null
    return (min / 60) * ALTURA_FILA
  }, [fechaActual])

  // Auto-scroll a la hora actual al montar
  useEffect(() => {
    if (!refCuadricula.current) return
    const ahora = new Date()
    const horaActual = ahora.getHours()
    const horaObjetivo = Math.max(horaActual - 1, HORA_INICIO)
    const pixelesObjetivo = (horaObjetivo - HORA_INICIO) * ALTURA_FILA
    refCuadricula.current.scrollTop = pixelesObjetivo
  }, [])

  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTURA_FILA
  const totalColumnas = Math.max(miembros.length, 1)

  /** Click en celda vacía de un miembro para crear evento */
  function manejarClickCeldaMiembro(
    miembro: MiembroEquipo,
    e: React.MouseEvent<HTMLDivElement>,
  ) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutosDesdeInicioClick = (y / ALTURA_FILA) * 60
    const minutosRedondeados = Math.floor(minutosDesdeInicioClick / 15) * 15
    const horaTotal = HORA_INICIO * 60 + minutosRedondeados
    const horas = Math.floor(horaTotal / 60)
    const minutos = horaTotal % 60

    const fechaClick = new Date(fechaActual)
    fechaClick.setHours(horas, minutos, 0, 0)
    onClickHora(fechaClick)
  }

  // Estado vacío: sin miembros cargados
  if (miembros.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-full text-texto-terciario text-sm"
      >
        Cargando miembros del equipo...
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col flex-1 min-h-0"
    >
      {/* Encabezado: columnas de miembros */}
      <div className="flex border-b border-borde-sutil shrink-0">
        {/* Esquina vacía (columna de horas) */}
        <div
          className="shrink-0 border-r border-borde-sutil"
          style={{ width: ANCHO_COLUMNA_HORAS }}
        />

        {/* Nombres de miembros */}
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${totalColumnas}, minmax(0, 1fr))` }}
        >
          {miembros.map((miembro) => (
            <div
              key={miembro.usuario_id}
              className="flex items-center gap-2 py-2.5 px-3 border-r border-borde-sutil last:border-r-0"
            >
              {/* Avatar con inicial */}
              <span className="inline-flex items-center justify-center size-7 rounded-full bg-texto-marca/10 text-texto-marca text-xs font-semibold shrink-0">
                {inicialNombre(miembro.nombre)}
              </span>
              {/* Nombre completo */}
              <div className="min-w-0">
                <span className="text-sm font-medium text-texto-primario truncate block">
                  {miembro.nombre} {miembro.apellido.charAt(0)}.
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                {formatearHora(hora)}
              </div>
            ))}
          </div>

          {/* Columnas de miembros */}
          <div
            className="grid flex-1 relative"
            style={{ gridTemplateColumns: `repeat(${totalColumnas}, minmax(0, 1fr))` }}
          >
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

            {/* Indicador de hora actual (línea roja completa) */}
            {posicionIndicadorActual !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: posicionIndicadorActual }}
              >
                <div className="size-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            )}

            {/* Columna de cada miembro */}
            {miembros.map((miembro) => {
              const posiciones = eventosPorMiembro.get(miembro.usuario_id) || []

              return (
                <div
                  key={miembro.usuario_id}
                  className="relative border-r border-borde-sutil last:border-r-0"
                  onClick={(e) => manejarClickCeldaMiembro(miembro, e)}
                >
                  {/* Eventos posicionados */}
                  {posiciones.map((ep) => {
                    const anchoColumnaEvento = 100 / ep.totalColumnas
                    const izquierda = ep.columna * anchoColumnaEvento
                    const anchoPorcentaje = anchoColumnaEvento - (ep.totalColumnas > 1 ? 2 : 0)
                    const colorEvento = ep.evento.color || 'var(--texto-marca)'

                    return (
                      <motion.button
                        key={ep.evento.id}
                        type="button"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onClickEvento(ep.evento, { x: e.clientX, y: e.clientY })
                        }}
                        className="absolute z-10 rounded-md overflow-hidden text-left cursor-pointer px-1.5 py-0.5 transition-shadow hover:shadow-md"
                        style={{
                          top: ep.arribaPixeles,
                          height: Math.max(ep.altoPixeles, 20),
                          left: `calc(${izquierda}% + 2px)`,
                          width: `calc(${anchoPorcentaje}% - 4px)`,
                          backgroundColor: `color-mix(in srgb, ${colorEvento} 25%, transparent)`,
                          borderLeft: `3px solid ${colorEvento}`,
                          color: colorEvento,
                        }}
                      >
                        {/* Título */}
                        <span className="text-[11px] leading-tight truncate block font-medium">
                          {ep.evento.titulo}
                        </span>

                        {/* Hora (solo si hay espacio) */}
                        {ep.altoPixeles >= 35 && (
                          <span className="text-[10px] leading-tight opacity-70 block">
                            {horaDesdeISO(ep.evento.fecha_inicio)} – {horaDesdeISO(ep.evento.fecha_fin)}
                          </span>
                        )}

                        {/* Descripción (solo si hay bastante espacio) */}
                        {ep.altoPixeles > 55 && ep.evento.descripcion && (
                          <span className="text-[10px] leading-tight opacity-60 block truncate mt-0.5">
                            {ep.evento.descripcion}
                          </span>
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

export { VistaCalendarioEquipo }
