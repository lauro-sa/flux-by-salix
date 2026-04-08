'use client'

/**
 * MiniCalendario — Panel flotante arrastrable con calendario compacto.
 * Se ancla a 9 posiciones (4 esquinas + 4 centros de borde + centro).
 * Al arrastrar y soltar, snappea a la posición más cercana.
 * La posición se guarda en localStorage para persistir entre sesiones.
 * Se usa en: página del calendario (vistas día, semana, quincenal, equipo).
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, GripHorizontal, X } from 'lucide-react'
import { motion } from 'framer-motion'

// --- Constantes ---

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CABECERAS_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const STORAGE_KEY = 'flux_mini_calendario_posicion'
const STORAGE_KEY_VISIBLE = 'flux_mini_calendario_visible'

/** 9 posiciones de anclaje: esquinas, centros de borde, centro */
type PosicionAnclaje =
  | 'arriba-izquierda' | 'arriba-centro' | 'arriba-derecha'
  | 'centro-izquierda' | 'centro' | 'centro-derecha'
  | 'abajo-izquierda' | 'abajo-centro' | 'abajo-derecha'

/** Convierte una posición de anclaje a CSS inset */
function posicionACSS(pos: PosicionAnclaje): { top?: string; bottom?: string; left?: string; right?: string } {
  const MARGEN = '12px'
  switch (pos) {
    case 'arriba-izquierda': return { top: MARGEN, left: MARGEN }
    case 'arriba-centro': return { top: MARGEN, left: '50%' }
    case 'arriba-derecha': return { top: MARGEN, right: MARGEN }
    case 'centro-izquierda': return { top: '50%', left: MARGEN }
    case 'centro': return { top: '50%', left: '50%' }
    case 'centro-derecha': return { top: '50%', right: MARGEN }
    case 'abajo-izquierda': return { bottom: MARGEN, left: MARGEN }
    case 'abajo-centro': return { bottom: MARGEN, left: '50%' }
    case 'abajo-derecha': return { bottom: MARGEN, right: MARGEN }
  }
}

/** Transform para centrar en posiciones centrales */
function posicionATransform(pos: PosicionAnclaje): string {
  if (pos === 'arriba-centro' || pos === 'abajo-centro') return 'translateX(-50%)'
  if (pos === 'centro-izquierda' || pos === 'centro-derecha') return 'translateY(-50%)'
  if (pos === 'centro') return 'translate(-50%, -50%)'
  return 'none'
}

/** Posiciones de anclaje con coordenadas relativas para snap */
const POSICIONES_ANCLAJE: { id: PosicionAnclaje; xRel: number; yRel: number }[] = [
  { id: 'arriba-izquierda', xRel: 0, yRel: 0 },
  { id: 'arriba-centro', xRel: 0.5, yRel: 0 },
  { id: 'arriba-derecha', xRel: 1, yRel: 0 },
  { id: 'centro-izquierda', xRel: 0, yRel: 0.5 },
  { id: 'centro', xRel: 0.5, yRel: 0.5 },
  { id: 'centro-derecha', xRel: 1, yRel: 0.5 },
  { id: 'abajo-izquierda', xRel: 0, yRel: 1 },
  { id: 'abajo-centro', xRel: 0.5, yRel: 1 },
  { id: 'abajo-derecha', xRel: 1, yRel: 1 },
]

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

  for (let i = offsetInicio - 1; i >= 0; i--) {
    dias.push(new Date(anio, mes, -i))
  }
  for (let i = 1; i <= ultimoDia.getDate(); i++) {
    dias.push(new Date(anio, mes, i))
  }
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) {
      dias.push(new Date(anio, mes + 1, i))
    }
  }

  const semanas: Date[][] = []
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7))
  }
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
  // Estado de visibilidad (persistido)
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const guardado = localStorage.getItem(STORAGE_KEY_VISIBLE)
    return guardado !== 'false'
  })

  // Posición de anclaje (persistida)
  const [posicion, setPosicion] = useState<PosicionAnclaje>(() => {
    if (typeof window === 'undefined') return 'abajo-derecha'
    const guardada = localStorage.getItem(STORAGE_KEY)
    return (guardada as PosicionAnclaje) || 'abajo-derecha'
  })

  // Estado del arrastre
  const [arrastrando, setArrastrando] = useState(false)
  const [arrastrandoPos, setArrastrandoPos] = useState<{ x: number; y: number } | null>(null)
  const refPanel = useRef<HTMLDivElement>(null)
  const refInicioArrastre = useRef<{ x: number; y: number; rect: DOMRect } | null>(null)

  // Mes visible en el mini calendario (independiente del principal)
  const [mesVisible, setMesVisible] = useState<Date>(
    () => new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1),
  )

  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()
  const semanas = useMemo(() => generarCuadriculaMes(anio, mes), [anio, mes])

  // Sincronizar mes visible cuando cambia el mes de fechaActual
  useEffect(() => {
    setMesVisible(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1))
  }, [fechaActual.getFullYear(), fechaActual.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guardar posición en localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, posicion)
  }, [posicion])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VISIBLE, String(visible))
  }, [visible])

  // --- Arrastre del panel ---
  const iniciarArrastre = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!refPanel.current) return
    const rect = refPanel.current.getBoundingClientRect()
    refInicioArrastre.current = { x: e.clientX, y: e.clientY, rect }
    setArrastrando(true)
    setArrastrandoPos({ x: rect.left, y: rect.top })
  }, [])

  useEffect(() => {
    if (!arrastrando) return

    const manejarMouseMove = (e: MouseEvent) => {
      if (!refInicioArrastre.current) return
      const { rect } = refInicioArrastre.current
      const deltaX = e.clientX - refInicioArrastre.current.x
      const deltaY = e.clientY - refInicioArrastre.current.y
      setArrastrandoPos({
        x: rect.left + deltaX,
        y: rect.top + deltaY,
      })
    }

    const manejarMouseUp = (e: MouseEvent) => {
      setArrastrando(false)
      setArrastrandoPos(null)
      refInicioArrastre.current = null

      // Encontrar la posición de anclaje más cercana
      const xRel = e.clientX / window.innerWidth
      const yRel = e.clientY / window.innerHeight

      let mejorPos: PosicionAnclaje = 'abajo-derecha'
      let menorDist = Infinity
      for (const p of POSICIONES_ANCLAJE) {
        const dist = Math.hypot(xRel - p.xRel, yRel - p.yRel)
        if (dist < menorDist) {
          menorDist = dist
          mejorPos = p.id
        }
      }

      setPosicion(mejorPos)
    }

    document.addEventListener('mousemove', manejarMouseMove)
    document.addEventListener('mouseup', manejarMouseUp)
    return () => {
      document.removeEventListener('mousemove', manejarMouseMove)
      document.removeEventListener('mouseup', manejarMouseUp)
    }
  }, [arrastrando])

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

  // Botón para mostrar el mini calendario cuando está oculto
  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="fixed z-40 bottom-4 right-4 p-2 rounded-lg bg-superficie-elevada border border-borde-sutil shadow-lg text-texto-terciario hover:text-texto-primario transition-colors"
        title="Mostrar mini calendario"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    )
  }

  // Estilo del panel (anclado o arrastrando)
  const estiloPanel: React.CSSProperties = arrastrando && arrastrandoPos
    ? {
        position: 'fixed',
        left: arrastrandoPos.x,
        top: arrastrandoPos.y,
        zIndex: 50,
        cursor: 'grabbing',
      }
    : {
        position: 'fixed',
        ...posicionACSS(posicion),
        transform: posicionATransform(posicion),
        zIndex: 40,
      }

  return (
    <motion.div
      ref={refPanel}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={estiloPanel}
      className={[
        'bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl select-none w-[240px]',
        arrastrando ? 'shadow-2xl ring-2 ring-texto-marca/20' : '',
      ].join(' ')}
    >
      {/* Barra de título (arrastrable) */}
      <div
        className="flex items-center justify-between px-3 pt-2 pb-1 cursor-grab active:cursor-grabbing"
        onMouseDown={iniciarArrastre}
      >
        <GripHorizontal size={14} className="text-texto-terciario/50" />
        <span className="text-[10px] text-texto-terciario uppercase tracking-wider font-medium">
          Mini calendario
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(false) }}
          className="p-0.5 rounded text-texto-terciario/50 hover:text-texto-primario hover:bg-superficie-hover transition-colors"
          title="Ocultar"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 pb-3">
        {/* Navegación de mes */}
        <div className="flex items-center justify-between mb-1.5">
          <button
            type="button"
            onClick={irMesAnterior}
            className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-texto-primario">
            {NOMBRES_MESES[mes]} {anio}
          </span>
          <button
            type="button"
            onClick={irMesSiguiente}
            className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Cabeceras de días */}
        <div className="grid grid-cols-7 mb-0.5">
          {CABECERAS_DIAS.map(nombre => (
            <div key={nombre} className="text-center text-[10px] font-medium text-texto-terciario leading-tight py-0.5">
              {nombre}
            </div>
          ))}
        </div>

        {/* Cuadrícula de días */}
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
                      'flex items-center justify-center text-[11px] leading-none py-[3px] transition-colors',
                      !esDelMes ? 'text-texto-terciario/30' : '',
                      esDiaHoy ? 'font-bold' : '',
                      esSeleccionado && !esDiaHoy ? 'font-semibold' : '',
                      esDelMes && !esDiaHoy && !esSeleccionado ? 'text-texto-primario hover:text-texto-marca' : '',
                      esDelMes && esSeleccionado && !esDiaHoy ? 'text-texto-marca' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex items-center justify-center size-5.5 rounded-full transition-colors',
                        esDiaHoy ? 'bg-texto-marca text-white' : '',
                        esSeleccionado && !esDiaHoy ? 'ring-1.5 ring-texto-marca' : '',
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

        {/* Botón "Hoy" rápido */}
        <button
          type="button"
          onClick={() => onSeleccionarDia(new Date())}
          className="w-full mt-2 text-[10px] font-medium text-texto-marca hover:underline"
        >
          Ir a hoy
        </button>
      </div>
    </motion.div>
  )
}

export { MiniCalendario }
