'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

/**
 * SelectorFecha — DatePicker con calendario desplegable + input escribible.
 * Permite escribir la fecha con autoformateo según config de empresa (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD).
 * También se puede seleccionar desde el calendario desplegable.
 * Guarda en formato ISO (YYYY-MM-DD) para la BD.
 * Se usa en: formularios, filtros de fecha, perfil de usuario.
 */

/** Obtiene el separador y orden de segmentos según el formato de la empresa */
function obtenerConfigFormato(formatoFecha: string) {
  switch (formatoFecha) {
    case 'MM/DD/YYYY': return { separador: '/', orden: ['MM', 'DD', 'YYYY'] as const, placeholder: 'MM/DD/AAAA' }
    case 'YYYY-MM-DD': return { separador: '-', orden: ['YYYY', 'MM', 'DD'] as const, placeholder: 'AAAA-MM-DD' }
    case 'DD/MM/YYYY':
    default: return { separador: '/', orden: ['DD', 'MM', 'YYYY'] as const, placeholder: 'DD/MM/AAAA' }
  }
}

/** Aplica máscara de fecha mientras el usuario escribe */
function aplicarMascaraFecha(textoRaw: string, separador: string): string {
  const soloDigitos = textoRaw.replace(/\D/g, '').slice(0, 8)
  if (soloDigitos.length <= 2) return soloDigitos
  if (soloDigitos.length <= 4) return soloDigitos.slice(0, 2) + separador + soloDigitos.slice(2)
  return soloDigitos.slice(0, 2) + separador + soloDigitos.slice(2, 4) + separador + soloDigitos.slice(4)
}

/** Máscara especial para YYYY-MM-DD (año primero) */
function aplicarMascaraFechaISO(textoRaw: string): string {
  const soloDigitos = textoRaw.replace(/\D/g, '').slice(0, 8)
  if (soloDigitos.length <= 4) return soloDigitos
  if (soloDigitos.length <= 6) return soloDigitos.slice(0, 4) + '-' + soloDigitos.slice(4)
  return soloDigitos.slice(0, 4) + '-' + soloDigitos.slice(4, 6) + '-' + soloDigitos.slice(6)
}

/** Parsea texto con formato a fecha ISO, retorna null si inválida */
function parsearTextoAISO(texto: string, orden: readonly string[]): string | null {
  const soloDigitos = texto.replace(/\D/g, '')
  if (soloDigitos.length !== 8) return null

  let dia: string, mes: string, anio: string

  if (orden[0] === 'YYYY') {
    anio = soloDigitos.slice(0, 4)
    mes = soloDigitos.slice(4, 6)
    dia = soloDigitos.slice(6, 8)
  } else if (orden[0] === 'MM') {
    mes = soloDigitos.slice(0, 2)
    dia = soloDigitos.slice(2, 4)
    anio = soloDigitos.slice(4, 8)
  } else {
    dia = soloDigitos.slice(0, 2)
    mes = soloDigitos.slice(2, 4)
    anio = soloDigitos.slice(4, 8)
  }

  const d = parseInt(dia, 10)
  const m = parseInt(mes, 10)
  const a = parseInt(anio, 10)

  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1900 || a > 2100) return null

  // Validar día real del mes
  const fechaPrueba = new Date(a, m - 1, d)
  if (fechaPrueba.getFullYear() !== a || fechaPrueba.getMonth() !== m - 1 || fechaPrueba.getDate() !== d) return null

  return `${anio}-${mes}-${dia}`
}

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
  placeholder,
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
  const triggerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [posDropdown, setPosDropdown] = useState({ top: 0, left: 0 })

  // Config de formato según empresa
  const formatoFecha = useMemo(() => {
    // Extraer formato de empresa — useFormato expone lo necesario
    // Detectamos el formato actual comparando la salida
    const prueba = fmt.fecha(new Date(2026, 0, 15)) // 15/01/2026 o 01/15/2026 o 2026-01-15
    if (prueba.startsWith('2026')) return 'YYYY-MM-DD'
    if (prueba.startsWith('01')) return 'MM/DD/YYYY'
    return 'DD/MM/YYYY'
  }, [fmt])

  const configFmt = useMemo(() => obtenerConfigFormato(formatoFecha), [formatoFecha])
  const placeholderReal = placeholder || configFmt.placeholder

  // Estado del texto del input (lo que el usuario escribe)
  const [textoInput, setTextoInput] = useState('')
  const [editando, setEditando] = useState(false)

  // Fecha seleccionada parseada
  const fechaSeleccionada = useMemo(() => {
    if (!valor) return null
    const d = new Date(valor + 'T12:00:00')
    return isNaN(d.getTime()) ? null : d
  }, [valor])

  // Sincronizar texto del input cuando cambia el valor externamente (y no estamos editando)
  useEffect(() => {
    if (!editando) {
      setTextoInput(fechaSeleccionada ? fmt.fecha(fechaSeleccionada) : '')
    }
  }, [fechaSeleccionada, fmt, editando])

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

  // Calcular posición del dropdown relativa al trigger — con detección de bordes
  const actualizarPosicion = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const anchoCalendario = 288 // w-72 = 18rem = 288px
    const altoCalendario = 340 // alto aproximado del calendario

    let top = rect.bottom + 4
    let left = rect.left

    // Si se sale por la derecha, alinear al borde derecho del trigger
    if (left + anchoCalendario > window.innerWidth - 8) {
      left = rect.right - anchoCalendario
    }
    // Si se sale por la izquierda
    if (left < 8) left = 8

    // Si se sale por abajo, abrir hacia arriba
    if (top + altoCalendario > window.innerHeight - 8) {
      top = rect.top - altoCalendario - 4
    }

    setPosDropdown({ top, left })
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
    const iso = `${anioVista}-${mes}-${d}`
    onChange(iso)
    setEditando(false)
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

  // Manejar escritura en el input
  const manejarCambioInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const mascara = formatoFecha === 'YYYY-MM-DD'
      ? aplicarMascaraFechaISO(raw)
      : aplicarMascaraFecha(raw, configFmt.separador)
    setTextoInput(mascara)

    // Si tiene 8 dígitos, intentar parsear y aplicar
    const iso = parsearTextoAISO(mascara, configFmt.orden)
    if (iso) {
      onChange(iso)
    }
  }

  const manejarFocoInput = () => {
    setEditando(true)
    if (!abierto) setAbierto(true)
  }

  const manejarBlurInput = () => {
    setEditando(false)
    // Si el texto no es una fecha válida completa, revertir al valor actual
    const iso = parsearTextoAISO(textoInput, configFmt.orden)
    if (!iso && textoInput.replace(/\D/g, '').length > 0) {
      // Texto parcial/inválido — revertir
      setTextoInput(fechaSeleccionada ? fmt.fecha(fechaSeleccionada) : '')
    }
  }

  const manejarTeclaInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const iso = parsearTextoAISO(textoInput, configFmt.orden)
      if (iso) {
        onChange(iso)
        setAbierto(false)
        inputRef.current?.blur()
      }
    }
    if (e.key === 'Escape') {
      setAbierto(false)
      setEditando(false)
      setTextoInput(fechaSeleccionada ? fmt.fecha(fechaSeleccionada) : '')
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium mb-1 ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}

      {/* Input escribible con ícono de calendario */}
      <div
        ref={triggerRef}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all w-full',
          'bg-superficie-tarjeta',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          error ? 'border-insignia-peligro' : abierto ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte hover:border-borde-foco',
        ].join(' ')}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) { setAbierto(!abierto); if (!abierto) inputRef.current?.focus() } }}
          className="shrink-0 bg-transparent border-none cursor-pointer p-0 text-texto-terciario hover:text-texto-secundario transition-colors"
          tabIndex={-1}
        >
          <Calendar size={15} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={textoInput}
          placeholder={placeholderReal}
          onChange={manejarCambioInput}
          onFocus={manejarFocoInput}
          onBlur={manejarBlurInput}
          onKeyDown={manejarTeclaInput}
          className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario tabular-nums"
        />
        {limpiable && valor && !disabled && (
          <span
            onClick={() => { onChange(null); setTextoInput('') }}
            className="text-texto-terciario hover:text-texto-secundario text-xs cursor-pointer shrink-0"
          >
            ✕
          </span>
        )}
      </div>

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
              style={{ top: posDropdown.top, left: posDropdown.left, zIndex: 'var(--z-popover)' as unknown as number }}
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
                      <div key={i} className="h-7 flex items-center justify-center text-xxs font-semibold text-texto-terciario/60">
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
