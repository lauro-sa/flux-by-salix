import { notFound, redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  obtenerYVerificarPermiso,
  verificarVisibilidad,
} from '@/lib/permisos-servidor'
import EditorFlujo from './_componentes/EditorFlujo'
import type { FlujoEditable } from './_componentes/hooks/useEditorFlujo'

/**
 * /flujos/[id] — Editor visual del flujo (sub-PR 19.2).
 *
 * Server Component que hace fetch inicial de la fila + permisos
 * granulares, después hidrata el editor cliente con esos datos como
 * prop. Patrón consistente con `/flujos/page.tsx`: el SSR garantiza
 * que el primer paint ya tiene datos (no hay flash de loading) y la
 * UI cliente arranca en estado consistente.
 *
 * Permisos:
 *   • Sin `ver`     → redirect a /flujos.
 *   • Sin `editar`  → editor en modo solo lectura (banner gris).
 *   • Otros niveles los maneja el editor cliente.
 *
 * `visibilidad.soloPropio` (rol "ver_propio") fuerza que el usuario
 * solo vea sus flujos. Si no es creador del flujo solicitado, devuelve
 * 404 (mismo patrón que el GET /api/flujos/[id]).
 */
export default async function PaginaFlujoEditor({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await crearClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) redirect('/flujos')

  const admin = crearClienteAdmin()
  const { data: flujo } = await admin
    .from('flujos')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!flujo) notFound()
  if (visibilidad.soloPropio && flujo.creado_por !== user.id) notFound()

  const [
    { permitido: puedeEditar },
    { permitido: puedeEliminar },
    { permitido: puedeActivar },
  ] = await Promise.all([
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'editar'),
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'eliminar'),
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'activar'),
  ])

  const flujoInicial: FlujoEditable = {
    ...flujo,
    permisos: {
      editar: puedeEditar,
      eliminar: puedeEliminar,
      activar: puedeActivar,
    },
  }

  return <EditorFlujo flujoInicial={flujoInicial} />
}
