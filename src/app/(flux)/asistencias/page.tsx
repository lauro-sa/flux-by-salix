import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'
import ContenidoAsistencias from './_componentes/ContenidoAsistencias'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de asistencias — /asistencias (Server Component)
 * Hace el fetch inicial en el servidor para que la tabla se renderice instantáneamente.
 * El Client Component (ContenidoAsistencias) toma el control para filtros, paginación y acciones.
 */

const POR_PAGINA = 50

export default function PaginaAsistencias() {
  return (
    <Suspense fallback={<SkeletonTabla filas={10} columnas={7} />}>
      <AsistenciasConDatos />
    </Suspense>
  )
}

async function AsistenciasConDatos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  // Verificar permisos de visibilidad
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'asistencias')
  if (!visibilidad) return <ContenidoAsistencias />

  const admin = crearClienteAdmin()

  // Obtener miembros con nombres para mapear después (misma lógica que la API)
  const { data: miembrosData } = await admin
    .from('miembros')
    .select('id, usuario_id')
    .eq('empresa_id', empresaId)

  const { data: perfilesData } = await admin
    .from('perfiles')
    .select('id, nombre, apellido')

  // Mapeo miembro_id → nombre completo
  const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))
  const miembroNombres = new Map((miembrosData || []).map((m: Record<string, unknown>) => {
    const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
    return [m.id, perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sin nombre']
  }))

  // Query principal de asistencias
  const { data, count } = await admin
    .from('asistencias')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false })
    .order('hora_entrada', { ascending: false })
    .range(0, POR_PAGINA - 1)

  // Enriquecer registros con nombres (misma transformación que la API)
  const registros = (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    miembro_nombre: miembroNombres.get(r.miembro_id) || 'Sin nombre',
    creador_nombre: r.creado_por ? (miembroNombres.get(r.creado_por) || null) : null,
    editor_nombre: r.editado_por ? (miembroNombres.get(r.editado_por) || null) : null,
  }))

  // Construir el JSON con la misma forma que devuelve la API
  const datosInicialesJson = {
    registros,
    total: count || 0,
  }

  // Pre-popular el cache de React Query con los datos del servidor
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
