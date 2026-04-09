import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoContactos from './_componentes/ContenidoContactos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearQueryClient } from '@/lib/query'

/**
 * Página de contactos — /contactos (Server Component)
 * Sin Suspense: Next.js mantiene la página anterior visible durante la navegación.
 */

const POR_PAGINA = 50

export default async function PaginaContactos() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'contactos')
  if (!visibilidad) return <ContenidoContactos />

  const admin = crearClienteAdmin()

  let query = admin
    .from('contactos')
    .select(`
      id, codigo, nombre, apellido, correo, telefono, whatsapp, cargo, rubro,
      activo, es_provisorio, origen, etiquetas, moneda, idioma,
      tipo_identificacion, numero_identificacion, datos_fiscales,
      limite_credito, plazo_pago_cliente, plazo_pago_proveedor,
      rank_cliente, rank_proveedor, pais_fiscal, zona_horaria,
      notas, web, titulo,
      creado_por, creado_en, actualizado_en,
      tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color),
      responsables:contacto_responsables(usuario_id),
      direcciones:contacto_direcciones(id, tipo, calle, numero, texto, ciudad, provincia, codigo_postal, es_principal),
      vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(puesto, vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(id, nombre, apellido, correo, telefono, whatsapp))
    `, { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)

  if (visibilidad.soloPropio) {
    query = query.eq('creado_por', user.id)
  }

  const { data, count } = await query
    .order('codigo', { ascending: false })
    .range(0, POR_PAGINA - 1)

  const contactosConEtapa = (data || []).map(c => ({ ...c, ultima_etapa: null }))

  const datosInicialesJson = {
    contactos: contactosConEtapa,
    total: count || 0,
    pagina: 1,
    por_pagina: POR_PAGINA,
    total_paginas: Math.ceil((count || 0) / POR_PAGINA),
  }

  const queryClient = crearQueryClient()
  queryClient.setQueryData(
    ['contactos', { pagina: '1', por_pagina: '50' }],
    datosInicialesJson
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoContactos datosInicialesJson={datosInicialesJson} />
    </HydrationBoundary>
  )
}
