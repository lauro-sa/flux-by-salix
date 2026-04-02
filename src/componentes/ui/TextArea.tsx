'use client'

import { forwardRef, useState, type TextareaHTMLAttributes, type ReactNode } from 'react'

interface PropiedadesTextArea extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  /** Texto de etiqueta sobre el campo */
  etiqueta?: string
  /** Mensaje de error (resalta borde y muestra texto) */
  error?: string
  /** Texto de ayuda debajo del campo */
  ayuda?: string
  /** Ícono izquierdo */
  icono?: ReactNode
  /** Padding reducido y texto más chico */
  compacto?: boolean
  /** Fuente monoespaciada (para código, prompts, plantillas) */
  monoespacio?: boolean
  /** Variante visual */
  variante?: 'default' | 'plano' | 'transparente'
  /** Si true, Enter envía (Shift+Enter hace salto de línea) */
  enviarConEnter?: boolean
  /** Callback cuando se presiona Enter (requiere enviarConEnter) */
  onEnviar?: () => void
}

/**
 * TextArea — Campo de texto multilínea unificado.
 * Cubre todos los casos: notas, descripciones, código, chat, prompts.
 * Variantes:
 * - 'default': borde completo con fondo tarjeta
 * - 'plano': solo línea inferior
 * - 'transparente': sin borde ni fondo (para inline editing)
 */
const TextArea = forwardRef<HTMLTextAreaElement, PropiedadesTextArea>(
  ({
    etiqueta,
    error,
    ayuda,
    icono,
    compacto,
    monoespacio,
    variante = 'default',
    enviarConEnter,
    onEnviar,
    onKeyDown,
    onFocus,
    onBlur,
    className = '',
    ...rest
  }, ref) => {
    const [enfocado, setEnfocado] = useState(false)

    const manejarKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (enviarConEnter && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onEnviar?.()
      }
      onKeyDown?.(e)
    }

    const estiloContenedor = variante === 'transparente'
      ? 'bg-transparent border-0 outline-none'
      : variante === 'plano'
        ? [
            'bg-transparent border-0 border-b rounded-none',
            compacto ? 'px-0 py-0.5' : 'px-0 py-1',
            error ? 'border-insignia-peligro' : enfocado ? 'border-borde-foco' : 'border-borde-sutil',
          ].join(' ')
        : [
            'rounded-md border bg-superficie-tarjeta',
            compacto ? 'px-2 py-1' : 'px-3 py-2',
            error ? 'border-insignia-peligro' : enfocado ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte',
          ].join(' ')

    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {etiqueta && (
          <label className={`text-sm font-medium ${error ? 'text-insignia-peligro' : 'text-texto-secundario'}`}>
            {etiqueta}
          </label>
        )}
        <div className={`flex gap-2 transition-all duration-150 ${estiloContenedor}`}>
          {icono && <span className="text-texto-terciario shrink-0 flex items-center pt-0.5">{icono}</span>}
          <textarea
            ref={ref}
            onFocus={(e) => { setEnfocado(true); onFocus?.(e) }}
            onBlur={(e) => { setEnfocado(false); onBlur?.(e) }}
            onKeyDown={manejarKeyDown}
            className={[
              'flex-1 border-none outline-none bg-transparent text-texto-primario leading-normal w-full placeholder:text-texto-placeholder resize-none',
              compacto ? 'text-xs' : 'text-sm',
              monoespacio ? 'font-mono' : 'font-[inherit]',
            ].join(' ')}
            {...rest}
          />
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

TextArea.displayName = 'TextArea'
export { TextArea, type PropiedadesTextArea }
