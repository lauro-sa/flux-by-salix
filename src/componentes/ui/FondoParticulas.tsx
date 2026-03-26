'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useTema } from '@/hooks/useTema'

/**
 * FondoParticulas — grid de puntos interactivo estilo constelación.
 * Tiene un cursor "fantasma" que recorre el canvas lentamente generando
 * el efecto de constelación de forma autónoma. Cuando el usuario mueve
 * el mouse real, ese toma prioridad; al irse, vuelve el fantasma.
 * Soporta dark/light mode automáticamente.
 * Se usa en: layout de auth, landing page.
 */

interface PropiedadesFondoParticulas {
  className?: string
}

// Configuración de puntos
const ESPACIADO = 40
const RADIO_BASE = 1.2
const RADIO_MAX = 3
const OPACIDAD_BASE = 0.15
const OPACIDAD_MAX = 0.7
const RADIO_INFLUENCIA = 180
const DISTANCIA_LINEA = 80
const FUERZA_REPULSION = 12

// Configuración del cursor fantasma
const FANTASMA_VELOCIDAD = 0.4 // px por frame — muy lento y orgánico
const FANTASMA_RADIO_INFLUENCIA = 140 // un poco menor que el real
const FANTASMA_OPACIDAD_MULT = 0.55 // efecto más sutil que el mouse real
const FANTASMA_CAMBIO_DIR = 0.008 // qué tan seguido cambia de rumbo (por frame)

interface Punto {
  xOriginal: number
  yOriginal: number
  x: number
  y: number
  radio: number
  opacidad: number
}

interface CursorFantasma {
  x: number
  y: number
  angulo: number
  velocidadAngular: number
  velocidad: number
}

function FondoParticulas({ className = '' }: PropiedadesFondoParticulas) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const puntosRef = useRef<Punto[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const mouseActivoRef = useRef(false) // true si el usuario tiene el mouse encima
  const fantasmasRef = useRef<CursorFantasma[]>([])
  const animFrameRef = useRef<number>(0)
  const dimensionesRef = useRef({ ancho: 0, alto: 0 })
  const { temaActivo } = useTema()

  const inicializarPuntos = useCallback((ancho: number, alto: number) => {
    const puntos: Punto[] = []
    const columnas = Math.ceil(ancho / ESPACIADO) + 1
    const filas = Math.ceil(alto / ESPACIADO) + 1

    for (let fila = 0; fila < filas; fila++) {
      for (let col = 0; col < columnas; col++) {
        const x = col * ESPACIADO
        const y = fila * ESPACIADO
        puntos.push({
          xOriginal: x,
          yOriginal: y,
          x,
          y,
          radio: RADIO_BASE,
          opacidad: OPACIDAD_BASE,
        })
      }
    }

    puntosRef.current = puntos
    dimensionesRef.current = { ancho, alto }

    // Inicializar 2 fantasmas en zonas distintas del canvas
    fantasmasRef.current = [
      {
        x: ancho * 0.15 + Math.random() * ancho * 0.25,
        y: alto * 0.2 + Math.random() * alto * 0.3,
        angulo: Math.random() * Math.PI * 2,
        velocidadAngular: (Math.random() - 0.5) * FANTASMA_CAMBIO_DIR,
        velocidad: FANTASMA_VELOCIDAD * (0.8 + Math.random() * 0.4),
      },
      {
        x: ancho * 0.55 + Math.random() * ancho * 0.3,
        y: alto * 0.5 + Math.random() * alto * 0.3,
        angulo: Math.random() * Math.PI * 2,
        velocidadAngular: (Math.random() - 0.5) * FANTASMA_CAMBIO_DIR,
        velocidad: FANTASMA_VELOCIDAD * (0.6 + Math.random() * 0.5),
      },
    ]
  }, [])

  // Mover los cursores fantasma — movimiento orgánico tipo drift
  const actualizarFantasmas = useCallback(() => {
    const { ancho, alto } = dimensionesRef.current

    for (const f of fantasmasRef.current) {
      // Cambiar rumbo gradualmente (tipo ruido Perlin simplificado)
      f.velocidadAngular += (Math.random() - 0.5) * FANTASMA_CAMBIO_DIR * 2
      f.velocidadAngular *= 0.98 // damping para suavizar
      f.angulo += f.velocidadAngular

      // Mover con su velocidad propia
      f.x += Math.cos(f.angulo) * f.velocidad
      f.y += Math.sin(f.angulo) * f.velocidad

      // Rebotar suavemente en los bordes
      const margen = 80
      if (f.x < margen) f.angulo += 0.03
      if (f.x > ancho - margen) f.angulo += 0.03
      if (f.y < margen) f.angulo += 0.03
      if (f.y > alto - margen) f.angulo += 0.03

      // Clamp por seguridad
      f.x = Math.max(0, Math.min(ancho, f.x))
      f.y = Math.max(0, Math.min(alto, f.y))
    }
  }, [])

  const dibujar = useCallback((ctx: CanvasRenderingContext2D, ancho: number, alto: number) => {
    const esOscuro = temaActivo === 'oscuro'
    const colorPunto = esOscuro ? '255, 255, 255' : '0, 0, 0'
    const colorLinea = esOscuro ? '255, 255, 255' : '0, 0, 0'

    ctx.clearRect(0, 0, ancho, alto)

    // Actualizar fantasmas
    actualizarFantasmas()

    // Decidir qué cursores usar
    const usarMouse = mouseActivoRef.current
    const cursorReal = mouseRef.current

    // Mouse real → solo mouse. Sin mouse → los 2 fantasmas.
    const cursores: Array<{ x: number; y: number; radioInf: number; opacidadMult: number }> = []

    if (usarMouse) {
      cursores.push({
        x: cursorReal.x,
        y: cursorReal.y,
        radioInf: RADIO_INFLUENCIA,
        opacidadMult: 1,
      })
    } else {
      for (const f of fantasmasRef.current) {
        cursores.push({
          x: f.x,
          y: f.y,
          radioInf: FANTASMA_RADIO_INFLUENCIA,
          opacidadMult: FANTASMA_OPACIDAD_MULT,
        })
      }
    }

    const puntos = puntosRef.current
    const puntosActivos: Punto[] = []

    // Actualizar y dibujar puntos
    for (const p of puntos) {
      // Calcular influencia combinada de todos los cursores
      let radioObjetivo = RADIO_BASE
      let opacidadObjetivo = OPACIDAD_BASE
      let desplazamientoX = 0
      let desplazamientoY = 0
      let estaActivo = false

      for (const cursor of cursores) {
        const dx = cursor.x - p.xOriginal
        const dy = cursor.y - p.yOriginal
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < cursor.radioInf) {
          const factor = 1 - dist / cursor.radioInf
          const factorSuave = factor * factor

          const radioExtra = (RADIO_MAX - RADIO_BASE) * factorSuave * cursor.opacidadMult
          const opacidadExtra = (OPACIDAD_MAX - OPACIDAD_BASE) * factorSuave * cursor.opacidadMult

          radioObjetivo = Math.max(radioObjetivo, RADIO_BASE + radioExtra)
          opacidadObjetivo = Math.max(opacidadObjetivo, OPACIDAD_BASE + opacidadExtra)

          if (dist > 0) {
            const angulo = Math.atan2(dy, dx)
            const repulsion = FUERZA_REPULSION * factorSuave * cursor.opacidadMult
            desplazamientoX -= Math.cos(angulo) * repulsion
            desplazamientoY -= Math.sin(angulo) * repulsion
          }

          estaActivo = true
        }
      }

      if (estaActivo) {
        // Interpolar suavemente hacia el objetivo
        p.radio += (radioObjetivo - p.radio) * 0.15
        p.opacidad += (opacidadObjetivo - p.opacidad) * 0.15
        p.x += (p.xOriginal + desplazamientoX - p.x) * 0.15
        p.y += (p.yOriginal + desplazamientoY - p.y) * 0.15

        puntosActivos.push(p)
      } else {
        // Volver suavemente a la posición original
        p.x += (p.xOriginal - p.x) * 0.08
        p.y += (p.yOriginal - p.y) * 0.08
        p.radio += (RADIO_BASE - p.radio) * 0.08
        p.opacidad += (OPACIDAD_BASE - p.opacidad) * 0.08
      }

      // Dibujar punto
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${colorPunto}, ${p.opacidad})`
      ctx.fill()
    }

    // Dibujar líneas de constelación entre puntos activos cercanos
    for (let i = 0; i < puntosActivos.length; i++) {
      for (let j = i + 1; j < puntosActivos.length; j++) {
        const a = puntosActivos[i]
        const b = puntosActivos[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < DISTANCIA_LINEA) {
          const opacidadLinea = (1 - dist / DISTANCIA_LINEA) * Math.min(a.opacidad, b.opacidad) * 0.6
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(${colorLinea}, ${opacidadLinea})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }
  }, [temaActivo, actualizarFantasmas])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const contenedor = canvas.parentElement
    if (!contenedor) return

    const ajustarTamano = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = contenedor.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(dpr, dpr)
      inicializarPuntos(rect.width, rect.height)
    }

    ajustarTamano()

    const resizeObserver = new ResizeObserver(ajustarTamano)
    resizeObserver.observe(contenedor)

    const manejarMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      mouseActivoRef.current = true
    }

    const manejarMouseSalir = () => {
      mouseActivoRef.current = false
    }

    canvas.addEventListener('mousemove', manejarMouse)
    canvas.addEventListener('mouseleave', manejarMouseSalir)

    const animar = () => {
      const rect = contenedor.getBoundingClientRect()
      dibujar(ctx, rect.width, rect.height)
      animFrameRef.current = requestAnimationFrame(animar)
    }

    animar()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
      canvas.removeEventListener('mousemove', manejarMouse)
      canvas.removeEventListener('mouseleave', manejarMouseSalir)
    }
  }, [inicializarPuntos, dibujar])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${className}`}
      style={{ pointerEvents: 'auto' }}
    />
  )
}

export { FondoParticulas }
