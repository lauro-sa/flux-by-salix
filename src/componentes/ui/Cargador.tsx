'use client'

import { useState, useEffect } from 'react'
import { motion, type Variants } from 'framer-motion'
import { PIEZAS_ICONO } from '@/componentes/marca'

/** Duración del ciclo en segundos — logo y barra usan el mismo */
const CICLO = 1.8

/** Variantes de entrada sincronizadas con la barra */
const variantesCargador: Variants = {
  oculto: { opacity: 0, scale: 0.3 },
  visible: (anillo: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
      delay: anillo * (CICLO / 8),
    },
  }),
}

/** Logo con ripple sincronizado al ciclo de la barra */
function CargadorLogoLoop({ tamano }: { tamano: number }) {
  const [key, setKey] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => setKey(k => k + 1), CICLO * 1000)
    return () => clearInterval(intervalo)
  }, [])

  return (
    <motion.svg
      key={key}
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Salix"
      initial="oculto"
      animate="visible"
    >
      {PIEZAS_ICONO.map(pieza => (
        <motion.path
          key={pieza.id}
          d={pieza.d}
          fill="currentColor"
          variants={variantesCargador}
          custom={pieza.anillo}
        />
      ))}
    </motion.svg>
  )
}

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
        <div className="flex flex-col items-center">
          {/* Logo: ripple en loop */}
          <CargadorLogoLoop tamano={48} />

          {/* Nombre del producto */}
          <motion.span
            className="mt-6 text-lg font-semibold tracking-[0.25em] uppercase"
            style={{ color: 'var(--texto-secundario)', fontFamily: 'var(--fuente-sans)' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Flux
          </motion.span>

          {/* Tagline */}
          <motion.span
            className="mt-3 text-xxs tracking-[0.12em] uppercase"
            style={{ color: 'var(--texto-terciario)', fontFamily: 'var(--fuente-sans)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            The operating system for your business
          </motion.span>

          {/* Barra de progreso — sincronizada con el ciclo del logo */}
          <motion.div
            className="mt-2.5 w-full rounded-full overflow-hidden"
            style={{ height: 2, backgroundColor: 'var(--borde-sutil)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: 'var(--texto-marca)', width: '30%' }}
              animate={{ x: ['-30%', '340%'] }}
              transition={{ duration: CICLO, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>

          {/* Texto opcional */}
          {texto && (
            <motion.span
              className="mt-4 text-xxs text-texto-terciario"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.7 }}
            >
              {texto}
            </motion.span>
          )}
        </div>
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
