'use client'

import { createContext, useContext, useRef, useState, useEffect, type RefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Contexto para que TablaDinamica renderice su paginador en el slot de PlantillaListado.
 * PlantillaListado crea el ref del contenedor, TablaDinamica usa un portal para renderizar ahí.
 */

const ContextoSlotPaginador = createContext<RefObject<HTMLDivElement | null> | null>(null)

/** PlantillaListado provee esto */
function ProveedorSlotPaginador({ slotRef, children }: { slotRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <ContextoSlotPaginador.Provider value={slotRef}>
      {children}
    </ContextoSlotPaginador.Provider>
  )
}

/** TablaDinamica usa esto para renderizar el paginador en el slot de PlantillaListado */
function PortalPaginador({ children }: { children: ReactNode }) {
  const slotRef = useContext(ContextoSlotPaginador)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    if (slotRef?.current) setMontado(true)
  }, [slotRef])

  if (!montado || !slotRef?.current) return null
  return createPortal(children, slotRef.current)
}

export { ProveedorSlotPaginador, PortalPaginador }
