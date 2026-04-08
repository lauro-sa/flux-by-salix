'use client'

/**
 * SelectorCalendarioBloque — Modal con mini-calendario semanal para seleccionar
 * bloques horarios al crear una actividad.
 * Muestra eventos existentes (gris/semi-transparente) y permite al usuario
 * hacer clic + arrastrar para seleccionar rangos horarios en la cuadrícula.
 * Se usa en: ModalActividad (cuando el tipo tiene campo_calendario habilitado).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- Tipos ---

/** Bloque horario seleccionado por el usuario */
interface BloqueHorario {
  fecha: string
  horaInicio: string
  horaFin: string
}

/** Evento existente del calendario (simplificado para visualización) */
interface EventoExistente {
  id: string
  titulo: string
  fecha_inicio: string
  fecha_fin: string
  color: string | null
  todo_el_dia: boolean
}

/** Vista activa del selector */
type VistaSelector = 'semana' | 'dia'

/** Estado de la selección por arrastre */
interface EstadoArrastre {
  /** Índice de la columna (día) donde inició el arrastre */
  indiceDia: number
  /** Posición Y inicial en px relativa a la cuadrícula */
  inicioY: number
  /** Posición Y actual en px relativa a la cuadrícula */
  finY: number
  /** Si el arrastre está activo */
  activa: boolean
}

// --- Props del componente ---

interface PropiedadesSelectorCalendario {
  abierto: boolean
  /** Bloques ya seleccionados */
  bloques: BloqueHorario[]
  /** Callback cuando cambian los bloques */
  onCambiar: (bloques: BloqueHorario[]) => void
  onCerrar: () => void
  /** Título de la actividad (se muestra en el encabezado) */
  titulo?: string
}

// --- Constantes ---

/** Hora de inicio de la cuadrícula */
const HORA_INICIO = 6
/** Hora de fin de la cuadrícula */
const HORA_FIN = 20
/** Altura en px de cada fila de 1 hora */
const ALTURA_FILA = 40
/** Ancho de la columna de etiquetas de hora */
const ANCHO_COL_HORA = 48
/** Nombres cortos de días (lunes primero) */
const NOMBRES_DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
/** Nombres completos para la lista de bloques */
const NOMBRES_DIAS_COMPLETOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** Nombres cortos de meses */
const NOMBRES_MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** Horas visibles en la cuadrícula */
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

// --- Utilidades de fecha ---

/** Inicio de semana (lunes) para una fecha dada */
function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diff)
  return d
}

/** Genera los 7 días de la semana que contiene la fecha dada (lun-dom) */
function diasDeLaSemana(fecha: Date): Date[] {
  const lunes = inicioSemana(fecha)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

/** Formatea fecha como YYYY-MM-DD */
function formatoISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Compara si dos fechas son el mismo día */
function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

/** Comprueba si la fecha es hoy */
function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

/** Convierte hora y minutos a posición Y en px */
function tiempoAPx(horas: number, minutos: number): number {
  return (horas * 60 + minutos - HORA_INICIO * 60) * (ALTURA_FILA / 60)
}

/** Redondea una posición Y a intervalos de 30 minutos */
function redondearYA30Min(y: number): number {
  const minutos = (y / ALTURA_FILA) * 60
  const minutosRedondeados = Math.round(minutos / 30) * 30
  return (minutosRedondeados / 60) * ALTURA_FILA
}

/** Convierte una posición Y (px) a hora formateada "HH:MM" */
function horaDesdeY(y: number): string {
  const minutosDesdeInicio = (y / ALTURA_FILA) * 60
  const horaTotal = HORA_INICIO * 60 + minutosDesdeInicio
  const horas = Math.floor(horaTotal / 60)
  const minutos = Math.round(horaTotal % 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/** Formatea un bloque para mostrar en la lista: "Mié 8 Abr 08:00 - 12:00" */
function formatoBloque(bloque: BloqueHorario): string {
  const [anio, mes, dia] = bloque.fecha.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  const nombreDia = NOMBRES_DIAS_COMPLETOS[fecha.getDay()]
  const nombreDiaCorto = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1, 3)
  const nombreMes = NOMBRES_MESES[fecha.getMonth()]
  return `${nombreDiaCorto} ${dia} ${nombreMes} ${bloque.horaInicio} – ${bloque.horaFin}`
}

// --- Componente principal ---

function SelectorCalendarioBloque({
  abierto,
  bloques,
  onCambiar,
  onCerrar,
  titulo,
}: PropiedadesSelectorCalendario) {
  // Semana actual de navegación
  const [fechaBase, setFechaBase] = useState(() => new Date())
  // Vista activa (semana o día)
  const [vista, setVista] = useState<VistaSelector>('semana')
  // Día seleccionado en vista día
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => new Date())
  // Eventos existentes del calendario
  const [eventosExistentes, setEventosExistentes] = useState<EventoExistente[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(false)
  // Estado del arrastre para seleccionar rangos
  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const refArrastre = useRef<EstadoArrastre | null>(null)
  refArrastre.current = arrastre
  // Bloques temporales (copia local que se confirma al cerrar)
  const [bloquesLocal, setBloquesLocal] = useState<BloqueHorario[]>(bloques)
  // Ref a la cuadrícula para calcular posiciones del mouse
  const refCuadricula = useRef<HTMLDivElement>(null)

  // Sincronizar bloques cuando se abre el modal
  useEffect(() => {
    if (abierto) {
      setBloquesLocal(bloques)
    }
  }, [abierto, bloques])

  // Días de la semana actual
  const diasSemana = useMemo(() => diasDeLaSemana(fechaBase), [fechaBase])

  // Días visibles según la vista
  const diasVisibles = useMemo(() => {
    if (vista === 'dia') return [diaSeleccionado]
    return diasSemana
  }, [vista, diasSemana, diaSeleccionado])

  // Etiqueta del rango de fechas: "6 – 12 Abr 2026"
  const etiquetaRango = useMemo(() => {
    if (vista === 'dia') {
      const d = diaSeleccionado
      return `${d.getDate()} ${NOMBRES_MESES[d.getMonth()]} ${d.getFullYear()}`
    }
    const primero = diasSemana[0]
    const ultimo = diasSemana[6]
    const mesIgual = primero.getMonth() === ultimo.getMonth()
    if (mesIgual) {
      return `${primero.getDate()} – ${ultimo.getDate()} ${NOMBRES_MESES[primero.getMonth()].charAt(0).toUpperCase() + NOMBRES_MESES[primero.getMonth()].slice(1)} ${primero.getFullYear()}`
    }
    return `${primero.getDate()} ${NOMBRES_MESES[primero.getMonth()].charAt(0).toUpperCase() + NOMBRES_MESES[primero.getMonth()].slice(1)} – ${ultimo.getDate()} ${NOMBRES_MESES[ultimo.getMonth()].charAt(0).toUpperCase() + NOMBRES_MESES[ultimo.getMonth()].slice(1)} ${ultimo.getFullYear()}`
  }, [vista, diasSemana, diaSeleccionado])

  // Fetch de eventos existentes cuando cambia la semana visible
  useEffect(() => {
    if (!abierto) return

    const controlador = new AbortController()
    const cargarEventos = async () => {
      setCargandoEventos(true)
      try {
        const desde = formatoISO(diasSemana[0])
        const hasta = formatoISO(diasSemana[6])
        // Agregar un día al "hasta" para incluir eventos del último día
        const hastaDate = new Date(diasSemana[6])
        hastaDate.setDate(hastaDate.getDate() + 1)
        const hastaISO = formatoISO(hastaDate)

        const respuesta = await fetch(
          `/api/calendario?desde=${desde}T00:00:00&hasta=${hastaISO}T00:00:00`,
          { signal: controlador.signal },
        )
        if (!respuesta.ok) throw new Error('Error al cargar eventos')
        const datos = await respuesta.json()
        setEventosExistentes(
          (datos || []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            titulo: e.titulo as string,
            fecha_inicio: e.fecha_inicio as string,
            fecha_fin: e.fecha_fin as string,
            color: (e.color as string) || null,
            todo_el_dia: e.todo_el_dia as boolean,
          })),
        )
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error cargando eventos para selector:', error)
        }
      } finally {
        setCargandoEventos(false)
      }
    }

    cargarEventos()
    return () => controlador.abort()
  }, [abierto, diasSemana])

  // Altura total de la cuadrícula
  const alturaTotal = (HORA_FIN - HORA_INICIO) * ALTURA_FILA

  // --- Navegación ---

  const irSemanaAnterior = () => {
    if (vista === 'dia') {
      setDiaSeleccionado(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() - 1)
        return d
      })
      setFechaBase(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() - 1)
        return d
      })
    } else {
      setFechaBase(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() - 7)
        return d
      })
    }
  }

  const irSemanaSiguiente = () => {
    if (vista === 'dia') {
      setDiaSeleccionado(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() + 1)
        return d
      })
      setFechaBase(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() + 1)
        return d
      })
    } else {
      setFechaBase(prev => {
        const d = new Date(prev)
        d.setDate(d.getDate() + 7)
        return d
      })
    }
  }

  // --- Eventos agrupados por día (para renderizar bloques existentes) ---

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoExistente[]>()
    for (const evento of eventosExistentes) {
      if (evento.todo_el_dia) continue
      const fechaInicio = new Date(evento.fecha_inicio)
      for (const dia of diasVisibles) {
        if (mismoDia(fechaInicio, dia)) {
          const clave = formatoISO(dia)
          if (!mapa.has(clave)) mapa.set(clave, [])
          mapa.get(clave)!.push(evento)
        }
      }
    }
    return mapa
  }, [eventosExistentes, diasVisibles])

  // --- Bloques seleccionados agrupados por día (para renderizar en cuadrícula) ---

  const bloquesPorDia = useMemo(() => {
    const mapa = new Map<string, BloqueHorario[]>()
    for (const bloque of bloquesLocal) {
      if (!mapa.has(bloque.fecha)) mapa.set(bloque.fecha, [])
      mapa.get(bloque.fecha)!.push(bloque)
    }
    return mapa
  }, [bloquesLocal])

  // --- Arrastre para seleccionar rangos ---

  /** Inicia el arrastre al hacer mousedown en la cuadrícula */
  const manejarMouseDown = useCallback((indiceDia: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = redondearYA30Min(Math.max(0, e.clientY - rect.top))

    setArrastre({
      indiceDia,
      inicioY: y,
      finY: y,
      activa: true,
    })
  }, [])

  /** Actualiza la posición durante el arrastre */
  const manejarMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!refArrastre.current?.activa) return

    // Encontrar la columna del día correspondiente
    const columnaDiv = e.currentTarget.querySelector(
      `[data-selector-dia="${refArrastre.current.indiceDia}"]`,
    ) as HTMLElement | null
    if (!columnaDiv) return

    const rect = columnaDiv.getBoundingClientRect()
    const yRelativo = e.clientY - rect.top
    const yClamped = Math.max(0, Math.min(yRelativo, alturaTotal))
    const yRedondeado = redondearYA30Min(yClamped)

    setArrastre(prev => prev ? { ...prev, finY: yRedondeado } : null)
  }, [alturaTotal])

  /** Finaliza el arrastre y agrega el bloque */
  useEffect(() => {
    const manejarMouseUp = () => {
      const sel = refArrastre.current
      if (!sel?.activa) return

      const yMin = Math.min(sel.inicioY, sel.finY)
      const yMax = Math.max(sel.inicioY, sel.finY)
      const altura = yMax - yMin

      // Umbral mínimo: al menos 30 min (media hora)
      const umbralMinimo = (30 / 60) * ALTURA_FILA * 0.5
      if (altura > umbralMinimo) {
        const dia = diasVisibles[sel.indiceDia]
        if (dia) {
          const horaInicio = horaDesdeY(yMin)
          const horaFin = horaDesdeY(yMax)
          const fecha = formatoISO(dia)

          setBloquesLocal(prev => [...prev, { fecha, horaInicio, horaFin }])
        }
      }

      setArrastre(null)
    }

    document.addEventListener('mouseup', manejarMouseUp)
    return () => document.removeEventListener('mouseup', manejarMouseUp)
  }, [diasVisibles])

  // --- Eliminar un bloque de la lista ---

  const eliminarBloque = (indice: number) => {
    setBloquesLocal(prev => prev.filter((_, i) => i !== indice))
  }

  // --- Confirmar y cerrar ---

  const confirmar = () => {
    onCambiar(bloquesLocal)
    onCerrar()
  }

  const cancelar = () => {
    onCerrar()
  }

  // --- Número de columnas según vista ---
  const numColumnas = vista === 'dia' ? 1 : 7

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={cancelar}
      tamano="4xl"
      forzarModal
      sinPadding
      acciones={
        <>
          <Boton variante="secundario" tamano="sm" onClick={cancelar}>
            Cancelar
          </Boton>
          <Boton tamano="sm" onClick={confirmar}>
            Confirmar ({bloquesLocal.length})
          </Boton>
        </>
      }
    >
      <div className="flex flex-col h-[70vh] max-h-[700px]">
        {/* ── Encabezado: navegación + vista ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-texto-marca" />
            <span className="text-sm font-medium text-texto-primario truncate max-w-[200px]">
              {titulo ? `Agendar: ${titulo}` : 'Agendar en calendario'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Navegación anterior/siguiente */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={irSemanaAnterior}
                className="p-1 rounded-md hover:bg-superficie-hover text-texto-secundario transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-texto-primario min-w-[140px] text-center">
                {etiquetaRango}
              </span>
              <button
                type="button"
                onClick={irSemanaSiguiente}
                className="p-1 rounded-md hover:bg-superficie-hover text-texto-secundario transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Toggle semana/día */}
            <div className="flex rounded-lg border border-borde-sutil overflow-hidden">
              <button
                type="button"
                onClick={() => setVista('semana')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  vista === 'semana'
                    ? 'bg-texto-marca/10 text-texto-marca'
                    : 'text-texto-secundario hover:bg-superficie-hover'
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => {
                  setVista('dia')
                  setDiaSeleccionado(new Date())
                }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  vista === 'dia'
                    ? 'bg-texto-marca/10 text-texto-marca'
                    : 'text-texto-secundario hover:bg-superficie-hover'
                }`}
              >
                Dia
              </button>
            </div>
          </div>
        </div>

        {/* ── Encabezado de días ── */}
        <div className="flex border-b border-borde-sutil shrink-0">
          {/* Esquina vacía (columna de horas) */}
          <div className="shrink-0 border-r border-borde-sutil" style={{ width: ANCHO_COL_HORA }} />

          {/* Nombres y números de días */}
          <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumnas}, 1fr)` }}>
            {diasVisibles.map((dia: Date) => {
              const hoyFlag = esHoy(dia)
              const indiceDia = dia.getDay() === 0 ? 6 : dia.getDay() - 1
              return (
                <div
                  key={formatoISO(dia)}
                  className="flex flex-col items-center py-1.5 border-r border-borde-sutil last:border-r-0"
                >
                  <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
                    {NOMBRES_DIAS[indiceDia]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVista('dia')
                      setDiaSeleccionado(dia)
                    }}
                    className={[
                      'mt-0.5 flex items-center justify-center size-6 rounded-full text-xs font-semibold leading-none transition-colors',
                      hoyFlag
                        ? 'bg-texto-marca/10 text-texto-marca'
                        : 'text-texto-primario hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    {dia.getDate()}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Cuadrícula horaria (scrollable) ── */}
        <div ref={refCuadricula} className="flex-1 overflow-y-auto min-h-0">
          <div className="flex relative" style={{ height: alturaTotal }}>
            {/* Columna de etiquetas de hora */}
            <div
              className="shrink-0 relative border-r border-borde-sutil"
              style={{ width: ANCHO_COL_HORA }}
            >
              {HORAS.map((hora) => (
                <div
                  key={hora}
                  className="absolute right-2 text-[10px] text-texto-terciario leading-none -translate-y-1/2"
                  style={{ top: tiempoAPx(hora, 0) }}
                >
                  {String(hora).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            <div
              className="flex-1 relative"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumnas}, 1fr)` }}
              onMouseMove={manejarMouseMove}
            >
              {/* Líneas horizontales de hora completa */}
              {HORAS.map((hora) => (
                <div
                  key={`linea-${hora}`}
                  className="absolute left-0 right-0 border-t border-borde-sutil pointer-events-none"
                  style={{ top: tiempoAPx(hora, 0), gridColumn: '1 / -1' }}
                />
              ))}

              {/* Líneas punteadas de media hora */}
              {HORAS.slice(0, -1).map((hora) => (
                <div
                  key={`media-${hora}`}
                  className="absolute left-0 right-0 border-t border-dashed border-borde-sutil/40 pointer-events-none"
                  style={{ top: tiempoAPx(hora, 30), gridColumn: '1 / -1' }}
                />
              ))}

              {/* Columnas individuales de cada día */}
              {diasVisibles.map((dia: Date, indice: number) => {
                const clave = formatoISO(dia)
                const hoyFlag = esHoy(dia)
                const eventosDelDia = eventosPorDia.get(clave) || []
                const bloquesDelDia = bloquesPorDia.get(clave) || []
                const arrastrandoAqui = arrastre?.activa && arrastre.indiceDia === indice

                return (
                  <div
                    key={clave}
                    data-selector-dia={indice}
                    className={[
                      'relative border-r border-borde-sutil last:border-r-0 cursor-crosshair',
                      hoyFlag ? 'bg-texto-marca/[0.02]' : '',
                    ].join(' ')}
                    style={{ height: alturaTotal }}
                    onMouseDown={(e) => manejarMouseDown(indice, e)}
                  >
                    {/* Eventos existentes (bloques grises semi-transparentes) */}
                    {eventosDelDia.map((evento) => {
                      const inicio = new Date(evento.fecha_inicio)
                      const fin = new Date(evento.fecha_fin)
                      const inicioMin = inicio.getHours() * 60 + inicio.getMinutes()
                      const finMin = fin.getHours() * 60 + fin.getMinutes()
                      const topPx = tiempoAPx(Math.floor(inicioMin / 60), inicioMin % 60)
                      const alturaPx = Math.max(
                        (finMin - inicioMin) * (ALTURA_FILA / 60),
                        10,
                      )

                      return (
                        <div
                          key={evento.id}
                          className="absolute left-1 right-1 rounded text-[9px] leading-tight px-1 py-0.5 overflow-hidden pointer-events-none select-none"
                          style={{
                            top: topPx,
                            height: alturaPx,
                            backgroundColor: 'var(--superficie-elevada)',
                            border: '1px solid var(--borde-sutil)',
                            color: 'var(--texto-terciario)',
                            opacity: 0.7,
                          }}
                        >
                          <span className="truncate block font-medium">{evento.titulo}</span>
                          <span className="opacity-60">
                            {String(inicio.getHours()).padStart(2, '0')}:{String(inicio.getMinutes()).padStart(2, '0')}
                            {' – '}
                            {String(fin.getHours()).padStart(2, '0')}:{String(fin.getMinutes()).padStart(2, '0')}
                          </span>
                        </div>
                      )
                    })}

                    {/* Bloques ya seleccionados (color marca) */}
                    {bloquesDelDia.map((bloque, bi) => {
                      const [hi, mi] = bloque.horaInicio.split(':').map(Number)
                      const [hf, mf] = bloque.horaFin.split(':').map(Number)
                      const topPx = tiempoAPx(hi, mi)
                      const alturaPx = Math.max(
                        ((hf * 60 + mf) - (hi * 60 + mi)) * (ALTURA_FILA / 60),
                        10,
                      )

                      return (
                        <div
                          key={`bloque-${bi}`}
                          className="absolute left-1 right-1 rounded text-[9px] leading-tight px-1.5 py-0.5 overflow-hidden select-none z-10"
                          style={{
                            top: topPx,
                            height: alturaPx,
                            backgroundColor: 'color-mix(in srgb, var(--texto-marca) 20%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--texto-marca) 40%, transparent)',
                            color: 'var(--texto-marca)',
                          }}
                        >
                          <span className="truncate block font-medium">
                            {bloque.horaInicio} – {bloque.horaFin}
                          </span>
                        </div>
                      )
                    })}

                    {/* Resaltado del arrastre activo */}
                    {arrastrandoAqui && arrastre && (
                      <div
                        className="absolute left-1 right-1 rounded z-20 pointer-events-none"
                        style={{
                          top: Math.min(arrastre.inicioY, arrastre.finY),
                          height: Math.max(
                            Math.abs(arrastre.finY - arrastre.inicioY),
                            (30 / 60) * ALTURA_FILA,
                          ),
                          backgroundColor: 'var(--texto-marca)',
                          opacity: 0.15,
                        }}
                      >
                        <span
                          className="text-[10px] font-medium px-1 select-none"
                          style={{ color: 'var(--texto-marca)', opacity: 1 }}
                        >
                          {horaDesdeY(Math.min(arrastre.inicioY, arrastre.finY))}
                          {' – '}
                          {horaDesdeY(Math.max(arrastre.inicioY, arrastre.finY))}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Lista de bloques seleccionados ── */}
        <div className="shrink-0 border-t border-borde-sutil px-4 py-3 bg-superficie-tarjeta/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-texto-secundario">
              Bloques seleccionados ({bloquesLocal.length})
            </span>
            {bloquesLocal.length > 0 && (
              <button
                type="button"
                onClick={() => setBloquesLocal([])}
                className="text-[10px] text-texto-terciario hover:text-estado-error transition-colors"
              >
                Limpiar todos
              </button>
            )}
          </div>

          {bloquesLocal.length === 0 ? (
            <p className="text-xs text-texto-terciario italic">
              Arrastrá sobre la cuadrícula para seleccionar bloques horarios.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {bloquesLocal.map((bloque, i) => (
                  <motion.div
                    key={`${bloque.fecha}-${bloque.horaInicio}-${bloque.horaFin}-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario"
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--texto-marca)' }}
                    />
                    <span>{formatoBloque(bloque)}</span>
                    <button
                      type="button"
                      onClick={() => eliminarBloque(i)}
                      className="p-0.5 text-texto-terciario hover:text-estado-error transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </ModalAdaptable>
  )
}

export { SelectorCalendarioBloque }
export type { BloqueHorario, PropiedadesSelectorCalendario }
