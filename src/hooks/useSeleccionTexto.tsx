'use client'

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'

/**
 * Posición del toolbar flotante relativa al viewport (fixed positioning).
 */
interface PosicionSeleccion {
  top: number
  left: number
}

/**
 * Datos de la selección detectada en un elemento de texto.
 */
interface DatosSeleccion {
  /** Texto actualmente seleccionado */
  texto: string
  /** Posición para el toolbar flotante (viewport coords) */
  posicion: PosicionSeleccion
  /** Rango de selección en el elemento (start, end) — para reemplazo parcial */
  rango: { inicio: number; fin: number }
}

interface RetornoSeleccionTexto {
  /** Datos de la selección actual, null si no hay selección */
  seleccion: DatosSeleccion | null
  /** Limpia la selección manualmente */
  limpiar: () => void
}

/**
 * useSeleccionTexto — Detecta selección de texto en un textarea o input.
 *
 * Escucha mouseup, keyup y touchend para detectar cuándo el usuario
 * selecciona texto dentro del elemento referenciado. Calcula la posición
 * para un toolbar flotante y expone el rango para reemplazo parcial.
 *
 * Uso:
 *   const ref = useRef<HTMLTextAreaElement>(null)
 *   const { seleccion, limpiar } = useSeleccionTexto(ref)
 *
 * @param ref — Ref al textarea o input a observar
 * @param habilitado — Permite desactivar la detección (default: true)
 */
function useSeleccionTexto(
  ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  habilitado = true
): RetornoSeleccionTexto {
  const [seleccion, setSeleccion] = useState<DatosSeleccion | null>(null)
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpiar = useCallback(() => setSeleccion(null), [])

  useEffect(() => {
    const el = ref?.current
    if (!el || !habilitado) return

    function verificar(e?: MouseEvent | KeyboardEvent | TouchEvent) {
      // requestAnimationFrame para que el browser actualice selectionStart/End
      requestAnimationFrame(() => {
        const elemento = ref.current
        if (!elemento) return

        const { selectionStart, selectionEnd } = elemento
        if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) {
          setSeleccion(null)
          return
        }

        const textoSeleccionado = elemento.value.substring(selectionStart, selectionEnd)
        if (!textoSeleccionado.trim()) {
          setSeleccion(null)
          return
        }

        // Calcular posición — usar coords del evento si disponibles (mouse/touch)
        let top: number
        let left: number

        const tieneCoords = e && 'clientX' in e && e.clientX && e.clientY
        if (tieneCoords) {
          // Posicionar arriba del cursor con un pequeño offset
          top = Math.max(8, (e as MouseEvent).clientY - 48)
          left = Math.max(8, Math.min(
            (e as MouseEvent).clientX - 60,
            window.innerWidth - 160
          ))
        } else {
          // Selección con teclado — posicionar arriba del elemento
          const rect = elemento.getBoundingClientRect()
          top = Math.max(8, rect.top - 48)
          left = rect.left + rect.width / 2 - 60
        }

        setSeleccion({
          texto: textoSeleccionado,
          posicion: { top, left },
          rango: { inicio: selectionStart, fin: selectionEnd },
        })
      })
    }

    function alPerderFoco() {
      // Delay para no interferir con clics en el toolbar flotante
      temporizadorRef.current = setTimeout(() => {
        if (document.activeElement !== ref.current) {
          setSeleccion(null)
        }
      }, 200)
    }

    el.addEventListener('mouseup', verificar as EventListener)
    el.addEventListener('keyup', verificar as EventListener)
    el.addEventListener('touchend', verificar as EventListener)
    el.addEventListener('focusout', alPerderFoco)

    return () => {
      el.removeEventListener('mouseup', verificar as EventListener)
      el.removeEventListener('keyup', verificar as EventListener)
      el.removeEventListener('touchend', verificar as EventListener)
      el.removeEventListener('focusout', alPerderFoco)
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
    }
  }, [ref, habilitado, limpiar])

  return { seleccion, limpiar }
}

export { useSeleccionTexto, type DatosSeleccion, type PosicionSeleccion }
