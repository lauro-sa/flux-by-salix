'use client'

/**
 * CeldaPermiso — Checkbox individual dentro de la matriz de permisos.
 * Se usa en: MatrizCategoria (cada celda de la tabla).
 */

import { Check } from 'lucide-react'

interface PropiedadesCeldaPermiso {
  activo: boolean
  disponible: boolean
  onChange: () => void
}

export function CeldaPermiso({ activo, disponible, onChange }: PropiedadesCeldaPermiso) {
  if (!disponible) {
    return <td className="px-1 py-1.5 text-center"><span className="text-texto-terciario/30">—</span></td>
  }

  return (
    <td className="px-1 py-1.5 text-center">
      <button
        type="button"
        onClick={onChange}
        className={[
          'inline-flex items-center justify-center size-7 rounded-md border transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
          activo
            ? 'bg-texto-marca border-texto-marca text-white'
            : 'bg-transparent border-borde-fuerte text-transparent hover:border-texto-marca/50 hover:bg-texto-marca/5',
        ].join(' ')}
      >
        {activo && <Check size={14} strokeWidth={2.5} />}
      </button>
    </td>
  )
}
