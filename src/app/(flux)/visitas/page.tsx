import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoVisitas from './_componentes/ContenidoVisitas'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de visitas — /visitas (Server Component)
 * Hidrata React Query con la primera página para renderizar sin loading.
 */

const POR_PAGINA = 50

export default async function PaginaVisitas() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'visitas')
  if (!visibilidad) return <ContenidoVisitas />

  const admin = crearClienteAdmin()

  // Estados por defecto: provisoria (pendiente confirmar) + activos (excluir completadas/canceladas)
  const estadosActivos = ['provisoria', 'programada', 'en_camino', 'en_sitio', 'reprogramada']

  // Vista por defecto: admins ven todas, usuarios con soloPropio ven propias
  const vistaDefault = visibilidad.soloPropio ? 'propias' : 'todas'

  let query = admin
    .from('visitas')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .in('estado', estadosActivos)

  // Solo filtrar por propiedad si el usuario tiene visibilidad restringida.
  // Las provisorias se incluyen siempre (trabajo pendiente de tomar por el equipo).
  if (visibilidad.soloPropio) {
    query = query.or(`creado_por.eq.${user.id},asignado_a.eq.${user.id},estado.eq.provisoria`)
  }

  const { data, count } = await query
    .order('fecha_programada', { ascending: false, nullsFirst: false })
    .order('prioridad', { ascending: true })
    .order('creado_en', { ascending: false })
    .range(0, POR_PAGINA - 1)

  const datosInicialesJson = {
    visitas: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['visitas', { estado: estadosActivos.join(','), vista: vistaDefault, pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoVisitas datosInicialesJson={datosInicialesJson} soloPropio={visibilidad.soloPropio} />
    </HydrationBoundary>
  )
}
