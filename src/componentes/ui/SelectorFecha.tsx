'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

/**
 * SelectorFecha — DatePicker con calendario desplegable.
 * Muestra la fecha en el formato de la empresa (DD/MM/YYYY).
 * Guarda en formato ISO (YYYY-MM-DD) para la BD.
 * Se usa en: formularios, filtros de fecha, perfil de usuario.
 */

interface PropiedadesSelectorFecha {
  /** Valor en formato ISO: YYYY-MM-DD */
  valor?: string | null
  /** Callback con formato ISO */
  onChange: (valor: string | null) => void
  etiqueta?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Permitir limpiar el valor */
  limpiable?: boolean
  /** Año mínimo navegable */
  anioMin?: number
  /** Año máximo navegable */
  anioMax?: number
  className?: string
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function SelectorFecha({
  valor,
  onChange,
  etiqueta,
  placeholder = 'Seleccionar fecha',
  error,
  disabled = false,
  limpiable = true,
  anioMin = 1920,
  anioMax = 2100,
  className = '',
}: PropiedadesSelectorFecha) {
  const fmt = useFormato()
  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState<'dias' | 'meses' | 'anios'>('dias')
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [posDropdown, setPosDropdown] = useState({ top: 0, left: 0 })

  // Fecha seleccionada parseada
  const fechaSeleccionada = useMemo(() => {
    if (!valor) return null
    const d = new Date(valor + 'T12:00:00')
    return isNaN(d.getTime()) ? null : d
  }, [valor])

  // Mes/año que se está mostrando en el calendario
  const [mesVista, setMesVista] = useState(() => {
    if (fechaSeleccionada) return fechaSeleccionada.getMonth()
    return new Date().getMonth()
  })
  const [anioVista, setAnioVista] = useState(() => {
    if (fechaSeleccionada) return fechaSeleccionada.getFullYear()
    return new Date().getFullYear()
  })

  // Para vista de años — rango de 12 años
  const [anioRangoInicio, setAnioRangoInicio] = useState(() => {
    const a = fechaSeleccionada ? fechaSeleccionada.getFullYear() : new Date().getFullYear()
    return Math.floor(a / 12) * 12
  })

  // Sincronizar vista cuando cambia el valor externamente
  useEffect(() => {
    if (fechaSeleccionada) {
      setMesVista(fechaSeleccionada.getMonth())
      setAnioVista(fechaSeleccionada.getFullYear())
    }
  }, [fechaSeleccionada])

  // Calcular posición del dropdown relativa al trigger
  const actualizarPosicion = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosDropdown({ top: rect.bottom + 4, left: rect.left })
  }, [])

  // Cerrar al click afuera + recalcular posición en scroll/resize
  useEffect(() => {
    if (!abierto) return
    actualizarPosicion()
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const dentroDropdown = ref.current?.contains(target)
      const dentroTrigger = triggerRef.current?.contains(target)
      if (!dentroDropdown && !dentroTrigger) {
        setAbierto(false)
        setVista('dias')
      }
    }
    const onScrollResize = () => actualizarPosicion()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [abierto, actualizarPosicion])

  // Generar días del mes
  const dias = useMemo(() => {
    const primerDia = new Date(anioVista, mesVista, 1)
    const ultimoDia = new Date(anioVista, mesVista + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const offset = (primerDia.getDay() - fmt.diaInicioSemana + 7) % 7

    const resultado: (number | null)[] = []
    for (let i = 0; i < offset; i++) resultado.push(null)
    for (let d = 1; d <= diasEnMes; d++) resultado.push(d)
    return resultado
  }, [anioVista, mesVista, fmt.diaInicioSemana])

  const hoy = new Date()
  const esHoy = (dia: number) => hoy.getFullYear() === anioVista && hoy.getMonth() === mesVista && hoy.getDate() === dia
  const esSeleccionado = (dia: number) => {
    if (!fechaSeleccionada) return false
    return fechaSeleccionada.getFullYear() === anioVista && fechaSeleccionada.getMonth() === mesVista && fechaSeleccionada.getDate() === dia
  }

  const seleccionarDia = (dia: number) => {
    const mes = String(mesVista + 1).padStart(2, '0')
    const d = String(dia).padStart(2, '0')
    onChange(`${anioVista}-${mes}-${d}`)
    setAbierto(false)
    setVista('dias')
  }

  const mesAnterior = () => {
    if (mesVista === 0) { setMesVista(11); setAnioVista(a => a - 1) }
    else setMesVista(m => m - 1)
  }

  const mesSiguiente = () => {
    if (mesVista === 11) { setMesVista(0); setAnioVista(a => a + 1) }
    else setMesVista(m => m + 1)
  }

  // Texto a mostrar en el input
  const textoMostrar = fechaSeleccionada ? fmt.fecha(fechaSeleccionada) : ''

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium mb-1 ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}

      {/* Input trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setAbierto(!abierto) }}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left cursor-pointer transition-all w-full',
          'bg-superficie-tarjeta',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          error ? 'border-insignia-peligro' : abierto ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte hover:border-borde-foco',
        ].join(' ')}
      >
        <Calendar size={15} className="text-texto-terciario shrink-0" />
        <span className={textoMostrar ? 'text-texto-primario flex-1' : 'text-texto-terciario flex-1'}>
          {textoMostrar || placeholder}
        </span>
        {limpiable && valor && !disabled && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="text-texto-terciario hover:text-texto-secundario text-xs"
          >
            ✕
          </span>
        )}
      </button>

      {error && <span className="text-xs text-insignia-peligro mt-1">{error}</span>}

      {/* Dropdown calendario — portal para escapar overflow de modales */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={ref}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed w-[280px] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden"
              style={{ top: posDropdown.top, left: posDropdown.left, zIndex: 9999 }}
            >
              {/* ── VISTA DÍAS ── */}
              {vista === 'dias' && (
                <div className="p-3">
                  {/* Nav del mes */}
                  <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={mesAnterior} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setVista('meses')}
                      className="text-sm font-semibold text-texto-primario hover:text-texto-marca cursor-pointer border-none bg-transparent transition-colors"
                    >
                      {MESES[mesVista]} {anioVista}
                    </button>
                    <button type="button" onClick={mesSiguiente} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Encabezados de día */}
                  <div className="grid grid-cols-7 mb-1">
                    {fmt.diasSemanaCortos.map((d, i) => (
                      <div key={i} className="h-7 flex items-center justify-center text-[10px] font-semibold text-texto-terciario/60">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Días */}
                  <div className="grid grid-cols-7">
                    {dias.map((dia, i) => {
                      if (dia === null) return <div key={`v-${i}`} className="h-8" />

                      const sel = esSeleccionado(dia)
                      const hoyEs = esHoy(dia)

                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => seleccionarDia(dia)}
                          className={[
                            'h-8 flex items-center justify-center text-xs rounded-full cursor-pointer border-none transition-colors',
                            sel ? 'text-texto-inverso font-semibold' : '',
                            !sel && hoyEs ? 'font-bold' : '',
                            !sel ? 'bg-transparent hover:bg-superficie-hover text-texto-primario' : '',
                          ].join(' ')}
                          style={
                            sel ? { backgroundColor: 'var(--texto-marca)' }
                            : hoyEs ? { boxShadow: 'inset 0 0 0 1.5px var(--texto-marca)', color: 'var(--texto-marca)' }
                            : undefined
                          }
                        >
                          {dia}
                        </button>
                      )
                    })}
                  </div>

                  {/* Botón hoy */}
                  <div className="mt-2 pt-2 border-t border-borde-sutil flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const h = new Date()
                        seleccionarDia(h.getDate())
                        setMesVista(h.getMonth())
                        setAnioVista(h.getFullYear())
                      }}
                      className="text-xs text-texto-marca hover:underline cursor-pointer border-none bg-transparent font-medium"
                    >
                      Hoy
                    </button>
                  </div>
                </div>
              )}

              {/* ── VISTA MESES ── */}
              {vista === 'meses' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={() => setAnioVista(a => a - 1)} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAnioRangoInicio(Math.floor(anioVista / 12) * 12); setVista('anios') }}
                      className="text-sm font-semibold text-texto-primario hover:text-texto-marca cursor-pointer border-none bg-transparent transition-colors"
                    >
                      {anioVista}
                    </button>
                    <button type="button" onClick={() => setAnioVista(a => a + 1)} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {MESES.map((mes, i) => {
                      const sel = fechaSeleccionada && fechaSeleccionada.getMonth() === i && fechaSeleccionada.getFullYear() === anioVista
                      const actual = hoy.getMonth() === i && hoy.getFullYear() === anioVista
                      return (
                        <button
                          key={mes}
                          type="button"
                          onClick={() => { setMesVista(i); setVista('dias') }}
                          className={[
                            'py-2 rounded-md text-xs font-medium cursor-pointer border-none transition-colors',
                            sel ? 'text-texto-inverso' : '',
                            actual && !sel ? 'font-bold text-texto-marca' : '',
                            !sel ? 'bg-transparent hover:bg-superficie-hover text-texto-primario' : '',
                          ].join(' ')}
                          style={sel ? { backgroundColor: 'var(--texto-marca)' } : undefined}
                        >
                          {mes.slice(0, 3)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── VISTA AÑOS ── */}
              {vista === 'anios' && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={() => setAnioRangoInicio(a => Math.max(anioMin, a - 12))} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronsLeft size={14} />
                    </button>
                    <span className="text-sm font-semibold text-texto-primario">
                      {anioRangoInicio} – {Math.min(anioRangoInicio + 11, anioMax)}
                    </span>
                    <button type="button" onClick={() => setAnioRangoInicio(a => Math.min(anioMax - 11, a + 12))} className="size-7 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                      <ChevronsRight size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, i) => anioRangoInicio + i).map(anio => {
                      if (anio < anioMin || anio > anioMax) return <div key={anio} />
                      const sel = fechaSeleccionada && fechaSeleccionada.getFullYear() === anio
                      const actual = hoy.getFullYear() === anio
                      return (
                        <button
                          key={anio}
                          type="button"
                          onClick={() => { setAnioVista(anio); setVista('meses') }}
                          className={[
                            'py-2 rounded-md text-xs font-medium cursor-pointer border-none transition-colors',
                            sel ? 'text-texto-inverso' : '',
                            actual && !sel ? 'font-bold text-texto-marca' : '',
                            !sel ? 'bg-transparent hover:bg-superficie-hover text-texto-primario' : '',
                          ].join(' ')}
                          style={sel ? { backgroundColor: 'var(--texto-marca)' } : undefined}
                        >
                          {anio}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export { SelectorFecha, type PropiedadesSelectorFecha }
