import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'
import ContenidoActividades from './_componentes/ContenidoActividades'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'

/**
 * Página de actividades — /actividades (Server Component)
 * Hace el fetch inicial en el servidor para que la tabla se renderice instantáneamente.
 * El Client Component toma el control para filtros, paginación y acciones.
 */

const POR_PAGINA = 50

export default function PaginaActividades() {
  return (
    <Suspense fallback={<SkeletonTabla filas={10} columnas={7} />}>
      <ActividadesConDatos />
    </Suspense>
  )
}

async function ActividadesConDatos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  // Verificar permisos de visibilidad
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'actividades')
  if (!visibilidad) return <ContenidoActividades />

  const admin = crearClienteAdmin()

  // Query base: mismos filtros default que el Client Component
  // (estado: pendiente+vencida, vista: mías = asignado_a = user.id)
  let query = admin
    .from('actividades')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .in('estado_clave', ['pendiente', 'vencida'])
    .eq('asignado_a', user.id)

  // Si solo tiene ver_propio, forzar filtro por creador o asignado a él
  if (visibilidad.soloPropio) {
    query = query.or(`creado_por.eq.${user.id},asignado_a.eq.${user.id}`)
  }

  // Ordenamiento por defecto: fecha_vencimiento asc + prioridad + creado_en
  const { data, count } = await query
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('prioridad', { ascending: true })
    .order('creado_en', { ascending: true })
    .range(0, POR_PAGINA - 1)

  // Construir el JSON con la misma forma que devuelve la API
  const datosInicialesJson = {
    actividades: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  return <ContenidoActividades datosInicialesJson={datosInicialesJson} />
}
