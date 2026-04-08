'use client'

/**
 * MiniCalendario — Panel flotante arrastrable con calendario compacto.
 * Se posiciona relativo al contenedor padre (área de la vista del calendario).
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

/** Margen desde los bordes del contenedor */
const MARGEN = 12

/** 9 posiciones de anclaje: esquinas, centros de borde, centro */
type PosicionAnclaje =
  | 'arriba-izquierda' | 'arriba-centro' | 'arriba-derecha'
  | 'centro-izquierda' | 'centro' | 'centro-derecha'
  | 'abajo-izquierda' | 'abajo-centro' | 'abajo-derecha'

/** Convierte posición de anclaje a top/left en px dentro del contenedor */
function calcularPosicionAbsoluta(
  pos: PosicionAnclaje,
  contenedorW: number,
  contenedorH: number,
  panelW: number,
  panelH: number,
): { top: number; left: number } {
  let top = 0
  let left = 0

  // Horizontal
  if (pos.includes('izquierda')) {
    left = MARGEN
  } else if (pos.includes('derecha')) {
    left = contenedorW - panelW - MARGEN
  } else {
    // centro horizontal
    left = (contenedorW - panelW) / 2
  }

  // Vertical
  if (pos.startsWith('arriba')) {
    top = MARGEN
  } else if (pos.startsWith('abajo')) {
    top = contenedorH - panelH - MARGEN
  } else {
    // centro vertical
    top = (contenedorH - panelH) / 2
  }

  return { top: Math.max(MARGEN, top), left: Math.max(MARGEN, left) }
}

/** Posiciones de anclaje con coordenadas relativas (0-1) para snap */
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
  // Siempre visible al cargar — solo se oculta si el usuario lo cierra en esta sesión
  const [visible, setVisible] = useState(true)

  const [posicion, setPosicion] = useState<PosicionAnclaje>(() => {
    if (typeof window === 'undefined') return 'abajo-derecha'
    return (localStorage.getItem(STORAGE_KEY) as PosicionAnclaje) || 'abajo-derecha'
  })

  // Posición calculada en px (absoluta dentro del contenedor)
  const [posicionPx, setPosicionPx] = useState<{ top: number; left: number } | null>(null)

  // Estado del arrastre
  const [arrastrando, setArrastrando] = useState(false)
  const [arrastrandoPx, setArrastrandoPx] = useState<{ top: number; left: number } | null>(null)

  const refPanel = useRef<HTMLDivElement>(null)
  const refInicioArrastre = useRef<{ clientX: number; clientY: number; panelTop: number; panelLeft: number } | null>(null)

  // Mes visible (independiente del principal)
  const [mesVisible, setMesVisible] = useState<Date>(
    () => new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1),
  )

  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()
  const semanas = useMemo(() => generarCuadriculaMes(anio, mes), [anio, mes])

  // Sincronizar mes cuando cambia fechaActual
  useEffect(() => {
    setMesVisible(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1))
  }, [fechaActual.getFullYear(), fechaActual.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persistir configuración
  useEffect(() => { localStorage.setItem(STORAGE_KEY, posicion) }, [posicion])
  // No persistir visibilidad — siempre abierto al recargar

  // Recalcular posición absoluta cuando cambia la posición de anclaje o el tamaño
  const recalcularPosicion = useCallback(() => {
    if (!refPanel.current) return
    const contenedor = refPanel.current.parentElement
    if (!contenedor) return
    const cRect = contenedor.getBoundingClientRect()
    const pRect = refPanel.current.getBoundingClientRect()
    const pos = calcularPosicionAbsoluta(posicion, cRect.width, cRect.height, pRect.width, pRect.height)
    setPosicionPx(pos)
  }, [posicion])

  useEffect(() => {
    recalcularPosicion()
    window.addEventListener('resize', recalcularPosicion)
    return () => window.removeEventListener('resize', recalcularPosicion)
  }, [recalcularPosicion])

  // Re-calcular después del primer render para tener dimensiones correctas
  useEffect(() => {
    const timer = setTimeout(recalcularPosicion, 50)
    return () => clearTimeout(timer)
  }, [recalcularPosicion, visible])

  // --- Arrastre ---
  const iniciarArrastre = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!refPanel.current || !posicionPx) return
    refInicioArrastre.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panelTop: posicionPx.top,
      panelLeft: posicionPx.left,
    }
    setArrastrando(true)
    setArrastrandoPx({ ...posicionPx })
  }, [posicionPx])

  useEffect(() => {
    if (!arrastrando) return

    const manejarMove = (e: MouseEvent) => {
      if (!refInicioArrastre.current) return
      const dx = e.clientX - refInicioArrastre.current.clientX
      const dy = e.clientY - refInicioArrastre.current.clientY
      setArrastrandoPx({
        top: refInicioArrastre.current.panelTop + dy,
        left: refInicioArrastre.current.panelLeft + dx,
      })
    }

    const manejarUp = (e: MouseEvent) => {
      setArrastrando(false)
      setArrastrandoPx(null)
      refInicioArrastre.current = null

      // Encontrar posición de anclaje más cercana relativa al contenedor
      if (!refPanel.current) return
      const contenedor = refPanel.current.parentElement
      if (!contenedor) return
      const cRect = contenedor.getBoundingClientRect()

      // Posición relativa del mouse dentro del contenedor (0-1)
      const xRel = Math.max(0, Math.min(1, (e.clientX - cRect.left) / cRect.width))
      const yRel = Math.max(0, Math.min(1, (e.clientY - cRect.top) / cRect.height))

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

    document.addEventListener('mousemove', manejarMove)
    document.addEventListener('mouseup', manejarUp)
    return () => {
      document.removeEventListener('mousemove', manejarMove)
      document.removeEventListener('mouseup', manejarUp)
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

  // Botón para reabrir cuando está oculto
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

  // Posición actual (arrastrando o anclada)
  const posActual = arrastrando && arrastrandoPx ? arrastrandoPx : posicionPx

  return (
    <motion.div
      ref={refPanel}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        top: posActual?.top ?? MARGEN,
        left: posActual?.left ?? MARGEN,
      }}
      transition={arrastrando
        ? { duration: 0 }
        : { type: 'spring', stiffness: 400, damping: 30 }
      }
      className={[
        'absolute z-30 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl select-none w-[230px]',
        arrastrando ? 'shadow-2xl ring-2 ring-texto-marca/20 cursor-grabbing' : '',
      ].join(' ')}
      style={{ position: 'absolute' }}
    >
      {/* Barra de título (arrastrable) */}
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

        {/* Cabeceras de días */}
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
  )
}

export { MiniCalendario }
