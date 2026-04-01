'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * InputMoneda — Input numérico que muestra el valor formateado ($ 150.000,00)
 * cuando no está enfocado, y el valor raw (150000) cuando el usuario edita.
 */

const SIMBOLOS: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€', BRL: 'R$', CLP: 'CL$',
  COP: 'COL$', MXN: 'MX$', UYU: '$U', PEN: 'S/',
}

interface PropiedadesInputMoneda {
  etiqueta?: string
  value: string
  onChange: (valor: string) => void
  moneda?: string
  placeholder?: string
  disabled?: boolean
  ayuda?: string
}

export function InputMoneda({ etiqueta, value, onChange, moneda, placeholder = '0,00', disabled = false, ayuda }: PropiedadesInputMoneda) {
  const [enfocado, setEnfocado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const simbolo = moneda ? (SIMBOLOS[moneda] || moneda) : '$'

  const formatear = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return ''
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [])

  const manejarFoco = useCallback(() => {
    setEnfocado(true)
  }, [])

  const manejarBlur = useCallback(() => {
    setEnfocado(false)
    // Normalizar: si escribió "150000" dejarlo como "150000"
    const num = parseFloat(value)
    if (!isNaN(num) && value !== '') {
      onChange(String(num))
    }
  }, [value, onChange])

  const valorMostrar = enfocado ? value : formatear(value)

  return (
    <div className="flex flex-col w-full">
      {etiqueta && (
        <label className="text-sm font-medium mb-1 text-texto-secundario">{etiqueta}</label>
      )}
      <div
        className={`
          flex items-center gap-2 w-full rounded-xl border transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-superficie-app' : 'bg-superficie-tarjeta'}
          ${enfocado ? 'border-texto-marca ring-2 ring-texto-marca/20' : 'border-borde-sutil hover:border-borde-fuerte'}
        `}
      >
        <span className="text-sm text-texto-terciario pl-3 shrink-0 select-none">{simbolo}</span>
        <input
          ref={inputRef}
          type={enfocado ? 'number' : 'text'}
          value={valorMostrar}
          onChange={e => onChange(e.target.value)}
          onFocus={manejarFoco}
          onBlur={manejarBlur}
          placeholder={placeholder}
          disabled={disabled}
          step="0.01"
          min="0"
          className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario py-2.5 pr-3 font-mono placeholder:text-texto-placeholder [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {ayuda && <p className="text-xs text-texto-terciario mt-1">{ayuda}</p>}
    </div>
  )
}
