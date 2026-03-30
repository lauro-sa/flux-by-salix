'use client'

/**
 * LogoSalix — Componente principal de marca.
 *
 * Layouts: icono | horizontal | completo
 * Animaciones: estatico | entrada | pulso | ensamble
 * Interacciones: hover (piezas se separan) + tap (bounce)
 *
 * Por defecto tiene hover y tap habilitados para que siempre se sienta vivo.
 */

import { motion } from 'framer-motion'
import IconoSalix, { type VarianteIcono } from './IconoSalix'

type LayoutLogo = 'icono' | 'horizontal' | 'completo'

interface LogoSalixProps {
  layout?: LayoutLogo
  animacion?: VarianteIcono
  tamano?: number
  producto?: string
  color?: string
  className?: string
  escalaTexto?: number
  /** Habilitar hover interactivo — por defecto true */
  hover?: boolean
  /** Habilitar efecto tap — por defecto true */
  tap?: boolean
}

export default function LogoSalix({
  layout = 'icono',
  animacion = 'estatico',
  tamano = 28,
  producto = 'flux',
  color,
  className = '',
  escalaTexto = 1,
  hover = true,
  tap = true,
}: LogoSalixProps) {
  /* Solo ícono */
  if (layout === 'icono') {
    return (
      <IconoSalix
        tamano={tamano}
        variante={animacion}
        color={color}
        className={className}
        hover={hover}
        tap={tap}
      />
    )
  }

  const esAnimado = animacion !== 'estatico'
  const tamanoTexto = tamano * 0.75 * escalaTexto
  const tamanoSub = tamano * 0.38 * escalaTexto

  return (
    <motion.div
      className={`inline-flex items-center select-none ${className}`}
      style={{ gap: tamano * 0.35 }}
      whileHover={hover ? { scale: 1.03 } : undefined}
      whileTap={tap ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <IconoSalix
        tamano={tamano}
        variante={animacion}
        color={color}
        hover={hover}
        tap={false}
      />

      <div className="flex flex-col justify-center" style={{ gap: layout === 'completo' ? 1 : 0 }}>
        {/* Nombre del producto */}
        <motion.span
          className="font-semibold tracking-tight leading-none"
          style={{
            fontSize: tamanoTexto,
            color: color || 'var(--texto-primario)',
            fontFamily: 'var(--fuente-sans)',
          }}
          initial={esAnimado ? { opacity: 0, x: -8 } : false}
          animate={esAnimado ? { opacity: 1, x: 0 } : undefined}
          transition={esAnimado ? { type: 'spring', stiffness: 200, damping: 20, delay: 0.35 } : undefined}
        >
          {producto}
        </motion.span>

        {/* "by Salix" — solo en layout completo */}
        {layout === 'completo' && (
          <motion.span
            className="tracking-wide leading-none"
            style={{
              fontSize: tamanoSub,
              color: 'var(--texto-terciario)',
              fontFamily: 'var(--fuente-sans)',
              fontWeight: 400,
            }}
            initial={esAnimado ? { opacity: 0, y: 4 } : false}
            animate={esAnimado ? { opacity: 1, y: 0 } : undefined}
            transition={esAnimado ? { type: 'spring', stiffness: 200, damping: 20, delay: 0.5 } : undefined}
          >
            by Salix
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
