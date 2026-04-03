'use client'

import { useState, useEffect } from 'react'

/**
 * useVisualViewport — Monitorea el visualViewport del navegador.
 *
 * Detecta cuándo el teclado virtual está abierto en iOS/Android midiendo
 * la diferencia entre window.innerHeight y visualViewport.height.
 * Devuelve la altura visible, el offset y un flag booleano.
 *
 * Se usa en: BottomSheet, formularios, chats — cualquier UI que necesite
 * ajustarse cuando aparece el teclado en móvil.
 */
interface EstadoViewport {
  /** Altura visible real del viewport (descontando teclado) */
  alturaVisible: number
  /** Offset vertical del viewport (scroll compensado por teclado) */
  offsetTop: number
  /** true si el teclado virtual está abierto (reducción > 100px) */
  tecladoAbierto: boolean
}

export function useVisualViewport(): EstadoViewport {
  const [estado, setEstado] = useState<EstadoViewport>({
    alturaVisible: typeof window !== 'undefined' ? window.innerHeight : 0,
    offsetTop: 0,
    tecladoAbierto: false,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let rafId: number

    const actualizar = () => {
      rafId = requestAnimationFrame(() => {
        const alturaVisible = vv.height
        const offsetTop = vv.offsetTop
        const tecladoAbierto = window.innerHeight - alturaVisible > 100

        setEstado(prev => {
          // Evitar re-renders innecesarios
          if (
            prev.alturaVisible === alturaVisible &&
            prev.offsetTop === offsetTop &&
            prev.tecladoAbierto === tecladoAbierto
          ) return prev
          return { alturaVisible, offsetTop, tecladoAbierto }
        })
      })
    }

    vv.addEventListener('resize', actualizar)
    vv.addEventListener('scroll', actualizar)

    // Estado inicial
    actualizar()

    return () => {
      cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', actualizar)
      vv.removeEventListener('scroll', actualizar)
    }
  }, [])

  return estado
}
