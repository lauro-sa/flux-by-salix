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
      <button
        onClick={onRemover}
        type="button"
        className="inline-flex items-center justify-center size-3.5 rounded-full border-none bg-transparent text-current p-0 cursor-pointer hover:bg-black/10 transition-colors shrink-0"
      >
        <X size={10} />
      </button>
    </span>
  )
}
