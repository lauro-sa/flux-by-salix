'use client'

import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Header del panel lateral del editor de flujos (sub-PR 19.3a).
 *
 * Layout fijo de tres slots:
 *   [ícono 36x36] [título legible del tipo] [botón cerrar]
 *
 * Decisión de scope 19.3a: el título es read-only (título legible del
 * tipo del paso). El "nombre editable inline" mencionado en el plan
 * §1.7.1 requiere agregar un campo `etiqueta?: string` a `AccionBase` y
 * `DisparadorWorkflow`, lo cual toca tipos compartidos del motor —
 * deuda explícita para un sub-PR posterior. Mientras tanto el panel
 * sigue siendo identificable por el ícono + tipo, que es lo que el plan
 * exige como mínimo identificatorio.
 */

interface Props {
  Icono: LucideIcon | null
  titulo: string
  onCerrar: () => void
}

export default function HeaderPanel({ Icono, titulo, onCerrar }: Props) {
  const { t } = useTraduccion()

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-borde-sutil">
      {Icono && (
        <span
          className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/10 text-texto-marca"
          aria-hidden="true"
        >
          <Icono size={18} strokeWidth={1.7} />
        </span>
      )}
      <h2 className="flex-1 text-sm font-semibold text-texto-primario truncate">
        {titulo}
      </h2>
      <button
        type="button"
        onClick={onCerrar}
        aria-label={t('comun.cerrar')}
        className="shrink-0 inline-flex items-center justify-center size-8 rounded-md text-texto-terciario hover:bg-superficie-hover hover:text-texto-secundario transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  )
}
