import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarReciente } from '@/lib/recientes'
import DetalleVisita from './DetalleVisita'

/**
 * Página de detalle de visita — /visitas/[id] (Server Component)
 * Carga la visita y renderiza el componente client con PanelChatter.
 */

export default async function PaginaDetalleVisita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()
  const { data: visita, error } = await admin
    .from('visitas')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .single()

  if (error || !visita) redirect('/visitas')

  // Registrar en recientes (fire-and-forget)
  registrarReciente({
    empresaId,
    usuarioId: user.id,
    tipoEntidad: 'visita',
    entidadId: id,
    titulo: visita.contacto_nombre || 'Visita',
    subtitulo: visita.estado || undefined,
    accion: 'visto',
  })

  return <DetalleVisita visita={visita} />
}
