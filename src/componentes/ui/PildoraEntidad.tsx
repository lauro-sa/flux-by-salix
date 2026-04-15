'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface PropiedadesPildoraEntidad {
  /** Texto visible de la pildora */
  nombre: string
  /** Icono a la izquierda (ReactNode o componente lucide) */
  icono?: ReactNode
  /** Avatar circular con inicial (ej: responsable) — reemplaza icono */
  avatar?: string
  /** Callback al hacer click en el nombre — navega a la entidad */
  onNavegar?: () => void
  /** Callback al remover — muestra la X */
  onRemover?: () => void
  /** Tamaño de la pildora */
  compacto?: boolean
  /** Clases CSS adicionales para el contenedor */
  className?: string
}

/**
 * PildoraEntidad — Chip reutilizable para entidades vinculadas.
 * Se usa en: vínculos de actividades, responsables, contactos vinculados, documentos.
 * Estilo: color marca de Flux, clickeable para navegar, X para remover.
 */
function PildoraEntidad({
  nombre,
  icono,
  avatar,
  onNavegar,
  onRemover,
  compacto = false,
  className = '',
}: PropiedadesPildoraEntidad) {
  const textoSize = compacto ? 'text-xxs' : 'text-xs'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-md font-medium border border-texto-marca/30 bg-texto-marca/10 text-texto-marca',
        compacto ? 'pl-1.5 pr-1 py-0.5' : 'pl-2 pr-1 py-0.5',
        className,
      ].join(' ')}
    >
      {/* Avatar circular con inicial — para responsables */}
      {avatar && (
        <span className="size-4 rounded-full bg-texto-marca/20 flex items-center justify-center text-[10px] font-bold shrink-0">
          {avatar.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Icono — para documentos, contactos, visitas */}
      {!avatar && icono && (
        <span className="shrink-0 flex items-center">{icono}</span>
      )}

      {/* Nombre — clickeable si tiene onNavegar */}
      {onNavegar ? (
        <button
          type="button"
          onClick={onNavegar}
          className={`bg-transparent border-none cursor-pointer text-texto-marca hover:underline transition-colors p-0 ${textoSize} font-medium`}
        >
          {nombre}
        </button>
      ) : (
        <span className={textoSize}>{nombre}</span>
      )}

      {/* Botón remover */}
      {onRemover && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemover() }}
          className="size-5 rounded flex items-center justify-center bg-transparent border-none cursor-pointer text-texto-marca/40 hover:text-estado-error hover:bg-estado-error/10 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}

export { PildoraEntidad, type PropiedadesPildoraEntidad }
