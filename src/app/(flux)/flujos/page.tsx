import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoFlujos from './_componentes/ContenidoFlujos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de flujos — /flujos (Server Component).
 *
 * Listado central del módulo (PR 19.1). El editor visual de cada flujo
 * vive en /flujos/[id] (placeholder en este sub-PR, real en 19.2).
 *
 * Patrón de carga inicial idéntico a /contactos: el server hace la primera
 * query con visibilidad ya aplicada, hidrata React Query con los datos, y
 * el cliente hereda esa cache para render instantáneo. Después, cualquier
 * cambio de filtro dispara un fetch normal a /api/flujos.
 *
 * Multi-tenant: filtramos por empresa_id explícito en la query del SSR;
 * `visibilidad.soloPropio` agrega `creado_por` cuando el user solo tiene
 * `ver_propio`. RLS sobre la vista `flujos_con_estadisticas` (sql/059)
 * actúa como red de seguridad si alguien olvidara el filtro manual.
 */

const POR_PAGINA = 50

export default async function PaginaFlujos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  // Sin permiso → renderizamos igual el contenido. GuardPagina dentro de
  // ContenidoFlujos corta el render y muestra <SinPermiso>. Mantiene la
  // simetría con el resto de los listados de Flux.
  if (!visibilidad) return <ContenidoFlujos />

  const admin = crearClienteAdmin()

  let query = admin
    .from('flujos_con_estadisticas')
    .select(
      'id, empresa_id, nombre, descripcion, estado, activo, disparador, ' +
      'condiciones, acciones, borrador_jsonb, ultima_ejecucion_tiempo, ' +
      'icono, color, ' +
      'creado_por, creado_por_nombre, editado_por, editado_por_nombre, ' +
      'creado_en, actualizado_en, ultima_ejecucion_en, total_ejecuciones_30d',
      { count: 'exact' },
    )
    .eq('empresa_id', empresaId)

  if (visibilidad.soloPropio) {
    query = query.eq('creado_por', user.id)
  }

  const { data, count } = await query
    .order('actualizado_en', { ascending: false })
    .range(0, POR_PAGINA - 1)

  const datosInicialesJson = {
    flujos: data ?? [],
    total: count ?? 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['flujos', { pagina: '1', por_pagina: String(POR_PAGINA) }],
    datosInicialesJson,
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoFlujos datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
