'use client'

import { forwardRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

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
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

const clasesVariante: Record<VarianteBoton, string> = {
  primario: 'bg-texto-marca text-white',
  secundario: 'bg-superficie-tarjeta text-texto-primario border border-borde-fuerte',
  fantasma: 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
  peligro: 'bg-insignia-peligro text-white',
  exito: 'bg-insignia-exito text-white',
  advertencia: 'bg-insignia-advertencia text-white',
}

const clasesTamano: Record<TamanoBoton, string> = {
  xs: 'px-2 py-0.5 text-xs gap-1',
  sm: 'px-3 py-1 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
}

const clasesSoloIcono: Record<TamanoBoton, string> = {
  xs: 'p-1.5 size-8',
  sm: 'p-1.5 size-9',
  md: 'p-2 size-10',
  lg: 'p-3 size-11',
}

/**
 * Boton — Componente base de botón reutilizable.
 * Se usa en toda la app: formularios, modales, acciones, toolbar, etc.
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
    },
    ref
  ) => {
    const clases = [
      'inline-flex items-center justify-center rounded-md font-medium leading-none whitespace-nowrap select-none transition-all duration-150 cursor-pointer',
      clasesVariante[variante],
      soloIcono ? clasesSoloIcono[tamano] : clasesTamano[tamano],
      anchoCompleto ? 'w-full' : '',
      disabled || cargando ? 'opacity-50 cursor-not-allowed' : '',
      className,
    ].join(' ')

    return (
      <motion.button
        ref={ref}
        type={type}
        whileHover={!disabled && !cargando ? { scale: 1.02 } : undefined}
        whileTap={!disabled && !cargando ? { scale: 0.98 } : undefined}
        disabled={disabled || cargando}
        onClick={onClick}
        className={clases}
      >
        {cargando ? (
          <Loader2 size={16} className="animate-spin" />
        ) : icono}
        {!soloIcono && children}
        {!soloIcono && iconoDerecho}
      </motion.button>
    )
  }
)

Boton.displayName = 'Boton'
export { Boton, type PropiedadesBoton, type VarianteBoton, type TamanoBoton }
