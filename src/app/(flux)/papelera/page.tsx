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

  const [contactosRes, presupuestosRes, actividadesRes, productosRes, visitasRes, notasRes, conversacionesRes, eventosRes, recorridosRes] = await Promise.all([
    admin
      .from('contactos')
      .select('id, nombre, apellido, correo, telefono, codigo, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('presupuestos')
      .select('id, numero, contacto_nombre, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('actividades')
      .select('id, titulo, tipo_clave, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('productos')
      .select('id, nombre, codigo, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('visitas')
      .select('id, motivo, contacto_nombre, estado, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('notas_rapidas')
      .select('id, titulo, contenido, creador_id, papelera_en, actualizado_en, actualizado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('conversaciones')
      .select('id, contacto_nombre, asunto, tipo_canal, papelera_en, actualizado_en')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('eventos_calendario')
      .select('id, titulo, fecha_inicio, tipo_clave, papelera_en, actualizado_en, editado_por')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', true),
    admin
      .from('recorridos')
      .select('id, asignado_nombre, fecha, estado, papelera_en, actualizado_en, creado_por')
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
  // Las conversaciones no registran quién las mandó a papelera (no hay columna).
  recolectarIds(eventosRes.data, 'editado_por')
  recolectarIds(recorridosRes.data, 'creado_por')

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
      nombre: p.numero || 'Sin número',
      tipo: 'presupuestos',
      eliminado_en: p.papelera_en || p.actualizado_en,
      eliminado_por: p.editado_por,
      eliminado_por_nombre: nombresUsuarios[p.editado_por] || null,
      subtitulo: p.contacto_nombre || undefined,
    })
  }

  for (const a of (actividadesRes.data || [])) {
    resultados.push({
      id: a.id,
      nombre: a.titulo || 'Sin título',
      tipo: 'actividades',
      eliminado_en: a.papelera_en || a.actualizado_en,
      eliminado_por: a.editado_por,
      eliminado_por_nombre: nombresUsuarios[a.editado_por] || null,
      subtitulo: a.tipo_clave || undefined,
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
      subtitulo: p.codigo || undefined,
    })
  }

  for (const v of (visitasRes.data || [])) {
    resultados.push({
      id: v.id,
      nombre: v.contacto_nombre || v.motivo || 'Sin título',
      tipo: 'visitas',
      eliminado_en: v.papelera_en || v.actualizado_en,
      eliminado_por: v.editado_por,
      eliminado_por_nombre: nombresUsuarios[v.editado_por] || null,
      subtitulo: v.estado,
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

  for (const c of (conversacionesRes.data || [])) {
    const canal = c.tipo_canal === 'whatsapp' ? 'WhatsApp' : c.tipo_canal === 'correo' ? 'Correo' : 'Chat'
    resultados.push({
      id: c.id,
      nombre: c.contacto_nombre || c.asunto || 'Sin nombre',
      tipo: 'conversaciones',
      eliminado_en: c.papelera_en || c.actualizado_en,
      eliminado_por: null,
      eliminado_por_nombre: null,
      subtitulo: canal,
    })
  }

  for (const e of (eventosRes.data || [])) {
    resultados.push({
      id: e.id,
      nombre: e.titulo || 'Sin título',
      tipo: 'eventos',
      eliminado_en: e.papelera_en || e.actualizado_en,
      eliminado_por: e.editado_por,
      eliminado_por_nombre: nombresUsuarios[e.editado_por] || null,
      subtitulo: e.tipo_clave || undefined,
    })
  }

  for (const r of (recorridosRes.data || [])) {
    resultados.push({
      id: r.id,
      nombre: `Recorrido ${r.fecha}`,
      tipo: 'recorridos',
      eliminado_en: r.papelera_en || r.actualizado_en,
      eliminado_por: r.creado_por,
      eliminado_por_nombre: nombresUsuarios[r.creado_por] || null,
      subtitulo: r.asignado_nombre,
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
