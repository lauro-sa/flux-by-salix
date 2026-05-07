'use client'

import { Plus } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Botones de "agregar paso" del canvas (sub-PR 19.2 — §1.6.5 del plan).
 *
 *   • <BotonAgregarPasoIntermedio> → "+" entre tarjetas, visible al
 *     hover entre dos pasos. Inserta paso en esa posición.
 *
 *   • <BotonAgregarPasoFinal>      → "+ Agregar paso", siempre visible
 *     debajo del último paso. Agrega al final.
 *
 * Ambos delegan al mismo callback que abre el modal `CatalogoPasos` en
 * modo `accion`. La inserción la hace el caller con el índice correcto.
 */

interface PropsIntermedio {
  onClick: () => void
  /** Etiqueta accesible cuando el botón está oculto visualmente. */
  posicion: number
}

export function BotonAgregarPasoIntermedio({ onClick, posicion }: PropsIntermedio) {
  const { t } = useTraduccion()
  return (
    <div className="relative flex items-center justify-center py-1">
      {/* Línea conectora vertical sutil (siempre visible) */}
      <div className="absolute inset-x-0 flex justify-center">
        <span className="h-4 w-px bg-borde-sutil" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={onClick}
        aria-label={t('flujos.editor.agregar_paso_intermedio').replace(
          '{{n}}',
          String(posicion + 1),
        )}
        className="relative z-[1] inline-flex items-center justify-center size-7 rounded-full border border-borde-sutil bg-superficie-app text-texto-terciario opacity-0 group-hover/canvas:opacity-100 hover:bg-superficie-hover hover:text-texto-marca hover:border-texto-marca/40 transition-all duration-150 cursor-pointer focus-visible:opacity-100"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

interface PropsFinal {
  onClick: () => void
}

export function BotonAgregarPasoFinal({ onClick }: PropsFinal) {
  const { t } = useTraduccion()
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 mt-1 rounded-card border border-dashed border-borde-sutil bg-transparent text-texto-secundario hover:border-texto-marca hover:text-texto-marca hover:bg-texto-marca/5 transition-colors cursor-pointer text-sm font-medium"
    >
      <Plus size={14} strokeWidth={2} />
      {t('flujos.editor.agregar_paso_final')}
    </button>
  )
}
