'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

interface PropiedadesBuscador {
  valor?: string
  onChange: (valor: string) => void
  placeholder?: string
  debounce?: number
  autoFocus?: boolean
  className?: string
}

/**
 * Buscador — Campo de búsqueda con debounce, ícono lupa y botón limpiar.
 * Se usa en: búsqueda de contactos, productos, conversaciones, etc.
 */
function Buscador({ valor: valorExterno, onChange, placeholder = 'Buscar...', debounce = 400, autoFocus, className = '' }: PropiedadesBuscador) {
  const [valorInterno, setValorInterno] = useState(valorExterno || '')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (valorExterno !== undefined) setValorInterno(valorExterno)
  }, [valorExterno])

  const manejarCambio = (v: string) => {
    setValorInterno(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), debounce)
  }

  const limpiar = () => {
    setValorInterno('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={16} className="absolute left-3 text-texto-terciario pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={valorInterno}
        onChange={(e) => manejarCambio(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-8 py-2 rounded-md border border-borde-sutil bg-superficie-tarjeta text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-borde-foco focus:shadow-foco transition-all duration-150"
      />
      {valorInterno && (
        <button onClick={limpiar} className="absolute right-2 flex items-center justify-center size-5 rounded-full bg-transparent border-none text-texto-terciario cursor-pointer hover:text-texto-secundario">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

export { Buscador, type PropiedadesBuscador }
