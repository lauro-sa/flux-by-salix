'use client'

import { use } from 'react'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import VistaOrdenTrabajo from '../_componentes/VistaOrdenTrabajo'

/**
 * Página de detalle de una orden de trabajo.
 * Wrapper que extrae el ID de los params y renderiza la vista completa.
 */
export default function PaginaOrdenDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <GuardPagina modulo="ordenes_trabajo">
      <VistaOrdenTrabajo ordenId={id} />
    </GuardPagina>
  )
}
