'use client'

/**
 * ModalAdaptable — Renderiza Modal en desktop, BottomSheet en móvil.
 *
 * Tiene la MISMA API que Modal, así que reemplazar el import es directo:
 *   import { Modal } from '@/componentes/ui/Modal'
 *   →
 *   import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
 *
 * En desktop: Modal centrado clásico (scale + fade).
 * En móvil: BottomSheet desde abajo (swipe-to-dismiss, safe areas, scroll interno).
 *
 * Se usa en: todas las pantallas que necesitan modal responsivo.
 */

import { type ReactNode } from 'react'
import { Modal, type TamanoModal } from '@/componentes/ui/Modal'
import { BottomSheet, type AlturaSheet } from '@/componentes/ui/BottomSheet'
import { useEsMovil } from '@/hooks/useEsMovil'

interface PropiedadesModalAdaptable {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  /** Tamaño del modal en desktop — ignorado en móvil */
  tamano?: TamanoModal
  children: ReactNode
  acciones?: ReactNode
  /** Quita el padding del contenido */
  sinPadding?: boolean
  /** Altura del BottomSheet en móvil. Default: 'auto' */
  alturaMovil?: AlturaSheet
  /** Forzar siempre Modal (nunca BottomSheet), útil para modales muy complejos */
  forzarModal?: boolean
  /** Botones extra en el encabezado */
  accionesEncabezado?: ReactNode
  /** Modo pantalla completa */
  expandido?: boolean
}

function ModalAdaptable({
  abierto,
  onCerrar,
  titulo,
  tamano = 'lg',
  children,
  acciones,
  sinPadding,
  alturaMovil = 'auto',
  forzarModal = false,
  accionesEncabezado,
  expandido,
}: PropiedadesModalAdaptable) {
  const esMovil = useEsMovil()

  if (esMovil && !forzarModal) {
    return (
      <BottomSheet
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={titulo}
        acciones={acciones}
        altura={alturaMovil}
        sinPadding={sinPadding}
      >
        {children}
      </BottomSheet>
    )
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      tamano={tamano}
      acciones={acciones}
      sinPadding={sinPadding}
      accionesEncabezado={accionesEncabezado}
      expandido={expandido}
    >
      {children}
    </Modal>
  )
}

export { ModalAdaptable, type PropiedadesModalAdaptable }
