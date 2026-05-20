import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import PaginaOrdenDetalleCliente from './_pagina-cliente'

/**
 * Página de detalle de una orden de trabajo — /ordenes/[id]
 *
 * Server Component: hace un fetch rápido del `numero` de la OT para que el
 * cargador del cliente arranque mostrando ya el nombre real del documento
 * debajo del ícono dibujándose.
 */
export default async function PaginaOrdenDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()
  const { data } = await admin
    .from('ordenes_trabajo')
    .select('numero')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  const numeroInicial = (data?.numero as string | undefined) ?? null

  return <PaginaOrdenDetalleCliente id={id} numeroInicial={numeroInicial} />
}
