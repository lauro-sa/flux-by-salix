/**
 * GET /api/ejecuciones/[id] (PR 18.3)
 *
 * Detalle de una ejecución. Incluye:
 *   - La fila completa de ejecuciones_flujo
 *   - Datos denormalizados del flujo (nombre, estado actual)
 *   - Lista de acciones_pendientes asociadas (decisión B del plan:
 *     embedded en el detalle, no endpoint separado — la UI muestra
 *     el timeline con pendientes al lado)
 *   - Flags `permisos.{reejecutar, cancelar}` que la UI usa para
 *     habilitar/deshabilitar los botones del menú
 *
 * Auth: visibilidad heredada de `flujos`. 404 también para `ver_propio`
 * cuando el flujo no fue creado por el user (no filtramos existencia
 * con 403).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  obtenerYVerificarPermiso,
  verificarVisibilidad,
} from '@/lib/permisos-servidor'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import {
  puedeReejecutar,
  puedeCancelar,
} from '@/lib/workflows/transiciones-ejecucion'
import type { EstadoEjecucion } from '@/tipos/workflow'

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

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = crearClienteAdmin()

  // Cargamos ejecución + flujo asociado en una sola query.
  const { data: row } = await admin
    .from('ejecuciones_flujo')
    .select('*, flujos!inner(id, nombre, estado, creado_por)')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })
  }

  // Si el caller solo tiene `ver_propio`, exigimos que el flujo
  // pertenezca al user (no filtramos existencia con 403).
  // PostgREST puede devolver el sub-recurso como objeto o array.
  const flujosCrudo = (row as { flujos?: unknown }).flujos
  const flujo = (Array.isArray(flujosCrudo) ? flujosCrudo[0] : flujosCrudo) as
    | { id?: string; nombre?: string; estado?: string; creado_por?: string | null }
    | null
    | undefined
  if (visibilidad.soloPropio && flujo?.creado_por !== user.id) {
    return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })
  }

  // Acciones pendientes asociadas (cola diferida + diferidos). Vienen
  // ordenadas por ejecutar_en para que la UI renderice el timeline.
  const { data: pendientes } = await admin
    .from('acciones_pendientes')
    .select('id, tipo_accion, parametros, ejecutar_en, estado, resultado, intentos, creado_en, actualizado_en')
    .eq('ejecucion_id', id)
    .eq('empresa_id', empresaId)
    .order('ejecutar_en', { ascending: true })

  // Flags para la UI. Granular y barato (~2 queries cortas a miembros).
  const estado = (row as { estado: EstadoEjecucion }).estado
  const [{ permitido: permActivar }] = await Promise.all([
    obtenerYVerificarPermiso(user.id, empresaId, 'flujos', 'activar'),
  ])
  const flagReejecutar = permActivar && puedeReejecutar(estado).ok
  const flagCancelar = permActivar && puedeCancelar(estado).ok

  // Aplanar campos del flujo y entregar respuesta.
  const ejecucion = {
    ...row,
    flujo_nombre: flujo?.nombre ?? null,
    flujo_estado: flujo?.estado ?? null,
    acciones_pendientes: pendientes ?? [],
    permisos: {
      reejecutar: flagReejecutar,
      cancelar: flagCancelar,
    },
  }

  return NextResponse.json({ ejecucion })
}
