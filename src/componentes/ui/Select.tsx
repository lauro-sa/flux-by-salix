'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { useTema } from '@/hooks/useTema'

interface OpcionSelect {
  valor: string
  etiqueta: string
  icono?: ReactNode
  descripcion?: string
  deshabilitada?: boolean
}

interface PropiedadesSelect {
  opciones: OpcionSelect[]
  valor?: string
  placeholder?: string
  etiqueta?: string
  error?: string
  onChange: (valor: string) => void
  className?: string
  /** Variante visual: 'default' con borde completo, 'plano' solo línea inferior */
  variante?: 'default' | 'plano'
}

/**
 * Select — Dropdown personalizado con portal.
 * Se usa en: formularios, filtros, selectores de tipo/estado.
 */
function Select({ opciones, valor, placeholder = 'Seleccionar...', etiqueta, error, onChange, className = '', variante = 'default' }: PropiedadesSelect) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const seleccionada = opciones.find((o) => o.valor === valor)

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  return (
    <div ref={ref} className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className={`text-sm font-medium mb-1 ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
          {etiqueta}
        </label>
      )}
      <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={[
          'flex items-center justify-between gap-2 text-sm cursor-pointer transition-all duration-150 w-full text-left outline-none',
          variante === 'plano'
            ? `bg-transparent border-0 border-b px-0 py-1 rounded-none ${error ? 'border-insignia-peligro' : abierto ? 'border-borde-foco' : 'border-borde-sutil'}`
            : `px-3 py-2 rounded-md border bg-superficie-tarjeta ${error ? 'border-insignia-peligro' : abierto ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte'}`,
        ].join(' ')}
      >
        <span className={seleccionada ? 'text-texto-primario' : 'text-texto-terciario'}>
          {seleccionada ? (
            <span className="flex items-center gap-2">
              {seleccionada.icono}
              {seleccionada.etiqueta}
            </span>
          ) : placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-texto-terciario transition-transform duration-150 ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 border border-borde-sutil rounded-md shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto"
            style={esCristal ? {
              backgroundColor: 'var(--superficie-flotante)',
              backdropFilter: 'blur(32px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            } : {
              backgroundColor: 'var(--superficie-elevada)',
            }}
          >
            {opciones.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                disabled={opcion.deshabilitada}
                onClick={() => { onChange(opcion.valor); setAbierto(false) }}
                className={[
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors duration-100',
                  opcion.valor === valor ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                  opcion.deshabilitada ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {opcion.icono}
                <div className="flex-1 min-w-0">
                  <div>{opcion.etiqueta}</div>
                  {opcion.descripcion && <div className="text-xs text-texto-terciario mt-0.5">{opcion.descripcion}</div>}
                </div>
                {opcion.valor === valor && (
                  <Check size={14} className="text-texto-marca shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      </div>
      {error && <span className="text-xs text-insignia-peligro mt-1">{error}</span>}
    </div>
  )
}

export { Select, type PropiedadesSelect, type OpcionSelect }
