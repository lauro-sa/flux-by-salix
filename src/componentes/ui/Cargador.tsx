'use client'

import { motion } from 'framer-motion'

type TamanoCargador = 'sm' | 'md' | 'lg' | 'pagina'

interface PropiedadesCargador {
  /** Tamaño del indicador:
   * - sm: inline, para botones o celdas (16px)
   * - md: para secciones o paneles (32px)
   * - lg: para áreas grandes (48px)
   * - pagina: pantalla completa centrada con texto (64px)
   */
  tamano?: TamanoCargador
  /** Texto opcional debajo del indicador */
  texto?: string
  /** Clase CSS adicional para el contenedor */
  className?: string
}

const TAMANOS: Record<TamanoCargador, number> = {
  sm: 16,
  md: 32,
  lg: 48,
  pagina: 56,
}

/**
 * Cargador — Indicador de carga visual para Flux.
 * Tres barras animadas que pulsan en secuencia con el color marca.
 * Se usa en: loading states de páginas, secciones, tablas, modales, etc.
 */
function Cargador({ tamano = 'md', texto, className = '' }: PropiedadesCargador) {
  const size = TAMANOS[tamano]
  const barWidth = Math.max(3, size * 0.12)
  const barGap = Math.max(2, size * 0.08)
  const esPagina = tamano === 'pagina'

  const contenido = (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Barras animadas */}
      <div className="flex items-end justify-center" style={{ height: size, gap: barGap }}>
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            style={{
              width: barWidth,
              borderRadius: barWidth,
              backgroundColor: 'var(--texto-marca)',
            }}
            animate={{
              height: [size * 0.25, size * 0.85, size * 0.25],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.1,
            }}
          />
        ))}
      </div>

      {/* Texto */}
      {texto && (
        <motion.span
          className="text-xs text-texto-terciario"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {texto}
        </motion.span>
      )}
    </div>
  )

  if (esPagina) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] w-full">
        {contenido}
      </div>
    )
  }

  return contenido
}

/**
 * CargadorSeccion — Wrapper para secciones que cargan.
 * Muestra el cargador centrado con padding vertical.
 */
function CargadorSeccion({ texto }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Cargador tamano="md" texto={texto} />
    </div>
  )
}

/**
 * CargadorInline — Cargador pequeño inline (para celdas, labels, etc.)
 */
function CargadorInline() {
  return <Cargador tamano="sm" />
}

export { Cargador, CargadorSeccion, CargadorInline }
export type { TamanoCargador, PropiedadesCargador }
