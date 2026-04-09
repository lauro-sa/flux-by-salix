import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoProductos from './_componentes/ContenidoProductos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

const POR_PAGINA = 50

export default async function PaginaProductos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'productos')
  if (!visibilidad) return <ContenidoProductos />

  const admin = crearClienteAdmin()

  const { data, count } = await admin
    .from('productos')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .eq('es_provisorio', false)
    .order('codigo', { ascending: false })
    .range(0, POR_PAGINA - 1)

  const datosInicialesJson = {
    productos: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['productos', { pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoProductos datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
