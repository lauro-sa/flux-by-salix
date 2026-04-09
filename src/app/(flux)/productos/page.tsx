import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { SkeletonListado } from '@/componentes/feedback/SkeletonTabla'
import ContenidoProductos from './_componentes/ContenidoProductos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Pagina de productos — /productos (Server Component)
 * Hace el fetch inicial en el servidor para que la tabla se renderice instantaneamente.
 * El Client Component toma el control para filtros, paginacion y acciones.
 */

const POR_PAGINA = 50

export default function PaginaProductos() {
  return (
    <Suspense fallback={<SkeletonListado filas={10} columnas={7} />}>
      <ProductosConDatos />
    </Suspense>
  )
}

async function ProductosConDatos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  // Verificar permisos de visibilidad
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

  // Construir el JSON con la misma forma que devuelve la API
  const datosInicialesJson = {
    productos: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  // Pre-popular el cache de React Query con los datos del servidor
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
