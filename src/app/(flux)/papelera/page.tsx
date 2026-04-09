import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import ContenidoPapelera, { type ElementoPapelera } from './_componentes/ContenidoPapelera'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearQueryClient } from '@/lib/query'

export default async function PaginaPapelera() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()

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

  resultados.sort((a, b) => new Date(b.eliminado_en).getTime() - new Date(a.eliminado_en).getTime())

  const queryClient = crearQueryClient()
  queryClient.setQueryData(['papelera'], resultados)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContenidoPapelera datosIniciales={resultados} />
    </HydrationBoundary>
  )
}
