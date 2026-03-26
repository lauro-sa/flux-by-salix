'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

/**
 * SelectorHora — TimePicker con selectores de hora y minuto.
 * Respeta el formato de hora de la empresa (12h/24h).
 * Valor interno siempre en formato 24h: "HH:mm".
 * Se usa en: horarios, turnos, configuración laboral.
 */

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
  placeholder = 'Seleccionar hora',
  error,
  disabled = false,
  pasoMinutos = 5,
  className = '',
}: PropiedadesSelectorHora) {
  const fmt = useFormato()
  const es12h = fmt.formatoHora === '12h'
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parsear valor
  const { hora, minuto } = useMemo(() => {
    if (!valor) return { hora: 9, minuto: 0 }
    const [h, m] = valor.split(':').map(Number)
    return { hora: h || 0, minuto: m || 0 }
  }, [valor])

  const [horaLocal, setHoraLocal] = useState(hora)
  const [minutoLocal, setMinutoLocal] = useState(minuto)

  useEffect(() => {
    setHoraLocal(hora)
    setMinutoLocal(minuto)
  }, [hora, minuto])

  // Cerrar al click afuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

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

  const textoMostrar = valor ? formatearHora(hora, minuto) : ''

  // Horas rápidas predefinidas
  const horasRapidas = [
    { h: 6, m: 0 }, { h: 7, m: 0 }, { h: 8, m: 0 }, { h: 9, m: 0 },
    { h: 10, m: 0 }, { h: 12, m: 0 }, { h: 13, m: 0 }, { h: 14, m: 0 },
    { h: 16, m: 0 }, { h: 17, m: 0 }, { h: 18, m: 0 }, { h: 20, m: 0 },
  ]

  return (
    <div ref={ref} className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium mb-1 ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}

      {/* Input trigger */}
      <button
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
        <Clock size={15} className="text-texto-terciario shrink-0" />
        <span className={textoMostrar ? 'text-texto-primario flex-1' : 'text-texto-terciario flex-1'}>
          {textoMostrar || placeholder}
        </span>
      </button>

      {error && <span className="text-xs text-insignia-peligro mt-1">{error}</span>}

      {/* Dropdown */}
      <div className="relative">
        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-1 left-0 z-50 w-[240px] bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden"
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
                <p className="text-[10px] text-texto-terciario uppercase font-semibold px-1 mb-1.5">Rápido</p>
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
        </AnimatePresence>
      </div>
    </div>
  )
}

export { SelectorHora, type PropiedadesSelectorHora }
