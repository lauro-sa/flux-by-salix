'use client'

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  const botonRef = useRef<HTMLButtonElement>(null)
  const errorId = etiqueta ? `select-${etiqueta.toLowerCase().replace(/\s+/g, '-')}-error` : undefined
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 })

  const seleccionada = opciones.find((o) => o.valor === valor)

  // Calcular posición del dropdown relativa al viewport
  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return
    const rect = botonRef.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [abierto])

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Cerrar al hacer scroll del contenedor padre (modal)
  useEffect(() => {
    if (!abierto) return
    const handler = () => {
      if (botonRef.current) {
        const rect = botonRef.current.getBoundingClientRect()
        setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
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
        ref={botonRef}
        type="button"
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        aria-expanded={abierto}
        aria-haspopup="listbox"
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

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed border border-borde-sutil rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto"
              style={{
                top: posicion.top,
                left: posicion.left,
                width: posicion.width,
                zIndex: 9999,
                ...(esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }),
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
        </AnimatePresence>,
        document.body
      )}

      </div>
      {error && <span id={errorId} role="alert" className="text-xs text-insignia-peligro mt-1">{error}</span>}
    </div>
  )
}

export { Select, type PropiedadesSelect, type OpcionSelect }
