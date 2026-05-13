'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTituloPestana } from '@/hooks/useTituloPestana'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'

export default function PaginaDetallePresupuesto() {
  return (
    <GuardPagina modulo="presupuestos">
      <PaginaDetallePresupuestoInterno />
    </GuardPagina>
  )
}

function PaginaDetallePresupuestoInterno() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavegacion()
  const [tituloDoc, setTituloDoc] = useState<string | null>(null)
  useTituloPestana(tituloDoc)

  return (
    <EditorPresupuesto
      modo="editar"
      presupuestoId={id}
      onTituloCargado={(titulo) => {
        nav.setMigajaDinamica(`/presupuestos/${id}`, titulo)
        setTituloDoc(titulo)
      }}
    />
  )
}
