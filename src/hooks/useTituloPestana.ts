'use client'

/**
 * Actualiza `document.title` mientras la pestaña activa de Flux esté
 * mostrando una entidad específica (un tipo de actividad, una OT, una
 * plantilla, etc.). El layout ya pone el título base ("Flux"), este
 * hook lo extiende con el nombre del recurso.
 *
 * Formato: `"{titulo} · Flux"`. Si `titulo` es null/undefined/vacío el
 * hook no toca el título (el del layout se mantiene). Al desmontar el
 * componente que llamó al hook se restaura el título que había justo
 * antes de fijarlo — así, al navegar de "OT-0023" a un listado, el
 * "Flux" base reaparece sin que cada página tenga que limpiar.
 *
 * Limita a 80 caracteres para evitar títulos kilométricos en pestañas
 * (Chrome corta visualmente, pero el atributo expuesto a screen readers
 * sigue siendo el completo — preferimos truncar nosotros).
 */

import { useEffect } from 'react'

const SUFIJO = ' · Flux'
const LIMITE_CARACTERES = 80

export function useTituloPestana(titulo: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const limpio = (titulo ?? '').trim()
    if (!limpio) return

    const tituloPrevio = document.title
    const truncado =
      limpio.length > LIMITE_CARACTERES
        ? `${limpio.slice(0, LIMITE_CARACTERES - 1)}…`
        : limpio
    document.title = `${truncado}${SUFIJO}`

    return () => {
      document.title = tituloPrevio
    }
  }, [titulo])
}
