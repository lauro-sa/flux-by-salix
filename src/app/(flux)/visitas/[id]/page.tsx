import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarReciente } from '@/lib/recientes'
import type { AdjuntoChatter } from '@/tipos/chatter'
import DetalleVisita from './DetalleVisita'

/**
 * Página de detalle de visita — /visitas/[id] (Server Component)
 * Carga la visita + adjuntos registrados por el visitador (desde chatter de la visita).
 */

// Forzar render dinámico — siempre leer contactos/visitas actualizados (sin caché)
export const dynamic = 'force-dynamic'

// Título de la pestaña: "{nombre contacto} — Flux" cuando se identifica al contacto;
// caso contrario fallback genérico. Se calcula server-side para que aparezca antes
// de que React hidrate.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: 'Visita — Flux' }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return { title: 'Visita — Flux' }
  const admin = crearClienteAdmin()
  const { data: v } = await admin
    .from('visitas')
    .select('contacto_nombre, contacto_id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!v) return { title: 'Visita — Flux' }
  let nombre = v.contacto_nombre as string | null
  if (v.contacto_id) {
    const { data: c } = await admin
      .from('contactos')
      .select('nombre, apellido')
      .eq('id', v.contacto_id)
      .maybeSingle()
    if (c) {
      const actual = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
      if (actual) nombre = actual
    }
  }
  return { title: nombre ? `Visita — ${nombre} — Flux` : 'Visita — Flux' }
}

export default async function PaginaDetalleVisita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const admin = crearClienteAdmin()
  const { data: visita, error } = await admin
    .from('visitas')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .single()

  if (error || !visita) redirect('/visitas')

  // Traer el nombre ACTUAL del contacto (el snapshot en visita.contacto_nombre puede estar
  // desactualizado cuando renombran el contacto después de crear la visita — pasa seguido
  // con edificios/personas).
  if (visita.contacto_id) {
    const { data: contacto } = await admin
      .from('contactos')
      .select('nombre, apellido')
      .eq('id', visita.contacto_id)
      .maybeSingle()
    if (contacto) {
      const nombreActual = [contacto.nombre, contacto.apellido].filter(Boolean).join(' ').trim()
      if (nombreActual) visita.contacto_nombre = nombreActual
    }
  }

  // Traer la entrada de chatter de la visita para mostrar las fotos que subió el visitador
  const { data: chatterVisita } = await admin
    .from('chatter')
    .select('adjuntos')
    .eq('empresa_id', empresaId)
    .eq('entidad_tipo', 'visita')
    .eq('entidad_id', id)
    .eq('tipo', 'visita')
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  const adjuntos = (chatterVisita?.adjuntos as AdjuntoChatter[] | null) || []

  // Traer las visitas "hermanas" del mismo contacto para el paginador anterior/siguiente
  let hermanas: { id: string; fecha_programada: string; fecha_completada: string | null; estado: string }[] = []
  if (visita.contacto_id) {
    const { data } = await admin
      .from('visitas')
      .select('id, fecha_programada, fecha_completada, estado')
      .eq('empresa_id', empresaId)
      .eq('contacto_id', visita.contacto_id)
      .eq('en_papelera', false)
      .order('fecha_programada', { ascending: false })
      .limit(100)
    hermanas = data || []
  }

  // Registrar en recientes (fire-and-forget)
  registrarReciente({
    empresaId,
    usuarioId: user.id,
    tipoEntidad: 'visita',
    entidadId: id,
    titulo: visita.contacto_nombre || 'Visita',
    subtitulo: visita.estado || undefined,
    accion: 'visto',
  })

  return <DetalleVisita visita={visita} adjuntos={adjuntos} hermanas={hermanas} />
}
