/**
 * POST /api/flujos/[id]/pausar (PR 18.2)
 *
 * Transición 'activo' → 'pausado'. Solo válida desde 'activo'.
 *
 * Permiso: `activar`.
 *
 * Comportamiento sobre ejecuciones en curso (decisión B.2 del plan
 * de scope, opción A):
 *   - Las ejecuciones que ya arrancaron (pendiente / esperando /
 *     corriendo) NO se cancelan. Terminan naturalmente.
 *   - Las nuevas no se crean porque el dispatcher (Edge Function)
 *     filtra por `activo = true`, y `activo` es una generated column
 *     que sigue al `estado` (sql/056).
 *
 * Auditoría: 1 row con `campo_modificado='pausar'`,
 * `valor_anterior='activo'`, `valor_nuevo='pausado'`, `motivo`.
 *
 * Atomicidad: UPDATE simple con guarda `WHERE estado='activo'` para
 * que un doble click no inserte 2 rows de auditoría.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { evaluarTransicion } from '@/lib/workflows/transiciones-flujo'
import type { EstadoFlujo } from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

const MOTIVO_MAX_LEN = 500

export async function POST(request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'activar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let motivo: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body === 'object' && 'motivo' in body) {
      const m = (body as { motivo?: unknown }).motivo
      if (m === null || m === undefined) {
        motivo = null
      } else if (typeof m !== 'string' || m.length > MOTIVO_MAX_LEN) {
        return NextResponse.json(
          { error: `motivo debe ser string de hasta ${MOTIVO_MAX_LEN} chars` },
          { status: 400 },
        )
      } else {
        motivo = m.trim() || null
      }
    }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // 1) Cargar flujo.
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, estado, borrador_jsonb')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // 2) Evaluar transición. Rechaza desde borrador (con
  //    no_se_puede_pausar_borrador) y desde pausado (ya_pausado).
  const evalT = evaluarTransicion(
    flujo.estado as EstadoFlujo,
    flujo.borrador_jsonb !== null,
    'pausar',
  )
  if (!evalT.permitida) {
    return NextResponse.json(
      { error: evalT.error!.mensaje, codigo: evalT.error!.codigo },
      { status: 409 },
    )
  }

  // 3) Editor.
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const editadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  // 4) UPDATE con guarda atómica en el WHERE.
  const { data: filaUpd, error: errUpd } = await admin
    .from('flujos')
    .update({
      estado: 'pausado',
      editado_por: user.id,
      editado_por_nombre: editadoPorNombre,
    })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .eq('estado', 'activo')
    .select()
    .maybeSingle()

  if (errUpd) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_pausar',
      flujo_id: id,
      detalle: errUpd.message,
    }))
    return NextResponse.json({ error: 'Error al pausar el flujo' }, { status: 500 })
  }
  if (!filaUpd) {
    // Race: alguien lo pausó entre SELECT y UPDATE. Devolvemos el
    // estado actual con 409.
    const { data: actual } = await admin
      .from('flujos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
    return NextResponse.json(
      {
        error: 'El flujo ya está pausado o ya no está activo.',
        codigo: 'ya_pausado',
        flujo: actual ?? null,
      },
      { status: 409 },
    )
  }

  // 5) Auditoría.
  const { error: errAud } = await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: id,
    editado_por: user.id,
    campo_modificado: 'pausar',
    valor_anterior: 'activo',
    valor_nuevo: 'pausado',
    motivo,
  })
  if (errAud) {
    console.error(JSON.stringify({
      nivel: 'warn',
      mensaje: 'error_auditoria_pausar',
      flujo_id: id,
      detalle: errAud.message,
    }))
  }

  return NextResponse.json({ flujo: filaUpd })
}
