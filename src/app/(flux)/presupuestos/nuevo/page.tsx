'use client'

import { useSearchParams } from 'next/navigation'
import EditorPresupuesto from '../_componentes/EditorPresupuesto'
import { useGuardPermiso } from '@/hooks/useGuardPermiso'

export default function PaginaNuevoPresupuesto() {
  // Bloquea hasta cargar permisos. Sin 'crear' redirige al dashboard
  // con toast antes de renderizar el editor.
  const { bloqueado } = useGuardPermiso('presupuestos', { accion: 'crear' })
  const searchParams = useSearchParams()
  const contactoId = searchParams.get('contacto_id') || undefined
  const actividadOrigenId = searchParams.get('actividad_origen_id') || undefined

  if (bloqueado) return null

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
