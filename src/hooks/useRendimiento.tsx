'use client'

import { useState, useEffect } from 'react'

/**
 * Hook que detecta si el dispositivo soporta efectos visuales pesados (backdrop-filter, blur).
 * Evalúa CPU, RAM, preferencia de movimiento reducido y soporte de backdrop-filter.
 * Cachea el resultado en localStorage para no re-evaluar en cada visita.
 * Se usa en: useTema (para habilitar/deshabilitar modo cristal).
 */

const CLAVE_CACHE = 'flux_rendimiento'

interface ResultadoRendimiento {
  soportaCristal: boolean
  razon?: string
}

function evaluar(): ResultadoRendimiento {
  // 1. Preferencia del usuario: movimiento reducido
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { soportaCristal: false, razon: 'Movimiento reducido activado en tu sistema' }
  }

  // 2. Soporte de backdrop-filter
  if (!CSS.supports('backdrop-filter', 'blur(1px)') && !CSS.supports('-webkit-backdrop-filter', 'blur(1px)')) {
    return { soportaCristal: false, razon: 'Tu navegador no soporta efectos de transparencia' }
  }

  // 3. CPU débil (menos de 4 núcleos)
  const nucleos = navigator.hardwareConcurrency || 0
  if (nucleos > 0 && nucleos < 4) {
    return { soportaCristal: false, razon: `Procesador con ${nucleos} núcleos — insuficiente para efectos visuales` }
  }

  // 4. RAM baja (menos de 4 GB) — solo disponible en Chromium
  const memoria = (navigator as { deviceMemory?: number }).deviceMemory
  if (memoria !== undefined && memoria < 4) {
    return { soportaCristal: false, razon: `${memoria} GB de RAM — insuficiente para efectos visuales` }
  }

  return { soportaCristal: true }
}

function useRendimiento(): ResultadoRendimiento {
  const [resultado, setResultado] = useState<ResultadoRendimiento>({ soportaCristal: true })

  useEffect(() => {
    // Intentar leer cache primero
    const cache = localStorage.getItem(CLAVE_CACHE)
    if (cache) {
      try {
        setResultado(JSON.parse(cache))
        return
      } catch {
        // Cache corrupto, re-evaluar
      }
    }

    const evaluacion = evaluar()
    setResultado(evaluacion)
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(evaluacion))
  }, [])

  return resultado
}

export { useRendimiento, type ResultadoRendimiento }
