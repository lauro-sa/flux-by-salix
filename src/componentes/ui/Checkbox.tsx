'use client'

import { forwardRef, useRef, useEffect, type InputHTMLAttributes } from 'react'

interface PropiedadesCheckbox extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /** Estado marcado */
  marcado?: boolean
  /** Callback al cambiar */
  onChange?: (marcado: boolean) => void
  /** Texto de etiqueta al lado */
  etiqueta?: string
  /** Estado indeterminado (para "seleccionar todos" parcial) */
  indeterminado?: boolean
  /** Deshabilitado */
  deshabilitado?: boolean
}

/**
 * Checkbox — Casilla de verificación unificada.
 * Soporta estado indeterminado, etiqueta, y estilizado consistente.
 * Se usa en: tablas (selección de filas), configuración (toggles on/off), formularios.
 */
const Checkbox = forwardRef<HTMLInputElement, PropiedadesCheckbox>(
  ({ marcado, onChange, etiqueta, indeterminado, deshabilitado, className = '', ...rest }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null)
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef

    useEffect(() => {
      if (inputRef && 'current' in inputRef && inputRef.current) {
        inputRef.current.indeterminate = !!indeterminado
      }
    }, [indeterminado, inputRef])

    return (
      <label
        className={[
          'inline-flex items-center gap-2 select-none',
          deshabilitado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className,
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={marcado}
          disabled={deshabilitado}
          onChange={(e) => onChange?.(e.target.checked)}
          className={[
            'size-4 rounded border border-borde-fuerte bg-superficie-tarjeta cursor-pointer transition-colors',
            'accent-texto-marca',
            deshabilitado ? 'cursor-not-allowed' : '',
          ].join(' ')}
          {...rest}
        />
        {etiqueta && <span className="text-sm text-texto-primario">{etiqueta}</span>}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'
export { Checkbox, type PropiedadesCheckbox }
