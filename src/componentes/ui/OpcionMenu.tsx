'use client'

import type { ReactNode } from 'react'

interface PropiedadesOpcionMenu {
  /** Texto visible de la opción */
  children: ReactNode
  /** Icono a la izquierda */
  icono?: ReactNode
  /** Elemento a la derecha (check, atajo, badge, etc.) */
  derecha?: ReactNode
  /** Estilo peligro (rojo) */
  peligro?: boolean
  /** Opción activa/seleccionada (texto marca) */
  activo?: boolean
  /** Deshabilitada */
  disabled?: boolean
  onClick?: () => void
  className?: string
}

/**
 * OpcionMenu — Item reutilizable para dropdowns, popovers y menús contextuales.
 * Se usa en: PlantillaListado (acciones), Header (sidebar menu), SwitcherEmpresa,
 * ItemSortable (contexto), Select (opciones), y cualquier menú desplegable.
 */
function OpcionMenu({
  children,
  icono,
  derecha,
  peligro = false,
  activo = false,
  disabled = false,
  onClick,
  className = '',
}: PropiedadesOpcionMenu) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors duration-100 rounded-md',
        peligro
          ? 'text-insignia-peligro-texto bg-transparent hover:bg-insignia-peligro-fondo'
          : activo
            ? 'text-texto-marca bg-texto-marca/5'
            : 'text-texto-primario bg-transparent hover:bg-superficie-hover',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      {icono && <span className="shrink-0 [&>svg]:size-[15px]">{icono}</span>}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {derecha && <span className="shrink-0 text-texto-terciario">{derecha}</span>}
    </button>
  )
}

export { OpcionMenu, type PropiedadesOpcionMenu }
