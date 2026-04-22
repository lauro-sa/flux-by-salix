'use client'

import { useSearchParams } from 'next/navigation'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'

export default function PaginaNuevoPresupuesto() {
  return (
    <GuardPagina modulo="presupuestos" accion="crear">
      <PaginaNuevoPresupuestoInterno />
    </GuardPagina>
  )
}

function PaginaNuevoPresupuestoInterno() {
  const searchParams = useSearchParams()
  const contactoId = searchParams.get('contacto_id') || undefined
  const actividadOrigenId = searchParams.get('actividad_origen_id') || undefined

  return (
    <EditorPresupuesto
      modo="crear"
      contactoIdInicial={contactoId}
      actividadOrigenId={actividadOrigenId}
      onCreado={(id) => {
        window.history.replaceState(null, '', `/presupuestos/${id}`)
      }}
    />
  )
}
