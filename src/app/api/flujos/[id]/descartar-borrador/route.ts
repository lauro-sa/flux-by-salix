/**
 * POST /api/flujos/[id]/descartar-borrador (PR 18.2)
 *
 * Borra `borrador_jsonb` de la fila. La versión publicada queda
 * intacta. Pensado para "descarté lo que estaba editando".
 *
 * Permiso: `editar`.
 *
 * Auditoría: 1 row con `campo_modificado='descartar_borrador'`,
 * `valor_anterior` = el borrador descartado serializado,
 * `valor_nuevo` = null. Permite recuperar el contenido en caso de
 * que el usuario haya descartado por error (fuera de scope —
 * funcionalidad de "deshacer descarte" se ve si aparece la
 * necesidad).
 *
 * Atomicidad: simple `UPDATE ... SET borrador_jsonb=NULL WHERE id=X
 * AND borrador_jsonb IS NOT NULL`. La guarda en el WHERE evita
 * race con otro endpoint que ya lo haya descartado.
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

  const guard = await requerirPermisoAPI('flujos', 'editar')
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

  // 1) Cargar el flujo (404 si no existe).
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, estado, borrador_jsonb')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // 2) Evaluar transición (rechaza con sin_borrador si no hay).
  const evalT = evaluarTransicion(
    flujo.estado as EstadoFlujo,
    flujo.borrador_jsonb !== null,
    'descartar_borrador',
  )
  if (!evalT.permitida) {
    return NextResponse.json(
      { error: evalT.error!.mensaje, codigo: evalT.error!.codigo },
      { status: 409 },
    )
  }

  // 3) Snapshot del borrador descartado para auditoría.
  const borradorDescartado = flujo.borrador_jsonb

  // 4) Editor.
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const editadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  // 5) UPDATE con guarda en el WHERE para atomicidad.
  const { data: filaActualizada, error: errUpd } = await admin
    .from('flujos')
    .update({
      borrador_jsonb: null,
      editado_por: user.id,
      editado_por_nombre: editadoPorNombre,
    })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .not('borrador_jsonb', 'is', null)
    .select()
    .maybeSingle()

  if (errUpd) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_descartar_borrador',
      flujo_id: id,
      detalle: errUpd.message,
    }))
    return NextResponse.json({ error: 'Error al descartar borrador' }, { status: 500 })
  }
  if (!filaActualizada) {
    // Race: alguien lo descartó entre el SELECT y este UPDATE.
    const { data: actual } = await admin
      .from('flujos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
    return NextResponse.json(
      {
        error: 'El borrador ya no existe (otra sesión lo descartó).',
        codigo: 'sin_borrador',
        flujo: actual ?? null,
      },
      { status: 409 },
    )
  }

  // 6) Auditoría.
  const { error: errAud } = await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: id,
    editado_por: user.id,
    campo_modificado: 'descartar_borrador',
    valor_anterior: JSON.stringify(borradorDescartado),
    valor_nuevo: null,
    motivo,
  })
  if (errAud) {
    console.error(JSON.stringify({
      nivel: 'warn',
      mensaje: 'error_auditoria_descartar',
      flujo_id: id,
      detalle: errAud.message,
    }))
  }

  return NextResponse.json({ flujo: filaActualizada })
}
