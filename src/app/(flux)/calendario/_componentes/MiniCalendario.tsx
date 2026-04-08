'use client'

/**
 * MiniCalendario — Panel flotante arrastrable con calendario compacto.
 * 6 posiciones de anclaje (4 esquinas + centro-izquierda + centro-derecha).
 * Al arrastrar muestra indicadores fantasma en cada posición posible.
 * Se usa en: página del calendario (vistas día, semana, quincenal, equipo).
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, GripHorizontal, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- Constantes ---

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CABECERAS_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const STORAGE_KEY = 'flux_mini_cal_pos'
const PANEL_W = 230
const PANEL_H = 280
const MARGEN = 8

/** 6 posiciones de anclaje */
type PosicionAnclaje =
  | 'arriba-izquierda' | 'arriba-derecha'
  | 'centro-izquierda' | 'centro-derecha'
  | 'abajo-izquierda' | 'abajo-derecha'

interface PosicionInfo {
  id: PosicionAnclaje
  /** Calcula top/left en px dado el tamaño del contenedor */
  calcular: (cW: number, cH: number) => { top: number; left: number }
}

const POSICIONES: PosicionInfo[] = [
  {
    id: 'arriba-izquierda',
    calcular: () => ({ top: MARGEN, left: MARGEN }),
  },
  {
    id: 'arriba-derecha',
    calcular: (cW) => ({ top: MARGEN, left: cW - PANEL_W - MARGEN }),
  },
  {
    id: 'centro-izquierda',
    calcular: (_, cH) => ({ top: (cH - PANEL_H) / 2, left: MARGEN }),
  },
  {
    id: 'centro-derecha',
    calcular: (cW, cH) => ({ top: (cH - PANEL_H) / 2, left: cW - PANEL_W - MARGEN }),
  },
  {
    id: 'abajo-izquierda',
    calcular: (_, cH) => ({ top: cH - PANEL_H - MARGEN, left: MARGEN }),
  },
  {
    id: 'abajo-derecha',
    calcular: (cW, cH) => ({ top: cH - PANEL_H - MARGEN, left: cW - PANEL_W - MARGEN }),
  },
]

/** Encuentra la posición de anclaje más cercana a un punto */
function posicionMasCercana(
  mouseX: number,
  mouseY: number,
  cW: number,
  cH: number,
): PosicionAnclaje {
  let mejor: PosicionAnclaje = 'abajo-derecha'
  let menorDist = Infinity

  for (const pos of POSICIONES) {
    const { top, left } = pos.calcular(cW, cH)
    const centroX = left + PANEL_W / 2
    const centroY = top + PANEL_H / 2
    const dist = Math.hypot(mouseX - centroX, mouseY - centroY)
    if (dist < menorDist) {
      menorDist = dist
      mejor = pos.id
    }
  }

  return mejor
}

// --- Utilidades de fechas ---

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

function generarCuadriculaMes(anio: number, mes: number): Date[][] {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diaInicio = primerDia.getDay()
  const offsetInicio = diaInicio === 0 ? 6 : diaInicio - 1
  const dias: Date[] = []

  for (let i = offsetInicio - 1; i >= 0; i--) dias.push(new Date(anio, mes, -i))
  for (let i = 1; i <= ultimoDia.getDate(); i++) dias.push(new Date(anio, mes, i))
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) dias.push(new Date(anio, mes + 1, i))
  }

  const semanas: Date[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  return semanas
}

// --- Props ---

interface PropiedadesMiniCalendario {
  fechaActual: Date
  onSeleccionarDia: (fecha: Date) => void
  onCambiarMes?: (fecha: Date) => void
}

// --- Componente ---

function MiniCalendario({ fechaActual, onSeleccionarDia, onCambiarMes }: PropiedadesMiniCalendario) {
  const [visible, setVisible] = useState(true)

  const [posicion, setPosicion] = useState<PosicionAnclaje>(() => {
    if (typeof window === 'undefined') return 'abajo-derecha'
    return (localStorage.getItem(STORAGE_KEY) as PosicionAnclaje) || 'abajo-derecha'
  })

  // Arrastre
  const [arrastrando, setArrastrando] = useState(false)
  const [arrastrandoXY, setArrastrandoXY] = useState<{ top: number; left: number } | null>(null)
  const [posicionFantasma, setPosicionFantasma] = useState<PosicionAnclaje | null>(null)

  const refContenedor = useRef<HTMLDivElement | null>(null)
  const refInicioArrastre = useRef<{
    clientX: number; clientY: number
    panelTop: number; panelLeft: number
  } | null>(null)

  // Mes visible
  const [mesVisible, setMesVisible] = useState<Date>(
    () => new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1),
  )
  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()
  const semanas = useMemo(() => generarCuadriculaMes(anio, mes), [anio, mes])

  useEffect(() => {
    setMesVisible(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1))
  }, [fechaActual.getFullYear(), fechaActual.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { localStorage.setItem(STORAGE_KEY, posicion) }, [posicion])

  // Obtener el contenedor padre (el div relative en page.tsx)
  const obtenerContenedor = useCallback((): HTMLElement | null => {
    return refContenedor.current?.parentElement ?? null
  }, [])

  // Calcular posición en px para una posición de anclaje
  const calcularPx = useCallback((pos: PosicionAnclaje): { top: number; left: number } => {
    const c = obtenerContenedor()
    if (!c) return { top: MARGEN, left: MARGEN }
    const rect = c.getBoundingClientRect()
    const info = POSICIONES.find(p => p.id === pos)
    if (!info) return { top: MARGEN, left: MARGEN }
    return info.calcular(rect.width, rect.height)
  }, [obtenerContenedor])

  // Posición actual anclada
  const [posicionPx, setPosicionPx] = useState<{ top: number; left: number }>({ top: MARGEN, left: MARGEN })

  const recalcular = useCallback(() => {
    setPosicionPx(calcularPx(posicion))
  }, [posicion, calcularPx])

  useEffect(() => {
    recalcular()
    window.addEventListener('resize', recalcular)
    return () => window.removeEventListener('resize', recalcular)
  }, [recalcular])

  useEffect(() => { setTimeout(recalcular, 50) }, [recalcular, visible])

  // --- Arrastre ---
  const iniciarArrastre = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    refInicioArrastre.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panelTop: posicionPx.top,
      panelLeft: posicionPx.left,
    }
    setArrastrando(true)
    setArrastrandoXY({ ...posicionPx })
  }, [posicionPx])

  useEffect(() => {
    if (!arrastrando) return

    const manejarMove = (e: MouseEvent) => {
      if (!refInicioArrastre.current) return
      const dx = e.clientX - refInicioArrastre.current.clientX
      const dy = e.clientY - refInicioArrastre.current.clientY

      setArrastrandoXY({
        top: refInicioArrastre.current.panelTop + dy,
        left: refInicioArrastre.current.panelLeft + dx,
      })

      // Calcular posición fantasma más cercana
      const c = obtenerContenedor()
      if (c) {
        const rect = c.getBoundingClientRect()
        const mouseRelX = e.clientX - rect.left
        const mouseRelY = e.clientY - rect.top
        const cercana = posicionMasCercana(mouseRelX, mouseRelY, rect.width, rect.height)
        setPosicionFantasma(cercana)
      }
    }

    const manejarUp = () => {
      setArrastrando(false)
      setArrastrandoXY(null)
      refInicioArrastre.current = null

      // Anclar a la posición fantasma
      if (posicionFantasma) {
        setPosicion(posicionFantasma)
      }
      setPosicionFantasma(null)
    }

    document.addEventListener('mousemove', manejarMove)
    document.addEventListener('mouseup', manejarUp)
    return () => {
      document.removeEventListener('mousemove', manejarMove)
      document.removeEventListener('mouseup', manejarUp)
    }
  }, [arrastrando, obtenerContenedor, posicionFantasma])

  const irMesAnterior = useCallback(() => {
    setMesVisible(prev => {
      const nuevo = new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      onCambiarMes?.(nuevo)
      return nuevo
    })
  }, [onCambiarMes])

  const irMesSiguiente = useCallback(() => {
    setMesVisible(prev => {
      const nuevo = new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      onCambiarMes?.(nuevo)
      return nuevo
    })
  }, [onCambiarMes])

  // --- Botón reabrir ---
  if (!visible) {
    return (
      <motion.button
        type="button"
        onClick={() => setVisible(true)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-40 bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-texto-marca text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all font-medium text-xs"
        title="Mostrar mini calendario"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Mini calendario
      </motion.button>
    )
  }

  // Posición actual (arrastrando libremente o anclada)
  const posActual = arrastrando && arrastrandoXY ? arrastrandoXY : posicionPx

  return (
    <>
      {/* Indicadores fantasma de las 6 posiciones durante arrastre */}
      <AnimatePresence>
        {arrastrando && (
          <>
            {POSICIONES.map(pos => {
              const c = obtenerContenedor()
              if (!c) return null
              const rect = c.getBoundingClientRect()
              const { top, left } = pos.calcular(rect.width, rect.height)
              const esDestino = posicionFantasma === pos.id

              return (
                <motion.div
                  key={pos.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={[
                    'absolute z-20 rounded-xl border-2 border-dashed pointer-events-none transition-all duration-150',
                    esDestino
                      ? 'border-texto-marca bg-texto-marca/10 scale-100'
                      : 'border-borde-sutil/50 bg-superficie-hover/20 scale-95',
                  ].join(' ')}
                  style={{
                    top,
                    left,
                    width: PANEL_W,
                    height: PANEL_H,
                  }}
                >
                  {esDestino && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs font-medium text-texto-marca/70">Soltar aquí</span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </>
        )}
      </AnimatePresence>

      {/* Panel del mini calendario */}
      <motion.div
        ref={refContenedor}
        animate={{
          top: posActual.top,
          left: posActual.left,
        }}
        transition={arrastrando
          ? { duration: 0 }
          : { type: 'spring', stiffness: 500, damping: 35 }
        }
        className={[
          'absolute z-30 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl select-none',
          arrastrando ? 'shadow-2xl ring-2 ring-texto-marca/30 opacity-80' : '',
        ].join(' ')}
        style={{ width: PANEL_W }}
      >
        {/* Barra arrastrable */}
        <div
          className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5 cursor-grab active:cursor-grabbing"
          onMouseDown={iniciarArrastre}
        >
          <GripHorizontal size={12} className="text-texto-terciario/40" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVisible(false) }}
            className="p-0.5 rounded text-texto-terciario/40 hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            title="Ocultar"
          >
            <X size={11} />
          </button>
        </div>

        <div className="px-2.5 pb-2.5">
          {/* Navegación de mes */}
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={irMesAnterior}
              className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-semibold text-texto-primario">
              {NOMBRES_MESES[mes]} {anio}
            </span>
            <button
              type="button"
              onClick={irMesSiguiente}
              className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Cabeceras */}
          <div className="grid grid-cols-7 mb-0.5">
            {CABECERAS_DIAS.map(nombre => (
              <div key={nombre} className="text-center text-[9px] font-medium text-texto-terciario leading-tight py-0.5">
                {nombre}
              </div>
            ))}
          </div>

          {/* Cuadrícula */}
          <div className="flex flex-col">
            {semanas.map((semana, i) => (
              <div key={i} className="grid grid-cols-7">
                {semana.map(dia => {
                  const esDelMes = dia.getMonth() === mes
                  const esDiaHoy = esHoy(dia)
                  const esSeleccionado = mismoDia(dia, fechaActual)

                  return (
                    <button
                      key={dia.toISOString()}
                      type="button"
                      onClick={() => onSeleccionarDia(dia)}
                      className={[
                        'flex items-center justify-center text-[10px] leading-none py-[2.5px] transition-colors',
                        !esDelMes ? 'text-texto-terciario/30' : '',
                        esDiaHoy ? 'font-bold' : '',
                        esSeleccionado && !esDiaHoy ? 'font-semibold' : '',
                        esDelMes && !esDiaHoy && !esSeleccionado ? 'text-texto-primario hover:text-texto-marca' : '',
                        esDelMes && esSeleccionado && !esDiaHoy ? 'text-texto-marca' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex items-center justify-center size-5 rounded-full transition-colors',
                          esDiaHoy ? 'bg-texto-marca text-white' : '',
                          esSeleccionado && !esDiaHoy ? 'ring-1 ring-texto-marca' : '',
                          !esDiaHoy && !esSeleccionado ? 'hover:bg-superficie-hover' : '',
                        ].join(' ')}
                      >
                        {dia.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Hoy rápido */}
          <button
            type="button"
            onClick={() => onSeleccionarDia(new Date())}
            className="w-full mt-1.5 text-[9px] font-medium text-texto-marca hover:underline"
          >
            Ir a hoy
          </button>
        </div>
      </motion.div>
    </>
  )
}

export { MiniCalendario }
