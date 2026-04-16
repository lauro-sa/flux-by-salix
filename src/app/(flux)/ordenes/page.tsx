'use client'

import { Suspense } from 'react'
import ContenidoOrdenes from './_componentes/ContenidoOrdenes'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'

/**
 * Página de listado de órdenes de trabajo.
 * Reutiliza PlantillaListado + TablaDinamica vía ContenidoOrdenes.
 */
export default function PaginaOrdenes() {
  return (
    <Suspense fallback={<SkeletonTabla />}>
      <ContenidoOrdenes />
    </Suspense>
  )
}
