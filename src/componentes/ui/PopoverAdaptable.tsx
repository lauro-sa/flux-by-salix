'use client'

/**
 * PopoverAdaptable — Popover en desktop, BottomSheet en móvil.
 *
 * Misma API que Popover. En móvil, el trigger abre un BottomSheet
 * en vez de un panel flotante, para mejor UX táctil.
 *
 * Se usa en: NotificacionesHeader, RecordatoriosHeader, y cualquier
 * panel flotante que necesite adaptarse a mobile.
 */

import { type ReactNode } from 'react'
import { Popover } from '@/componentes/ui/Popover'
import { BottomSheet } from '@/componentes/ui/BottomSheet'
import { useEsMovil } from '@/hooks/useEsMovil'

type Alineacion = 'inicio' | 'centro' | 'fin'
type Lado = 'abajo' | 'arriba'

interface PropiedadesPopoverAdaptable {
  children: ReactNode
  contenido: ReactNode
  abierto?: boolean
  onCambio?: (abierto: boolean) => void
  alineacion?: Alineacion
  lado?: Lado
  ancho?: number | string
  altoMaximo?: number | string
  offset?: number
  clasePan?: string
  sinCerrarClickFuera?: boolean
  /** Título del BottomSheet en móvil */
  tituloMovil?: string
}

function PopoverAdaptable({
  children,
  contenido,
  abierto,
  onCambio,
  tituloMovil,
  ...propsPopover
}: PropiedadesPopoverAdaptable) {
  const esMovil = useEsMovil()

  if (esMovil) {
    const estaAbierto = abierto ?? false
    return (
      <>
        {/* Trigger — al tocar abre el BottomSheet */}
        <span
          onClick={() => onCambio?.(!estaAbierto)}
          className="inline-flex"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onCambio?.(!estaAbierto)
          }}
        >
          {children}
        </span>
        <BottomSheet
          abierto={estaAbierto}
          onCerrar={() => onCambio?.(false)}
          titulo={tituloMovil}
          altura="auto"
        >
          {contenido}
        </BottomSheet>
      </>
    )
  }

  return (
    <Popover
      abierto={abierto}
      onCambio={onCambio}
      {...propsPopover}
      contenido={contenido}
    >
      {children}
    </Popover>
  )
}

export { PopoverAdaptable, type PropiedadesPopoverAdaptable }
