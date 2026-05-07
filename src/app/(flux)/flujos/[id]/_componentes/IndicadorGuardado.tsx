'use client'

import { Check, Loader2 } from 'lucide-react'
import { useIndicadorGuardado } from './hooks/useIndicadorGuardado'

/**
 * Indicador de guardado del header del editor.
 *
 * Compone el texto reactivo de `useIndicadorGuardado` con un ícono:
 * spinner mientras `guardando=true`, check tenue cuando ya guardó.
 *
 * En mobile (md:) escondemos el texto pero conservamos el ícono — así
 * sigue habiendo retroalimentación visual sin ocupar el header.
 */

interface Props {
  guardando: boolean
  ultimoGuardado: number | null
}

export default function IndicadorGuardado({ guardando, ultimoGuardado }: Props) {
  const texto = useIndicadorGuardado(guardando, ultimoGuardado)
  if (!guardando && ultimoGuardado === null) return null

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-texto-terciario select-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {guardando ? (
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      ) : (
        <Check size={12} aria-hidden="true" />
      )}
      <span className="hidden md:inline">{texto}</span>
    </div>
  )
}
