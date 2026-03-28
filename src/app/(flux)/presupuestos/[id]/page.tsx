'use client'

import { useParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'

export default function PaginaDetallePresupuesto() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavegacion()

  return (
    <EditorPresupuesto
      modo="editar"
      presupuestoId={id}
      onTituloCargado={(titulo) => {
        nav.setMigajaDinamica(`/presupuestos/${id}`, titulo)
      }}
    />
  )
}
