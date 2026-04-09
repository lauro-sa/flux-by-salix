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
import { useTraduccion } from '@/lib/i18n'
import {
  NOMBRES_MESES,
  CABECERAS_DIAS,
  mismoDia,
  esHoy,
  generarCuadriculaMes,
} from './constantes'

const STORAGE_KEY = 'flux_mini_cal_pos'
/** Ancho del panel — más chico en móvil */
const PANEL_W_DESKTOP = 230
const PANEL_W_MOVIL = 190
const PANEL_H_DESKTOP = 270
const PANEL_H_MOVIL = 240
const MARGEN = 8
/** Offset superior para no tapar el header de días/fechas de la grilla */
const TOP_MIN = 90

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

/** Genera las 6 posiciones de anclaje para un tamaño de panel dado */
function obtenerPosiciones(panelW: number, panelH: number): PosicionInfo[] {
  return [
    { id: 'arriba-izquierda', calcular: () => ({ top: TOP_MIN, left: MARGEN }) },
    { id: 'arriba-derecha', calcular: (cW) => ({ top: TOP_MIN, left: cW - panelW - MARGEN }) },
    { id: 'centro-izquierda', calcular: (_, cH) => ({ top: TOP_MIN + (cH - TOP_MIN - panelH) / 2, left: MARGEN }) },
    { id: 'centro-derecha', calcular: (cW, cH) => ({ top: TOP_MIN + (cH - TOP_MIN - panelH) / 2, left: cW - panelW - MARGEN }) },
    { id: 'abajo-izquierda', calcular: (_, cH) => ({ top: cH - panelH - MARGEN, left: MARGEN }) },
    { id: 'abajo-derecha', calcular: (cW, cH) => ({ top: cH - panelH - MARGEN, left: cW - panelW - MARGEN }) },
  ]
}

/** Encuentra la posición de anclaje más cercana a un punto */
function posicionMasCercana(
  mouseX: number,
  mouseY: number,
  cW: number,
  cH: number,
  panelW: number,
  panelH: number,
): PosicionAnclaje {
  let mejor: PosicionAnclaje = 'abajo-derecha'
  let menorDist = Infinity
  const posiciones = obtenerPosiciones(panelW, panelH)

  for (const pos of posiciones) {
    const { top, left } = pos.calcular(cW, cH)
    const centroX = left + panelW / 2
    const centroY = top + panelH / 2
    const dist = Math.hypot(mouseX - centroX, mouseY - centroY)
    if (dist < menorDist) {
      menorDist = dist
      mejor = pos.id
    }
  }

  return mejor
}

// --- Props ---

/** Evento mínimo para marcar días en el mini calendario */
interface EventoMini {
  fecha_inicio: string
  fecha_fin: string
  todo_el_dia: boolean
  color: string | null
  tipo_clave: string | null
}

interface PropiedadesMiniCalendario {
  fechaActual: Date
  onSeleccionarDia: (fecha: Date) => void
  onCambiarMes?: (fecha: Date) => void
  /** Eventos para marcar días (feriados, eventos todo-el-día, días con eventos) */
  eventos?: EventoMini[]
  /** Vista activa del calendario — para recordar visibilidad por vista */
  vistaActiva?: string
}

/** Clave de localStorage para la visibilidad por vista */
const STORAGE_KEY_VISIBLE = 'flux_mini_cal_visible'

/** Lee el mapa de visibilidad por vista desde localStorage */
function leerVisibilidadPorVista(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISIBLE)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Guarda el mapa de visibilidad por vista en localStorage */
function guardarVisibilidadPorVista(mapa: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY_VISIBLE, JSON.stringify(mapa))
}

// --- Componente ---

function MiniCalendario({ fechaActual, onSeleccionarDia, onCambiarMes, eventos = [], vistaActiva }: PropiedadesMiniCalendario) {
  const { t } = useTraduccion()

  // Detectar móvil para ajustar tamaño del panel
  const [esMobile, setEsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const manejar = () => setEsMobile(window.innerWidth < 768)
    window.addEventListener('resize', manejar)
    return () => window.removeEventListener('resize', manejar)
  }, [])
  const PANEL_W = esMobile ? PANEL_W_MOVIL : PANEL_W_DESKTOP
  const PANEL_H = esMobile ? PANEL_H_MOVIL : PANEL_H_DESKTOP

  // Visibilidad por vista — recuerda si el usuario ocultó el mini calendario en cada vista
  const [visible, setVisibleInterno] = useState(() => {
    if (!vistaActiva) return true
    const mapa = leerVisibilidadPorVista()
    // Si no hay preferencia guardada para esta vista, mostrar por defecto
    return mapa[vistaActiva] !== false
  })

  // Cuando cambia la vista activa, leer la preferencia guardada
  useEffect(() => {
    if (!vistaActiva) return
    const mapa = leerVisibilidadPorVista()
    setVisibleInterno(mapa[vistaActiva] !== false)
  }, [vistaActiva])

  /** Cambiar visibilidad y persistir por vista */
  const setVisible = useCallback((nuevoVisible: boolean) => {
    setVisibleInterno(nuevoVisible)
    if (vistaActiva) {
      const mapa = leerVisibilidadPorVista()
      mapa[vistaActiva] = nuevoVisible
      guardarVisibilidadPorVista(mapa)
    }
  }, [vistaActiva])

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

  // Mapa de indicadores por día: clave "YYYY-MM-DD" → { colores, esFeriado, cantidad }
  const indicadoresPorDia = useMemo(() => {
    const mapa = new Map<string, { colores: string[]; esFeriado: boolean; cantidad: number }>()
    for (const ev of eventos) {
      const inicio = new Date(ev.fecha_inicio)
      const fin = new Date(ev.fecha_fin)
      // Iterar por cada día que cubre el evento
      const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
      const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
      while (cursor <= finDia) {
        const clave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        const existente = mapa.get(clave) || { colores: [], esFeriado: false, cantidad: 0 }
        existente.cantidad++
        if (ev.color && !existente.colores.includes(ev.color)) {
          existente.colores.push(ev.color)
        }
        if (ev.todo_el_dia && (ev.tipo_clave === 'bloqueo' || ev.tipo_clave === 'recordatorio')) {
          existente.esFeriado = true
        }
        // Eventos todo-el-día siempre se marcan como especiales
        if (ev.todo_el_dia) {
          existente.esFeriado = true
        }
        mapa.set(clave, existente)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return mapa
  }, [eventos])

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
    const info = obtenerPosiciones(PANEL_W, PANEL_H).find(p => p.id === pos)
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

  // --- Arrastre (mouse + touch) ---
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

  const iniciarArrastreTouch = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    refInicioArrastre.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
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
        top: Math.max(TOP_MIN, refInicioArrastre.current.panelTop + dy),
        left: Math.max(MARGEN, refInicioArrastre.current.panelLeft + dx),
      })

      // Calcular posición fantasma más cercana
      const c = obtenerContenedor()
      if (c) {
        const rect = c.getBoundingClientRect()
        const mouseRelX = e.clientX - rect.left
        const mouseRelY = e.clientY - rect.top
        const cercana = posicionMasCercana(mouseRelX, mouseRelY, rect.width, rect.height, PANEL_W, PANEL_H)
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

    const manejarTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      manejarMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }

    const manejarTouchEnd = () => {
      manejarUp()
    }

    document.addEventListener('mousemove', manejarMove)
    document.addEventListener('mouseup', manejarUp)
    document.addEventListener('touchmove', manejarTouchMove, { passive: false })
    document.addEventListener('touchend', manejarTouchEnd)
    return () => {
      document.removeEventListener('mousemove', manejarMove)
      document.removeEventListener('mouseup', manejarUp)
      document.removeEventListener('touchmove', manejarTouchMove)
      document.removeEventListener('touchend', manejarTouchEnd)
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
        {t('calendario.mini_calendario')}
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
            {obtenerPosiciones(PANEL_W, PANEL_H).map(pos => {
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
                      <span className="text-xs font-medium text-texto-marca/70">{t('calendario.soltar_aqui')}</span>
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
          className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={iniciarArrastre}
          onTouchStart={iniciarArrastreTouch}
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
                  const claveDia = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
                  const indicador = indicadoresPorDia.get(claveDia)

                  return (
                    <button
                      key={dia.toISOString()}
                      type="button"
                      onClick={() => onSeleccionarDia(dia)}
                      className={[
                        'relative flex flex-col items-center text-[10px] leading-none py-[2px] transition-colors',
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
                          // Feriados/todo-el-día: fondo sutil
                          indicador?.esFeriado && !esDiaHoy && !esSeleccionado ? 'bg-insignia-advertencia/15' : '',
                        ].join(' ')}
                      >
                        {dia.getDate()}
                      </span>
                      {/* Puntos indicadores de eventos */}
                      {indicador && esDelMes && (
                        <div className="flex gap-px mt-px">
                          {indicador.colores.slice(0, 3).map((color, idx) => (
                            <span
                              key={idx}
                              className="size-1 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          {indicador.colores.length === 0 && indicador.cantidad > 0 && (
                            <span className="size-1 rounded-full bg-texto-marca" />
                          )}
                        </div>
                      )}
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
            {t('calendario.ir_a_hoy')}
          </button>
        </div>
      </motion.div>
    </>
  )
}

export { MiniCalendario }
