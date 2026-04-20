import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoAsistencias from './_componentes/ContenidoAsistencias'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'
import { resolverNombresMiembros } from '@/lib/miembros/nombres'

const POR_PAGINA = 50

export default async function PaginaAsistencias() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'asistencias')
  if (!visibilidad) return <ContenidoAsistencias />

  const admin = crearClienteAdmin()

  const miembroNombres = await resolverNombresMiembros(admin, empresaId)

  const { data, count } = await admin
    .from('asistencias')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false })
    .order('hora_entrada', { ascending: false })
    .range(0, POR_PAGINA - 1)

  const registros = (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    miembro_nombre: miembroNombres.get(r.miembro_id) || 'Sin nombre',
    creador_nombre: r.creado_por ? (miembroNombres.get(r.creado_por) || null) : null,
    editor_nombre: r.editado_por ? (miembroNombres.get(r.editado_por) || null) : null,
  }))

  const datosInicialesJson = {
    registros,
    total: count || 0,
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['asistencias', { pagina: '1', limite: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoAsistencias datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
