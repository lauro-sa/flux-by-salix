'use client'

import { forwardRef, type ReactNode, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Tooltip } from './Tooltip'

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito' | 'advertencia'
type TamanoBoton = 'xs' | 'sm' | 'md' | 'lg'

interface PropiedadesBoton {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  icono?: ReactNode
  iconoDerecho?: ReactNode
  soloIcono?: boolean
  cargando?: boolean
  anchoCompleto?: boolean
  disabled?: boolean
  children?: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
  /** Estilos inline — usar solo cuando se necesitan CSS custom properties dinámicas */
  style?: React.CSSProperties
  titulo?: string
  redondeado?: boolean
  'aria-label'?: string
  /** Texto de tooltip al hover (usa el componente Tooltip). Si soloIcono y titulo están, usa titulo como tooltip automáticamente */
  tooltip?: string
}

const clasesVariante: Record<VarianteBoton, string> = {
  primario: 'bg-texto-marca text-white hover:brightness-110',
  secundario: 'bg-superficie-tarjeta text-texto-primario border border-borde-sutil hover:border-borde-fuerte hover:bg-superficie-hover',
  fantasma: 'bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario',
  peligro: 'bg-insignia-peligro text-white hover:brightness-110',
  exito: 'bg-insignia-exito text-white hover:brightness-110',
  advertencia: 'bg-insignia-advertencia text-white hover:brightness-110',
}

const clasesTamano: Record<TamanoBoton, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1.5',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

const clasesSoloIcono: Record<TamanoBoton, string> = {
  xs: 'p-1.5 size-7',
  sm: 'p-1.5 size-8',
  md: 'p-2 size-9',
  lg: 'p-2.5 size-10',
}

/**
 * Boton — Componente base de botón reutilizable.
 * Se usa en toda la app: formularios, modales, acciones, toolbar, etc.
 * Si soloIcono + titulo están, envuelve automáticamente con Tooltip.
 */
const Boton = forwardRef<HTMLButtonElement, PropiedadesBoton>(
  (
    {
      variante = 'primario',
      tamano = 'md',
      icono,
      iconoDerecho,
      soloIcono = false,
      cargando = false,
      anchoCompleto = false,
      disabled,
      children,
      onClick,
      type = 'button',
      className = '',
      style,
      titulo,
      redondeado = false,
      'aria-label': ariaLabel,
      tooltip,
    },
    ref
  ) => {
    const clases = [
      'inline-flex items-center justify-center font-medium leading-none whitespace-nowrap select-none transition-all duration-150 cursor-pointer',
      redondeado ? 'rounded-full' : 'rounded-lg',
      clasesVariante[variante],
      soloIcono ? clasesSoloIcono[tamano] : clasesTamano[tamano],
      anchoCompleto ? 'w-full' : '',
      disabled || cargando ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
      className,
    ].join(' ')

    // Texto de tooltip: explícito > titulo (solo en soloIcono)
    const textoTooltip = tooltip || (soloIcono && titulo ? titulo : '')

    const boton = (
      <motion.button
        ref={ref}
        type={type}
        title={!textoTooltip ? titulo : undefined}
        aria-label={ariaLabel || titulo}
        whileHover={!disabled && !cargando ? { scale: 1.02 } : undefined}
        whileTap={!disabled && !cargando ? { scale: 0.97 } : undefined}
        disabled={disabled || cargando}
        onClick={onClick}
        className={clases}
        style={style}
      >
        {cargando ? (
          <Loader2 size={16} className="animate-spin" />
        ) : icono}
        {!soloIcono && children}
        {!soloIcono && iconoDerecho}
      </motion.button>
    )

    if (textoTooltip) {
      return <Tooltip contenido={textoTooltip}>{boton}</Tooltip>
    }

    return boton
  }
)

Boton.displayName = 'Boton'
export { Boton, type PropiedadesBoton, type VarianteBoton, type TamanoBoton }
