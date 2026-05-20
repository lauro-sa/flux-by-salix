import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import PaginaDetallePresupuestoCliente from './_pagina-cliente'

/**
 * Página de detalle de presupuesto — /presupuestos/[id]
 *
 * Server Component que hace un fetch rápido del `numero` (P-0042, etc.)
 * para alimentar el `nombre` del fallback de carga del editor. Mientras
 * la query corre, Next mantiene visible la página anterior; al resolverse
 * pasamos al cliente con el número ya conocido, así el cargador del editor
 * arranca con el ícono dibujándose + nombre real del documento.
 */
export default async function PaginaDetallePresupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Resolver el número solo si es un id real (modo "editar"). En "nuevo"
  // todavía no existe en BD y el cliente lo genera de forma optimista.
  let numeroInicial: string | null = null
  if (id !== 'nuevo') {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
    if (!empresaId) redirect('/login')

    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('presupuestos')
      .select('numero')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    numeroInicial = (data?.numero as string | undefined) ?? null
  }

  return <PaginaDetallePresupuestoCliente id={id} numeroInicial={numeroInicial} />
}
