'use client'

import { use, useState } from 'react'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTituloPestana } from '@/hooks/useTituloPestana'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import VistaOrdenTrabajo from '../_componentes/VistaOrdenTrabajo'

/**
 * Página de detalle de una orden de trabajo.
 * Wrapper que extrae el ID, monta la vista, alimenta la migaja dinámica
 * con el número de OT y setea el título de la pestaña del navegador.
 */
export default function PaginaOrdenDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const nav = useNavegacion()
  const [numeroOT, setNumeroOT] = useState<string | null>(null)
  useTituloPestana(numeroOT)

  return (
    <GuardPagina modulo="ordenes_trabajo">
      <VistaOrdenTrabajo
        ordenId={id}
        onTituloCargado={(numero) => {
          nav.setMigajaDinamica(`/ordenes/${id}`, numero)
          setNumeroOT(numero)
        }}
      />
    </GuardPagina>
  )
}
