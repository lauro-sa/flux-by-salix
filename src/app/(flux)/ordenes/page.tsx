'use client'

import ContenidoOrdenes from './_componentes/ContenidoOrdenes'

/**
 * Página de listado de órdenes de trabajo.
 * Reutiliza PlantillaListado + TablaDinamica vía ContenidoOrdenes.
 * El feedback visual de carga lo da la CargaBarra en PlantillaApp.
 */
export default function PaginaOrdenes() {
  return <ContenidoOrdenes />
}
