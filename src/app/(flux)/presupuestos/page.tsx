import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'
import ContenidoPresupuestos from './_componentes/ContenidoPresupuestos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de presupuestos — /presupuestos (Server Component)
 * Hace el fetch inicial en el servidor para que la tabla se renderice instantáneamente.
 * El Client Component toma el control para filtros, paginación y acciones.
 */

const POR_PAGINA = 50

export default function PaginaPresupuestos() {
  return (
    <Suspense fallback={<SkeletonTabla filas={10} columnas={7} />}>
      <PresupuestosConDatos />
    </Suspense>
  )
}

async function PresupuestosConDatos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  // Verificar permisos de visibilidad
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
  if (!visibilidad) return <ContenidoPresupuestos />

  const admin = crearClienteAdmin()

  let query = admin
    .from('presupuestos')
    .select(`
      id, numero, estado, referencia,
      contacto_id, contacto_nombre, contacto_apellido, contacto_tipo,
      contacto_correo, contacto_telefono, contacto_identificacion,
      contacto_condicion_iva, contacto_direccion,
      atencion_contacto_id, atencion_nombre, atencion_correo, atencion_cargo,
      moneda, condicion_pago_label,
      fecha_emision, fecha_vencimiento, dias_vencimiento,
      subtotal_neto, total_impuestos, descuento_global, total_final,
      origen_documento_numero,
      creado_por, creado_por_nombre, creado_en, actualizado_en
    `, { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)

  if (visibilidad.soloPropio) {
    query = query.eq('creado_por', user.id)
  }

  const { data, count } = await query
    .order('numero', { ascending: false })
    .range(0, POR_PAGINA - 1)

  // Construir el JSON con la misma forma que devuelve la API
  const datosInicialesJson = {
    presupuestos: data || [],
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  // Pre-popular el cache de React Query con los datos del servidor
  // La queryKey coincide con la que genera useListado: ['presupuestos', paramsLimpios]
  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['presupuestos', { pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoPresupuestos datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
