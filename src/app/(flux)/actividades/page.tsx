import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoActividades from './_componentes/ContenidoActividades'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de actividades — /actividades (Server Component)
 * Sin Suspense: Next.js mantiene la página anterior visible durante la navegación.
 */

const POR_PAGINA = 50

export default async function PaginaActividades() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'actividades')
  if (!visibilidad) return <ContenidoActividades />

  const admin = crearClienteAdmin()

  // Obtener estados del grupo 'activo' para filtrar por defecto (excluir completados y cancelados)
  const { data: estadosActivos } = await admin
    .from('estados_actividad')
    .select('clave')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .eq('grupo', 'activo')

  const clavesActivas = estadosActivos?.map(e => e.clave) || ['pendiente', 'vencida']

  let query = admin
    .from('actividades')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .in('estado_clave', clavesActivas)
    .or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)

  if (visibilidad.soloPropio) {
    query = query.or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
  }

  const { data, count } = await query
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('prioridad', { ascending: true })
    .order('creado_en', { ascending: true })
    .range(0, POR_PAGINA - 1)

  const datosInicialesJson = {
    actividades: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['actividades', { estado: clavesActivas.join(','), vista: 'propias', pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoActividades datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
