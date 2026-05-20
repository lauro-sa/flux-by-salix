'use client'

import { useState } from 'react'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTituloPestana } from '@/hooks/useTituloPestana'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'

interface Props {
  id: string
  /** Número del presupuesto (P-0042) precargado server-side. Se usa para
   *  mostrar el nombre real del documento en el cargador mientras el editor
   *  termina de hidratar. */
  numeroInicial: string | null
}

export default function PaginaDetallePresupuestoCliente({ id, numeroInicial }: Props) {
  const nav = useNavegacion()
  const [tituloDoc, setTituloDoc] = useState<string | null>(numeroInicial)
  useTituloPestana(tituloDoc)

  return (
    <GuardPagina modulo="presupuestos">
      <EditorPresupuesto
        modo="editar"
        presupuestoId={id}
        numeroInicial={numeroInicial}
        onTituloCargado={(titulo) => {
          nav.setMigajaDinamica(`/presupuestos/${id}`, titulo)
          setTituloDoc(titulo)
        }}
      />
    </GuardPagina>
  )
}
