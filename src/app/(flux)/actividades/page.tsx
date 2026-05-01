import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoActividades from './_componentes/ContenidoActividades'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'
import { ordenarActividadesInteligente } from '@/lib/orden-actividades'
import { obtenerInicioFinDiaEnZona } from '@/lib/formato-fecha'

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

  // Default: ocultar completadas y canceladas (mismo criterio que la API).
  // Permisos: si el usuario solo puede ver lo propio, filtrar por creador/asignado.
  let query = admin
    .from('actividades')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .not('estado_clave', 'in', '(completada,cancelada)')

  if (visibilidad.soloPropio) {
    query = query.or(`creado_por.eq.${user.id},asignados_ids.cs.{${user.id}}`)
  }

  const { data, count } = await query
    .order('creado_en', { ascending: false })
    .range(0, POR_PAGINA - 1)

  // "Hoy" en zona de la empresa para que el grupo "Hoy" coincida con la API y con la UI.
  const { data: emp } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
  const zona = (emp?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
  const rango = obtenerInicioFinDiaEnZona(zona, new Date())
  const actividades = ordenarActividadesInteligente(
    data || [],
    new Date(rango.inicio),
    new Date(rango.fin),
  )

  const datosInicialesJson = {
    actividades,
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['actividades', { vista: 'todas', pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoActividades datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
