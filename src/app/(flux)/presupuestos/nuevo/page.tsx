'use client'

import { useSearchParams } from 'next/navigation'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'

export default function PaginaNuevoPresupuesto() {
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
