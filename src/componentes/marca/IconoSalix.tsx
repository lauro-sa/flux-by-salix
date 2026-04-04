'use client'

/**
 * IconoSalix — Ícono SVG de Salix descompuesto en 13 piezas.
 * Soporta animaciones de entrada, hover, tap y continuas.
 * Organizado en 4 anillos concéntricos para efecto ripple.
 */

import { useState, useRef, useCallback } from 'react'
import { motion, type Variants, type Transition } from 'framer-motion'

/** Cada pieza del ícono con su path y posición en el anillo */
export const PIEZAS_ICONO = [
  { id: 'centro', anillo: 0, d: 'M11.996 7.711C9.628 7.711 7.709 9.632 7.709 12c0 2.369 1.919 4.287 4.287 4.287 2.368 0 4.289-1.918 4.289-4.287 0-2.368-1.921-4.289-4.289-4.289z' },
  { id: 'arriba-centro', anillo: 1, d: 'M12 2.768c-2.369 0-4.291 1.919-4.291 4.287h8.578c0-2.368-1.919-4.287-4.287-4.287z' },
  { id: 'abajo-centro', anillo: 1, d: 'M7.709 16.951c0 2.369 1.922 4.289 4.291 4.289 2.368 0 4.287-1.92 4.287-4.289H7.709z' },
  { id: 'izquierda', anillo: 1, d: 'M7.047 7.709c-2.37 0-4.289 1.922-4.289 4.291 0 2.368 1.919 4.287 4.289 4.287V7.709z' },
  { id: 'derecha', anillo: 1, d: 'M16.951 7.709v8.578c2.368 0 4.291-1.919 4.291-4.287 0-2.369-1.923-4.291-4.291-4.291z' },
  { id: 'esquina-sup-izq', anillo: 2, d: 'M7.047 2.977c-2.251 0-4.076 1.824-4.076 4.074h4.076V2.977z' },
  { id: 'esquina-sup-der', anillo: 2, d: 'M16.951 2.979v4.072l4.072.002c0-2.25-1.823-4.074-4.072-4.074z' },
  { id: 'esquina-inf-izq', anillo: 2, d: 'M7.047 16.949l-4.074.002c0 2.249 1.822 4.07 4.074 4.07v-4.072z' },
  { id: 'esquina-inf-der', anillo: 2, d: 'M16.951 16.949v4.07c2.249 0 4.072-1.819 4.072-4.068l-4.072-.002z' },
  { id: 'tapa-arriba', anillo: 3, d: 'M12 0c-1.567 0-2.938.84-3.686 2.094l7.369.002C14.936.84 13.568 0 12 0z' },
  { id: 'tapa-abajo', anillo: 3, d: 'M8.258 21.904C9.006 23.159 10.376 24 11.943 24c1.567 0 2.937-.841 3.686-2.096H8.258z' },
  { id: 'tapa-izquierda', anillo: 3, d: 'M2.096 8.315C.84 9.062 0 10.433 0 12c0 1.567.84 2.936 2.094 3.686l.002-7.371z' },
  { id: 'tapa-derecha', anillo: 3, d: 'M21.904 8.315l.002 7.371C23.16 14.936 24 13.567 24 12c0-1.567-.84-2.938-2.096-3.686z' },
] as const

export type VarianteIcono = 'estatico' | 'entrada' | 'pulso' | 'ensamble'

interface IconoSalixProps {
  /** Tamaño en px */
  tamano?: number
  className?: string
  /** Color — hereda currentColor por defecto */
  color?: string
  /** Animación de entrada */
  variante?: VarianteIcono
  /** Habilitar hover interactivo (ripple por anillos) */
  hover?: boolean
  /** Habilitar efecto tap/click (scale bounce) */
  tap?: boolean
}

/* ── Transiciones ── */

const springSuave: Transition = { type: 'spring', stiffness: 260, damping: 20 }

/* ── Variantes de entrada ── */

const variantesEntrada: Variants = {
  oculto: { opacity: 0, scale: 0.3 },
  visible: (anillo: number) => ({
    opacity: 1,
    scale: 1,
    transition: { ...springSuave, delay: anillo * 0.08 },
  }),
}

const variantesPulso: Variants = {
  inicial: { scale: 1 },
  pulso: (anillo: number) => ({
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.6,
      delay: anillo * 0.1,
      repeat: Infinity,
      repeatDelay: 2,
      ease: 'easeInOut',
    },
  }),
}

const desplazamientos: Record<string, { x: number; y: number }> = {
  'centro': { x: 0, y: 0 },
  'arriba-centro': { x: 0, y: -30 },
  'abajo-centro': { x: 0, y: 30 },
  'izquierda': { x: -30, y: 0 },
  'derecha': { x: 30, y: 0 },
  'esquina-sup-izq': { x: -25, y: -25 },
  'esquina-sup-der': { x: 25, y: -25 },
  'esquina-inf-izq': { x: -25, y: 25 },
  'esquina-inf-der': { x: 25, y: 25 },
  'tapa-arriba': { x: 0, y: -40 },
  'tapa-abajo': { x: 0, y: 40 },
  'tapa-izquierda': { x: -40, y: 0 },
  'tapa-derecha': { x: 40, y: 0 },
}

const variantesEnsamble: Variants = {
  oculto: (id: string) => {
    const o = desplazamientos[id] || { x: 0, y: 0 }
    return { opacity: 0, x: o.x, y: o.y, scale: 0.5 }
  },
  visible: (id: string) => {
    const anillo = PIEZAS_ICONO.find(p => p.id === id)?.anillo ?? 0
    return {
      opacity: 1, x: 0, y: 0, scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 18, delay: 0.05 + anillo * 0.1 },
    }
  },
}

/* ── Hover: las piezas se separan hacia afuera por anillo ── */

/** Dirección de separación normalizada para cada pieza */
const direccionSeparacion: Record<string, { x: number; y: number }> = {
  'centro': { x: 0, y: 0 },
  'arriba-centro': { x: 0, y: -1 },
  'abajo-centro': { x: 0, y: 1 },
  'izquierda': { x: -1, y: 0 },
  'derecha': { x: 1, y: 0 },
  'esquina-sup-izq': { x: -0.7, y: -0.7 },
  'esquina-sup-der': { x: 0.7, y: -0.7 },
  'esquina-inf-izq': { x: -0.7, y: 0.7 },
  'esquina-inf-der': { x: 0.7, y: 0.7 },
  'tapa-arriba': { x: 0, y: -1 },
  'tapa-abajo': { x: 0, y: 1 },
  'tapa-izquierda': { x: -1, y: 0 },
  'tapa-derecha': { x: 1, y: 0 },
}

export default function IconoSalix({
  tamano = 24,
  className = '',
  color,
  variante = 'estatico',
  hover = false,
  tap = false,
}: IconoSalixProps) {
  const [hovered, setHovered] = useState(false)
  const [tocado, setTocado] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esAnimado = variante !== 'estatico'
  const esInteractivo = hover || tap
  const separado = hovered || tocado

  // Toggle tap: separar piezas y volver después de 600ms
  const manejarTap = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTocado(true)
    timerRef.current = setTimeout(() => setTocado(false), 600)
  }, [])

  /* ── Ícono estático sin interacciones — path único, máxima performance ── */
  if (!esAnimado && !esInteractivo) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={tamano}
        height={tamano}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Salix"
      >
        <path
          d={PIEZAS_ICONO.map(p => p.d).join(' ')}
          fill={color || 'currentColor'}
        />
      </svg>
    )
  }

  /* ── Con animaciones o interacciones — cada pieza por separado ── */

  const obtenerVariantes = () => {
    switch (variante) {
      case 'entrada': return variantesEntrada
      case 'pulso': return variantesPulso
      case 'ensamble': return variantesEnsamble
      default: return undefined
    }
  }

  const obtenerCustom = (pieza: typeof PIEZAS_ICONO[number]) => {
    if (variante === 'ensamble') return pieza.id
    return pieza.anillo
  }

  const variants = obtenerVariantes()
  const estadoInicial = variante === 'pulso' ? 'inicial' : variante !== 'estatico' ? 'oculto' : false
  const estadoAnimar = variante === 'pulso' ? 'pulso' : variante !== 'estatico' ? 'visible' : undefined

  /* Distancia de separación en hover (relativa al viewBox de 24px) */
  const distanciaHover = 1.5

  /* Evitar motion.svg y motion.span como wrapper — ambos causan hydration mismatch
     porque Framer Motion serializa atributos distinto en SSR vs client.
     Se usa <span> + <svg> nativos, con motion.g/motion.path solo internamente. */
  return (
    <span
      style={{ display: 'inline-flex' }}
      onMouseEnter={hover ? () => setHovered(true) : undefined}
      onMouseLeave={hover ? () => setHovered(false) : undefined}
      onTouchStart={tap ? manejarTap : undefined}
      onClick={tap ? manejarTap : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        width={tamano}
        height={tamano}
        className={`${className} ${esInteractivo ? 'cursor-pointer' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Salix"
        style={{ overflow: 'visible' }}
      >
        <motion.g initial={estadoInicial} animate={estadoAnimar}>
          {PIEZAS_ICONO.map(pieza => {
            const dir = direccionSeparacion[pieza.id] || { x: 0, y: 0 }
            const desplX = separado ? dir.x * distanciaHover * (pieza.anillo + 1) : 0
            const desplY = separado ? dir.y * distanciaHover * (pieza.anillo + 1) : 0

            return (
              <motion.path
                key={pieza.id}
                d={pieza.d}
                fill={color || 'currentColor'}
                variants={variants}
                custom={obtenerCustom(pieza)}
                animate={{ translateX: desplX, translateY: desplY }}
                transition={{
                  translateX: { type: 'spring', stiffness: 300, damping: 20 },
                  translateY: { type: 'spring', stiffness: 300, damping: 20 },
                }}
              />
            )
          })}
        </motion.g>
      </svg>
    </span>
  )
}
