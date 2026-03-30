'use client'

/**
 * SplashSalix — Pantalla de carga animada con el logo.
 * Ideal para login, portal del cliente, o loading entre secciones.
 *
 * Uso:
 *   <SplashSalix />                          → splash a pantalla completa
 *   <SplashSalix producto="flux" inline />   → splash inline (sin fondo completo)
 */

import { motion } from 'framer-motion'
import LogoSalix from './LogoSalix'

interface SplashSalixProps {
  /** Nombre del producto */
  producto?: string
  /** Si true, no ocupa toda la pantalla — se adapta al contenedor */
  inline?: boolean
  /** Mostrar "by Salix" debajo del nombre */
  mostrarByline?: boolean
  /** Clase CSS adicional */
  className?: string
  /** Tamaño del ícono */
  tamano?: number
}

export default function SplashSalix({
  producto = 'flux',
  inline = false,
  mostrarByline = true,
  className = '',
  tamano = 48,
}: SplashSalixProps) {
  const contenedorVariantes = {
    oculto: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3 },
    },
  }

  const claseBase = inline
    ? 'flex items-center justify-center py-16'
    : 'fixed inset-0 z-[9999] flex items-center justify-center'

  return (
    <motion.div
      className={`${claseBase} ${className}`}
      style={!inline ? { backgroundColor: 'var(--superficie-app)' } : undefined}
      variants={contenedorVariantes}
      initial="oculto"
      animate="visible"
    >
      <div className="flex flex-col items-center gap-6">
        <LogoSalix
          layout={mostrarByline ? 'completo' : 'horizontal'}
          animacion="ensamble"
          tamano={tamano}
          producto={producto}
          escalaTexto={1.2}
        />

        {/* Barra de carga sutil */}
        <motion.div
          className="rounded-full overflow-hidden"
          style={{
            width: tamano * 2.5,
            height: 2,
            backgroundColor: 'var(--borde-sutil)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--texto-marca)' }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 1.8,
              delay: 0.7,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
