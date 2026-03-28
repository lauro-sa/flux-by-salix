'use client'

import EditorPresupuesto from '../_componentes/EditorPresupuesto'

export default function PaginaNuevoPresupuesto() {
  return (
    <EditorPresupuesto
      modo="crear"
      onCreado={(id) => {
        window.history.replaceState(null, '', `/presupuestos/${id}`)
      }}
    />
  )
}
