'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

/**
 * SelectorHora — TimePicker con selectores de hora/minuto + input escribible.
 * Permite escribir la hora con autoformateo (HH:MM para 24h, HH:MM AM/PM para 12h).
 * Respeta el formato de hora de la empresa (12h/24h).
 * Valor interno siempre en formato 24h: "HH:mm".
 * Se usa en: horarios, turnos, configuración laboral.
 */

/** Aplica máscara de hora mientras el usuario escribe */
function aplicarMascaraHora(textoRaw: string): string {
  const soloDigitos = textoRaw.replace(/\D/g, '').slice(0, 4)
  if (soloDigitos.length <= 2) return soloDigitos
  return soloDigitos.slice(0, 2) + ':' + soloDigitos.slice(2)
}

/** Parsea texto de hora a formato 24h "HH:mm", retorna null si inválido */
function parsearTextoAHora24(texto: string, es12h: boolean): string | null {
  // Extraer dígitos
  const soloDigitos = texto.replace(/[^0-9]/g, '')
  if (soloDigitos.length < 3 || soloDigitos.length > 4) return null

  const h = parseInt(soloDigitos.slice(0, soloDigitos.length - 2), 10)
  const m = parseInt(soloDigitos.slice(-2), 10)

  if (m < 0 || m > 59) return null

  if (es12h) {
    const textoUpper = texto.toUpperCase()
    const esAM = textoUpper.includes('A')
    const esPM = textoUpper.includes('P')
    if (!esAM && !esPM) return null
    if (h < 1 || h > 12) return null

    let hora24 = h
    if (esAM && h === 12) hora24 = 0
    else if (esPM && h !== 12) hora24 = h + 12

    return `${String(hora24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  if (h < 0 || h > 23) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface PropiedadesSelectorHora {
  /** Valor en formato "HH:mm" (24h) */
  valor?: string | null
  onChange: (valor: string | null) => void
  etiqueta?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Paso de minutos (default: 5) */
  pasoMinutos?: number
  className?: string
}

function SelectorHora({
  valor,
  onChange,
  etiqueta,
  placeholder,
  error,
  disabled = false,
  pasoMinutos = 5,
  className = '',
}: PropiedadesSelectorHora) {
  const fmt = useFormato()
  const es12h = fmt.formatoHora === '12h'
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [posDropdown, setPosDropdown] = useState({ top: 0, left: 0 })

  const placeholderReal = placeholder || (es12h ? 'HH:MM AM' : 'HH:MM')

  // Parsear valor
  const { hora, minuto } = useMemo(() => {
    if (!valor) return { hora: 9, minuto: 0 }
    const [h, m] = valor.split(':').map(Number)
    return { hora: h || 0, minuto: m || 0 }
  }, [valor])

  const [horaLocal, setHoraLocal] = useState(hora)
  const [minutoLocal, setMinutoLocal] = useState(minuto)

  // Estado del input escribible
  const [textoInput, setTextoInput] = useState('')
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    setHoraLocal(hora)
    setMinutoLocal(minuto)
  }, [hora, minuto])

  // Sincronizar texto cuando cambia el valor externamente
  useEffect(() => {
    if (!editando) {
      setTextoInput(valor ? formatearHora(hora, minuto) : '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hora, minuto, valor, editando])

  // Calcular posición del dropdown relativa al trigger
  const actualizarPosicion = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const anchoDropdown = 240
    const altoDropdown = 280

    let top = rect.bottom + 4
    let left = rect.left

    // Si se sale por la derecha
    if (left + anchoDropdown > window.innerWidth - 8) {
      left = rect.right - anchoDropdown
    }
    if (left < 8) left = 8

    // Si se sale por abajo, abrir hacia arriba
    if (top + altoDropdown > window.innerHeight - 8) {
      top = rect.top - altoDropdown - 4
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
      if (!dentroDropdown && !dentroTrigger) setAbierto(false)
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

  const aplicar = (h: number, m: number) => {
    const hStr = String(h).padStart(2, '0')
    const mStr = String(m).padStart(2, '0')
    onChange(`${hStr}:${mStr}`)
  }

  const incrementarHora = () => {
    const nueva = (horaLocal + 1) % 24
    setHoraLocal(nueva)
    aplicar(nueva, minutoLocal)
  }

  const decrementarHora = () => {
    const nueva = (horaLocal - 1 + 24) % 24
    setHoraLocal(nueva)
    aplicar(nueva, minutoLocal)
  }

  const incrementarMinuto = () => {
    const nuevo = (minutoLocal + pasoMinutos) % 60
    setMinutoLocal(nuevo)
    aplicar(horaLocal, nuevo)
  }

  const decrementarMinuto = () => {
    const nuevo = (minutoLocal - pasoMinutos + 60) % 60
    setMinutoLocal(nuevo)
    aplicar(horaLocal, nuevo)
  }

  // Formato de display
  const formatearHora = (h: number, m: number): string => {
    if (es12h) {
      const h12 = h % 12 || 12
      const ampm = h < 12 ? 'AM' : 'PM'
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Manejar escritura en el input
  const manejarCambioHoraInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value

    if (es12h) {
      // Permitir letras A, M, P al final para AM/PM
      const letras = raw.replace(/[^AaMmPp]/g, '').toUpperCase()
      const digitos = raw.replace(/\D/g, '').slice(0, 4)
      let mascara = ''
      if (digitos.length <= 2) mascara = digitos
      else mascara = digitos.slice(0, 2) + ':' + digitos.slice(2)

      // Agregar AM/PM si el usuario está escribiendo las letras
      if (letras.includes('A')) mascara += ' AM'
      else if (letras.includes('P')) mascara += ' PM'

      setTextoInput(mascara)
    } else {
      setTextoInput(aplicarMascaraHora(raw))
    }

    // Intentar parsear
    const hora24 = parsearTextoAHora24(es12h ? raw : aplicarMascaraHora(raw), es12h)
    if (hora24) {
      onChange(hora24)
    }
  }

  const manejarFocoHoraInput = () => {
    setEditando(true)
    if (!abierto) setAbierto(true)
  }

  const manejarBlurHoraInput = () => {
    setEditando(false)
    const hora24 = parsearTextoAHora24(textoInput, es12h)
    if (!hora24 && textoInput.replace(/\D/g, '').length > 0) {
      setTextoInput(valor ? formatearHora(hora, minuto) : '')
    }
  }

  const manejarTeclaHoraInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const hora24 = parsearTextoAHora24(textoInput, es12h)
      if (hora24) {
        onChange(hora24)
        setAbierto(false)
        inputRef.current?.blur()
      }
    }
    if (e.key === 'Escape') {
      setAbierto(false)
      setEditando(false)
      setTextoInput(valor ? formatearHora(hora, minuto) : '')
      inputRef.current?.blur()
    }
  }

  // Horas rápidas predefinidas
  const horasRapidas = [
    { h: 6, m: 0 }, { h: 7, m: 0 }, { h: 8, m: 0 }, { h: 9, m: 0 },
    { h: 10, m: 0 }, { h: 12, m: 0 }, { h: 13, m: 0 }, { h: 14, m: 0 },
    { h: 16, m: 0 }, { h: 17, m: 0 }, { h: 18, m: 0 }, { h: 20, m: 0 },
  ]

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium mb-1 ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}

      {/* Input escribible con ícono de reloj */}
      <div
        ref={triggerRef}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all w-full overflow-hidden',
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
          <Clock size={15} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode={es12h ? 'text' : 'numeric'}
          disabled={disabled}
          value={textoInput}
          placeholder={placeholderReal}
          onChange={manejarCambioHoraInput}
          onFocus={manejarFocoHoraInput}
          onBlur={manejarBlurHoraInput}
          onKeyDown={manejarTeclaHoraInput}
          className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario tabular-nums"
        />
      </div>

      {error && <span className="text-xs text-insignia-peligro mt-1">{error}</span>}

      {/* Dropdown — portal para escapar overflow de modales/popovers */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={ref}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed w-[240px] max-w-[calc(100vw-2rem)] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden"
              style={{ top: posDropdown.top, left: posDropdown.left, zIndex: 'var(--z-popover)' as unknown as number }}
            >
              {/* Selector con flechas */}
              <div className="p-4 flex items-center justify-center gap-4">
                {/* Hora */}
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={incrementarHora} className="size-8 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                    <ChevronUp size={16} />
                  </button>
                  <div className="text-2xl font-bold text-texto-primario tabular-nums w-12 text-center">
                    {es12h ? String(horaLocal % 12 || 12).padStart(2, '0') : String(horaLocal).padStart(2, '0')}
                  </div>
                  <button type="button" onClick={decrementarHora} className="size-8 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                    <ChevronDown size={16} />
                  </button>
                </div>

                <span className="text-2xl font-bold text-texto-terciario">:</span>

                {/* Minuto */}
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={incrementarMinuto} className="size-8 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                    <ChevronUp size={16} />
                  </button>
                  <div className="text-2xl font-bold text-texto-primario tabular-nums w-12 text-center">
                    {String(minutoLocal).padStart(2, '0')}
                  </div>
                  <button type="button" onClick={decrementarMinuto} className="size-8 flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario">
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* AM/PM toggle (solo 12h) */}
                {es12h && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => { if (horaLocal >= 12) { const nueva = horaLocal - 12; setHoraLocal(nueva); aplicar(nueva, minutoLocal) } }}
                      className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer border-none transition-colors ${horaLocal < 12 ? 'bg-texto-marca text-texto-inverso' : 'bg-transparent text-texto-terciario hover:bg-superficie-hover'}`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (horaLocal < 12) { const nueva = horaLocal + 12; setHoraLocal(nueva); aplicar(nueva, minutoLocal) } }}
                      className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer border-none transition-colors ${horaLocal >= 12 ? 'bg-texto-marca text-texto-inverso' : 'bg-transparent text-texto-terciario hover:bg-superficie-hover'}`}
                    >
                      PM
                    </button>
                  </div>
                )}
              </div>

              {/* Horas rápidas */}
              <div className="border-t border-borde-sutil p-2">
                <p className="text-xxs text-texto-terciario uppercase font-semibold px-1 mb-1.5">Rápido</p>
                <div className="grid grid-cols-4 gap-1">
                  {horasRapidas.map(({ h, m }) => (
                    <button
                      key={`${h}-${m}`}
                      type="button"
                      onClick={() => { setHoraLocal(h); setMinutoLocal(m); aplicar(h, m); setAbierto(false) }}
                      className={[
                        'py-1.5 rounded text-xs font-medium cursor-pointer border-none transition-colors',
                        horaLocal === h && minutoLocal === m ? 'bg-texto-marca/15 text-texto-marca' : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
                      ].join(' ')}
                    >
                      {formatearHora(h, m)}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export { SelectorHora, type PropiedadesSelectorHora }
