import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoPresupuestos from './_componentes/ContenidoPresupuestos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'
import { enriquecerListadoPresupuestos } from '@/lib/presupuestos/enriquecer-listado'

/**
 * Página de presupuestos — /presupuestos (Server Component).
 * Ver nota de carga en /contactos/page.tsx — la BarraProgresoGlobal da el
 * feedback visual durante la navegación, la página anterior persiste.
 */

const POR_PAGINA = 50

export default function PaginaPresupuestos() {
  return <ContenidoServidor />
}

async function ContenidoServidor() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

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
    `, { count: 'estimated' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)

  if (visibilidad.soloPropio) {
    query = query.eq('creado_por', user.id)
  }

  const { data, count } = await query
    .order('numero', { ascending: false })
    .range(0, POR_PAGINA - 1)

  // Enriquecer con resumen_pagos / actividades / OT / contactos vivos antes
  // de hidratar — sin esto la columna "Pagos" aparece vacía hasta el primer
  // refetch del cliente (mismo helper que usa /api/presupuestos GET).
  const presupuestos = await enriquecerListadoPresupuestos(admin, empresaId, data || [])

  const datosInicialesJson = {
    presupuestos,
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

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
