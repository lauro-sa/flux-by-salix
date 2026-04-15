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

  const [contactosRes, presupuestosRes, actividadesRes, productosRes, visitasRes, notasRes] = await Promise.all([
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
    admin
      .from('visitas')
      .select('id, titulo, contacto_nombre, estado, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('notas_rapidas')
      .select('id, titulo, contenido, creador_id, papelera_en, actualizado_en, actualizado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
  ])

  // Resolver nombres de quienes eliminaron
  const idsUsuarios = new Set<string>()
  const recolectarIds = (items: Record<string, unknown>[] | null, campo: string) => {
    for (const item of (items || [])) { if (item[campo]) idsUsuarios.add(item[campo] as string) }
  }
  recolectarIds(contactosRes.data, 'editado_por')
  recolectarIds(presupuestosRes.data, 'editado_por')
  recolectarIds(actividadesRes.data, 'editado_por')
  recolectarIds(productosRes.data, 'editado_por')
  recolectarIds(visitasRes.data, 'editado_por')
  recolectarIds(notasRes.data, 'actualizado_por')

  const nombresUsuarios: Record<string, string> = {}
  if (idsUsuarios.size > 0) {
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', Array.from(idsUsuarios))
    for (const p of (perfiles || [])) {
      nombresUsuarios[p.id] = [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Usuario'
    }
  }

  const resultados: ElementoPapelera[] = []

  for (const c of (contactosRes.data || [])) {
    resultados.push({
      id: c.id,
      nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      tipo: 'contactos',
      eliminado_en: c.papelera_en || c.actualizado_en,
      eliminado_por: c.editado_por,
      eliminado_por_nombre: nombresUsuarios[c.editado_por] || null,
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
      eliminado_por_nombre: nombresUsuarios[p.editado_por] || null,
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
      eliminado_por_nombre: nombresUsuarios[a.editado_por] || null,
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
      eliminado_por_nombre: nombresUsuarios[p.editado_por] || null,
      subtitulo: p.codigo || p.sku,
    })
  }

  for (const v of (visitasRes.data || [])) {
    resultados.push({
      id: v.id,
      nombre: v.titulo || 'Sin título',
      tipo: 'visitas',
      eliminado_en: v.papelera_en || v.actualizado_en,
      eliminado_por: v.editado_por,
      eliminado_por_nombre: nombresUsuarios[v.editado_por] || null,
      subtitulo: v.contacto_nombre || v.estado,
    })
  }

  for (const n of (notasRes.data || [])) {
    const uid = n.actualizado_por || n.creador_id
    const preview = n.contenido ? n.contenido.slice(0, 60) : ''
    resultados.push({
      id: n.id,
      nombre: n.titulo || preview || 'Sin título',
      tipo: 'notas',
      eliminado_en: n.papelera_en || n.actualizado_en,
      eliminado_por: uid,
      eliminado_por_nombre: nombresUsuarios[uid] || null,
      subtitulo: n.titulo ? preview : undefined,
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
