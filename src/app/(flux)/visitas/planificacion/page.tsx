import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import PanelPlanificacion from '../_componentes/PanelPlanificacion'

/**
 * Página de planificación de recorridos — /visitas/planificacion
 * Server Component que verifica permisos y renderiza el panel de planificación.
 */
export default async function PaginaPlanificacion() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar')
  if (!permitido) redirect('/visitas')

  return <PanelPlanificacion />
}
