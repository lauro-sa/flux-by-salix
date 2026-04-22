'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useGuardPermiso } from '@/hooks/useGuardPermiso'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'

export default function PaginaDetallePresupuesto() {
  const { bloqueado } = useGuardPermiso('presupuestos')
  const { id } = useParams<{ id: string }>()
  const nav = useNavegacion()

  // Restaurar título original al salir
  useEffect(() => {
    const tituloOriginal = document.title
    return () => { document.title = tituloOriginal }
  }, [])

  if (bloqueado) return null

  return (
    <EditorPresupuesto
      modo="editar"
      presupuestoId={id}
      onTituloCargado={(titulo) => {
        nav.setMigajaDinamica(`/presupuestos/${id}`, titulo)
        document.title = `${titulo} — Flux`
      }}
    />
  )
}
