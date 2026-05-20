'use client'

import { useState } from 'react'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTituloPestana } from '@/hooks/useTituloPestana'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import VistaOrdenTrabajo from '../_componentes/VistaOrdenTrabajo'

interface Props {
  id: string
  numeroInicial: string | null
}

export default function PaginaOrdenDetalleCliente({ id, numeroInicial }: Props) {
  const nav = useNavegacion()
  const [numeroOT, setNumeroOT] = useState<string | null>(numeroInicial)
  useTituloPestana(numeroOT)

  return (
    <GuardPagina modulo="ordenes_trabajo">
      <VistaOrdenTrabajo
        ordenId={id}
        numeroInicial={numeroInicial}
        onTituloCargado={(numero) => {
          nav.setMigajaDinamica(`/ordenes/${id}`, numero)
          setNumeroOT(numero)
        }}
      />
    </GuardPagina>
  )
}
