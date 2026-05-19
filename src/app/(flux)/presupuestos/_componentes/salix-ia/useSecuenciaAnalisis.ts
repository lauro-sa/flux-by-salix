'use client'

import { useEffect, useRef, useState } from 'react'
import type { EstadoPaso, PasoChecklist } from './tipos'

/**
 * useSecuenciaAnalisis — Orquesta la checklist visual de 3 pasos
 * (identificar / matchear / similares) mientras corre la promesa
 * del backend que devuelve las propuestas.
 *
 * Por qué este hook existe:
 *  - El backend es un único POST. No hay SSE/streaming hoy.
 *  - Pero queremos comunicar progreso al usuario en vez de un spinner mudo.
 *  - Cada paso tarda ~duracionMinima/3 visualmente. Si el backend tarda
 *    más, el último paso queda pulsando hasta que llega la respuesta.
 *  - Si el backend responde antes de duracionMinima, esperamos a que
 *    la secuencia se "asiente" y recién entonces resolvemos. Esto evita
 *    que parpadee de vacío → resultados sin dar feedback de proceso.
 *
 * Uso:
 *   const { activo, pasos, comenzar, terminar } = useSecuenciaAnalisis()
 *   comenzar()
 *   await llamarBackend().then(terminar)
 */

interface OpcionesSecuencia {
  /** Duración total mínima del análisis visual. Default 2400ms. */
  duracionMinima?: number
}

const ETIQUETAS: Record<PasoChecklist, string> = {
  identificar: 'Identificando servicios',
  matchear: 'Matcheando con catálogo',
  similares: 'Buscando similares',
}

const ORDEN_PASOS: PasoChecklist[] = ['identificar', 'matchear', 'similares']

export function useSecuenciaAnalisis(opciones: OpcionesSecuencia = {}) {
  const { duracionMinima = 2400 } = opciones
  const [activo, setActivo] = useState(false)
  const [indicePasoActivo, setIndicePasoActivo] = useState(0)
  const [completado, setCompletado] = useState(false)
  const inicioRef = useRef<number>(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Cleanup de timers cuando el componente se desmonta o cambia el estado
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [])

  const comenzar = () => {
    // Resetear estado
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    inicioRef.current = Date.now()
    setActivo(true)
    setCompletado(false)
    setIndicePasoActivo(0)

    // Avanzar cada paso a tiempos calculados (duracionMinima / 3 cada uno)
    const stepDuration = duracionMinima / ORDEN_PASOS.length
    for (let i = 1; i < ORDEN_PASOS.length; i++) {
      const t = setTimeout(() => setIndicePasoActivo(i), stepDuration * i)
      timersRef.current.push(t)
    }
  }

  /**
   * Llamar cuando el backend respondió.
   * Garantiza que la secuencia haya cumplido duracionMinima antes
   * de marcar completado (evita parpadeo si el backend es muy rápido).
   * Devuelve una promesa que se resuelve cuando la secuencia terminó.
   */
  const terminar = (): Promise<void> => {
    return new Promise((resolve) => {
      const transcurrido = Date.now() - inicioRef.current
      const restante = Math.max(0, duracionMinima - transcurrido)

      const t = setTimeout(() => {
        setIndicePasoActivo(ORDEN_PASOS.length) // todos hechos
        setCompletado(true)
        // Pequeño respiro para que el último "hecho" se asiente visualmente
        const t2 = setTimeout(() => {
          setActivo(false)
          resolve()
        }, 200)
        timersRef.current.push(t2)
      }, restante)
      timersRef.current.push(t)
    })
  }

  /** Cancelar la secuencia (ej: error del backend). */
  const cancelar = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setActivo(false)
    setCompletado(false)
    setIndicePasoActivo(0)
  }

  // Derivar el estado de cada paso para que la UI los renderee
  const pasos: EstadoPaso[] = ORDEN_PASOS.map((paso, i) => ({
    paso,
    etiqueta: ETIQUETAS[paso],
    estado:
      completado ? 'hecho' :
      i < indicePasoActivo ? 'hecho' :
      i === indicePasoActivo ? 'activo' :
      'pendiente',
  }))

  return { activo, pasos, comenzar, terminar, cancelar }
}
