import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import PaginaPerfilUsuario from './_pagina-cliente'

/**
 * Página de detalle de usuario — /usuarios/[id]
 *
 * Server Component que precarga el nombre completo del miembro (sea de
 * `perfiles` cuando tiene cuenta Flux, o del contacto tipo equipo vinculado
 * cuando es un empleado sin cuenta). Ese nombre alimenta el `CargaIcono`
 * del cliente para que el cargador muestre "Lauro Salazar" + ícono de
 * usuario dibujándose en lugar de un placeholder genérico.
 */
export default async function PaginaUsuarioDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()

  // Dos queries en paralelo: el miembro (para saber si tiene cuenta) y el
  // contacto vinculado por `miembro_id` (fallback cuando no hay perfil).
  const [{ data: miembro }, { data: contacto }] = await Promise.all([
    admin.from('miembros').select('usuario_id').eq('id', id).eq('empresa_id', empresaId).maybeSingle(),
    admin.from('contactos').select('nombre, apellido').eq('miembro_id', id).eq('empresa_id', empresaId).maybeSingle(),
  ])

  let nombreInicial: string | null = null
  if (miembro?.usuario_id) {
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', miembro.usuario_id as string)
      .maybeSingle()
    if (perfil) {
      nombreInicial = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ').trim() || null
    }
  }
  if (!nombreInicial && contacto) {
    nombreInicial = [contacto.nombre, contacto.apellido].filter(Boolean).join(' ').trim() || null
  }

  return <PaginaPerfilUsuario miembroId={id} nombreInicial={nombreInicial} />
}
