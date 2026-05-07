/**
 * GET /api/flujos/[id]/preview-contexto — devuelve el contexto enriquecido
 * para el `PickerVariables` del editor (sub-PR 19.3b, decisión §5.2).
 *
 * Reusa la misma lógica de enriquecimiento que el motor en runtime
 * (`enriquecerContexto` del PR 16). El endpoint:
 *   1. Auth + visibilidad sobre `flujos`.
 *   2. Carga el flujo por (id, empresa_id).
 *   3. 404 si cross-tenant o si el usuario tiene `ver_propio` sin
 *      ownership (patrón del 18.4b: nunca filtramos existencia con 403).
 *   4. Llama a `armarContextoPreview` que decide qué entidad cargar
 *      según el disparador, hace la query con admin, y enriquece.
 *
 * Caching: el cliente cachea el resultado durante toda la sesión de
 * edición; re-fetcha cuando cambia `disparador.tipo` (no en cada
 * keystroke de configuración interna). Caveat del coordinador
 * implementado en el lado cliente (`usePreviewContexto`).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { armarContextoPreview } from '@/lib/workflows/preview-contexto'

type ParamsPromise = Promise<{ id: string }>

export async function GET(_request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
  }

  // Visibilidad sobre `flujos` — `ver_todos` o `ver_propio`. Si
  // ninguna corresponde, 403. Si tiene `ver_propio`, validamos
  // ownership después de cargar el flujo.
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = crearClienteAdmin()
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, empresa_id, disparador, borrador_jsonb, creado_por')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  // 404 cross-tenant: no leakear existencia. El handler GET principal
  // de /api/flujos/[id] sigue el mismo criterio.
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }
  if (visibilidad.soloPropio && flujo.creado_por !== user.id) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  const contexto = await armarContextoPreview(
    {
      empresa_id: flujo.empresa_id as string,
      disparador: flujo.disparador,
      borrador_jsonb: flujo.borrador_jsonb,
    },
    admin,
  )

  return NextResponse.json({ contexto })
}
