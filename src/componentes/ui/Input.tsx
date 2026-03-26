'use client'

import { forwardRef, useState, useCallback, type InputHTMLAttributes, type ReactNode, type ChangeEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { aplicarFormato, detectarFormato, type TipoFormato } from '@/lib/formato'

type TipoInput = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'

interface PropiedadesInput extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  tipo?: TipoInput
  etiqueta?: string
  error?: string
  ayuda?: string
  icono?: ReactNode
  iconoDerecho?: ReactNode
  compacto?: boolean
  /** Formato de auto-corrección. Si no se especifica, se detecta del tipo de input.
   * Opciones: 'email' | 'url' | 'telefono' | 'nombre_persona' | 'nombre_empresa' | 'slug' | 'minusculas'
   * Para desactivar: formato={null} */
  formato?: TipoFormato | null
  /** Variante visual: 'default' con borde completo, 'plano' solo línea inferior */
  variante?: 'default' | 'plano'
}

/**
 * Input — Campo de entrada unificado con auto-formateo inteligente.
 * - email/url → minúsculas automáticas
 * - tel → formato de teléfono según país
 * - nombre_persona → capitalización (María García)
 * - nombre_empresa → capitalización + detección de siglas (SRL, SA)
 * - slug → minúsculas, sin espacios, solo a-z 0-9 y guiones
 * Para tipo="password" muestra toggle ojo para ver/ocultar.
 */
const Input = forwardRef<HTMLInputElement, PropiedadesInput>(
  ({ tipo = 'text', etiqueta, error, ayuda, icono, iconoDerecho, compacto, formato, variante = 'default', className = '', onChange, onBlur, ...rest }, ref) => {
    const [enfocado, setEnfocado] = useState(false)
    const [mostrarContrasena, setMostrarContrasena] = useState(false)

    // Determinar formato: explícito > auto-detectado > null
    const formatoFinal = formato !== undefined ? formato : detectarFormato(tipo)

    // Auto-formatear en onChange (para email/url/slug que son inmediatos)
    const manejarCambio = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      if (formatoFinal && ['email', 'url', 'slug', 'minusculas'].includes(formatoFinal)) {
        e.target.value = aplicarFormato(e.target.value, formatoFinal)
      }
      onChange?.(e)
    }, [formatoFinal, onChange])

    // Auto-formatear en onBlur (para nombres, teléfonos — se corrigen al salir del campo)
    const manejarBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setEnfocado(false)
      if (formatoFinal && ['nombre_persona', 'nombre_empresa', 'telefono'].includes(formatoFinal)) {
        const formateado = aplicarFormato(e.target.value, formatoFinal)
        if (formateado !== e.target.value) {
          // Crear un evento sintético para notificar el cambio
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          nativeInputValueSetter?.call(e.target, formateado)
          e.target.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
      onBlur?.(e)
    }, [formatoFinal, onBlur])

    // Si es password, alternar entre text/password con el toggle
    const tipoReal = tipo === 'password' && mostrarContrasena ? 'text' : tipo

    // inputMode para teclados móviles optimizados
    const inputMode = tipo === 'tel' ? 'tel' as const
      : tipo === 'email' ? 'email' as const
      : tipo === 'url' ? 'url' as const
      : tipo === 'number' ? 'decimal' as const
      : tipo === 'search' ? 'search' as const
      : undefined

    // Ícono derecho: si es password, mostrar el toggle de ojo
    const iconoDerechoFinal = tipo === 'password' ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setMostrarContrasena(!mostrarContrasena)}
        className="text-texto-terciario hover:text-texto-secundario transition-colors bg-transparent border-none cursor-pointer p-0 flex items-center"
      >
        {mostrarContrasena ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    ) : iconoDerecho

    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {etiqueta && (
          <label className={`text-sm font-medium ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
            {etiqueta}
          </label>
        )}
        <div
          className={[
            'flex items-center gap-2 transition-all duration-150 outline-none',
            variante === 'plano'
              ? [
                  'bg-transparent border-0 border-b rounded-none',
                  compacto ? 'px-0 py-0.5' : 'px-0 py-1',
                  error ? 'border-insignia-peligro' : enfocado ? 'border-borde-foco' : 'border-borde-sutil',
                ].join(' ')
              : [
                  'rounded-md border bg-superficie-tarjeta',
                  compacto ? 'px-2 py-1' : 'px-3 py-2',
                  error ? 'border-insignia-peligro' : enfocado ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte',
                ].join(' '),
          ].join(' ')}
        >
          {icono && <span className="text-texto-terciario shrink-0 flex items-center">{icono}</span>}
          <input
            ref={ref}
            type={tipoReal}
            inputMode={inputMode}
            autoCapitalize={tipo === 'email' || tipo === 'url' ? 'off' : undefined}
            autoCorrect={tipo === 'email' || tipo === 'url' || tipo === 'password' ? 'off' : undefined}
            onFocus={(e) => { setEnfocado(true); rest.onFocus?.(e) }}
            onBlur={manejarBlur}
            onChange={manejarCambio}
            className="flex-1 border-none outline-none bg-transparent text-texto-primario text-sm font-[inherit] leading-normal w-full placeholder:text-texto-terciario"
            {...rest}
          />
          {iconoDerechoFinal && <span className="text-texto-terciario shrink-0 flex items-center">{iconoDerechoFinal}</span>}
        </div>
        {(error || ayuda) && (
          <span className={`text-xs ${error ? 'text-insignia-peligro' : 'text-texto-terciario'}`}>
            {error || ayuda}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input, type PropiedadesInput }
