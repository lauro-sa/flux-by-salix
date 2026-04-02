'use client'

/**
 * ChipEmail — Chip visual para mostrar un email con botón de eliminar.
 * Se usa en: InputEmailChips (dentro de ModalEnviarDocumento).
 */

import { X } from 'lucide-react'

interface PropiedadesChipEmail {
  email: string
  onRemover: () => void
}

export function ChipEmail({ email, onRemover }: PropiedadesChipEmail) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-[220px]"
      style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
    >
      <span className="truncate">{email}</span>
      <button onClick={onRemover} className="flex-shrink-0 hover:opacity-70" type="button">
        <X size={10} />
      </button>
    </span>
  )
}
