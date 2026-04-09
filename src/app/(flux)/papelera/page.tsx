import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { SkeletonLista } from '@/componentes/feedback/SkeletonTabla'
import ContenidoPapelera, { type ElementoPapelera } from './_componentes/ContenidoPapelera'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de papelera — /papelera (Server Component)
 * Hace el fetch inicial en el servidor para renderizar instantáneamente.
 * El Client Component toma el control para interactividad y refetch.
 */

export default function PaginaPapelera() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-full gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-32 bg-superficie-hover rounded animate-pulse" />
        </div>
        <SkeletonLista filas={6} />
      </div>
    }>
      <PapeleraConDatos />
    </Suspense>
  )
}

async function PapeleraConDatos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()

  // Fetch de las 4 entidades en paralelo — server-side, sin roundtrip al navegador
  const [contactosRes, presupuestosRes, actividadesRes, productosRes] = await Promise.all([
    admin
      .from('contactos')
      .select('id, nombre, apellido, correo, telefono, codigo, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('presupuestos')
      .select('id, titulo, codigo, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('actividades')
      .select('id, titulo, asunto, tipo, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('productos')
      .select('id, nombre, codigo, sku, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
  ])

  // Mapear a formato unificado
  const resultados: ElementoPapelera[] = []

  for (const c of (contactosRes.data || [])) {
    resultados.push({
      id: c.id,
      nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      tipo: 'contactos',
      eliminado_en: c.papelera_en || c.actualizado_en,
      eliminado_por: c.editado_por,
      eliminado_por_nombre: null,
      subtitulo: c.correo || c.telefono || c.codigo,
    })
  }

  for (const p of (presupuestosRes.data || [])) {
    resultados.push({
      id: p.id,
      nombre: p.titulo || p.codigo || 'Sin título',
      tipo: 'presupuestos',
      eliminado_en: p.papelera_en || p.actualizado_en,
      eliminado_por: p.editado_por,
      eliminado_por_nombre: null,
      subtitulo: p.codigo,
    })
  }

  for (const a of (actividadesRes.data || [])) {
    resultados.push({
      id: a.id,
      nombre: a.titulo || a.asunto || 'Sin título',
      tipo: 'actividades',
      eliminado_en: a.papelera_en || a.actualizado_en,
      eliminado_por: a.editado_por,
      eliminado_por_nombre: null,
      subtitulo: a.tipo,
    })
  }

  for (const p of (productosRes.data || [])) {
    resultados.push({
      id: p.id,
      nombre: p.nombre || 'Sin nombre',
      tipo: 'productos',
      eliminado_en: p.papelera_en || p.actualizado_en,
      eliminado_por: p.editado_por,
      eliminado_por_nombre: null,
      subtitulo: p.codigo || p.sku,
    })
  }

  // Ordenar por fecha de eliminación (más reciente primero)
  resultados.sort((a, b) => new Date(b.eliminado_en).getTime() - new Date(a.eliminado_en).getTime())

  // Pre-popular el cache de React Query con los datos del servidor
  // La queryKey ['papelera'] coincide con la que usa ContenidoPapelera en useQuery
  const queryClient = crearQueryClient()
  queryClient.setQueryData(['papelera'], resultados)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoPapelera datosIniciales={resultados} />
    </HydrationBoundary>
  )
}
