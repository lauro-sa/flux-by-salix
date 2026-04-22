'use client'

import { use } from 'react'
import { useGuardPermiso } from '@/hooks/useGuardPermiso'
import VistaOrdenTrabajo from '../_componentes/VistaOrdenTrabajo'

/**
 * Página de detalle de una orden de trabajo.
 * Wrapper que extrae el ID de los params y renderiza la vista completa.
 */
export default function PaginaOrdenDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { bloqueado } = useGuardPermiso('ordenes_trabajo')
  const { id } = use(params)
  if (bloqueado) return null
  return <VistaOrdenTrabajo ordenId={id} />
}
