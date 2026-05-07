/**
 * POST /api/flujos/[id]/activar (PR 18.2)
 *
 * Cubre dos transiciones:
 *   - 'borrador' → 'activo' (primera activación efectiva).
 *   - 'pausado'  → 'activo' (reanudar).
 *
 * Si la fila tiene `borrador_jsonb`, la activación PUBLICA
 * implícitamente ese borrador en el mismo UPDATE atómico (decisión
 * B.1 del plan de scope: el usuario aprieta "Activar" porque quiere
 * encender lo que está editando; pedirle Publicar manual primero
 * sería fricción sin beneficio).
 *
 * Permiso: `activar`.
 *
 * Validación: antes de cualquier UPDATE corremos `validarPublicable`
 * sobre la versión que vamos a encender. Si hay borrador, validamos
 * el borrador (es lo que va a quedar publicado); si no, validamos
 * la versión publicada actual.
 *
 * Auditoría:
 *   - Si publicó borrador: 1 row 'publicar' (snapshot anterior →
 *     borrador) + 1 row 'activar' (estado anterior → 'activo').
 *   - Si no había borrador: 1 row 'activar'.
 *
 * Atomicidad (decisión B.4): cuando hay borrador, usamos la función
 * SQL `publicar_borrador_flujo(..., p_activar=true)` (sql/058) que
 * concentra publicar + activar en un único UPDATE con guarda
 * `borrador_jsonb IS NOT NULL` en el WHERE. Cuando no hay borrador,
 * un UPDATE simple `SET estado='activo' WHERE estado <> 'activo'`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { evaluarTransicion } from '@/lib/workflows/transiciones-flujo'
import { validarPublicable } from '@/lib/workflows/validacion-flujo'
import type { EstadoFlujo } from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

const MOTIVO_MAX_LEN = 500

interface BorradorJsonb {
  disparador?: unknown
  condiciones?: unknown
  acciones?: unknown
  nodos_json?: unknown
}

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

  // 1) Cargar fila completa (necesitamos snapshot publicado para
  //    auditoría si hay que publicar borrador).
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, estado, borrador_jsonb, disparador, condiciones, acciones, nodos_json')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  const tieneBorrador = flujo.borrador_jsonb !== null
  const estadoActual = flujo.estado as EstadoFlujo

  // 2) Evaluar transición.
  const evalT = evaluarTransicion(estadoActual, tieneBorrador, 'activar')
  if (!evalT.permitida) {
    return NextResponse.json(
      { error: evalT.error!.mensaje, codigo: evalT.error!.codigo },
      { status: 409 },
    )
  }

  // 3) Validar lo que va a quedar como versión publicada/activa.
  //    Si hay borrador, ese es lo que se enciende; si no, la
  //    versión publicada actual.
  const aValidar = tieneBorrador
    ? (flujo.borrador_jsonb as BorradorJsonb)
    : { disparador: flujo.disparador, acciones: flujo.acciones }
  const validacion = validarPublicable(aValidar.disparador, aValidar.acciones)
  if (!validacion.ok) {
    return NextResponse.json(
      {
        error: tieneBorrador
          ? 'El borrador tiene errores que impiden activar.'
          : 'La versión publicada tiene errores que impiden activar.',
        errores: validacion.errores,
      },
      { status: 422 },
    )
  }

  // 4) Editor para denormalizar.
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const editadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  let flujoActualizado: unknown = null

  if (evalT.requierePublicar) {
    // 5a) Caso con borrador: publicar + activar en un solo UPDATE atómico.
    const snapshotAnterior = {
      disparador: flujo.disparador,
      condiciones: flujo.condiciones,
      acciones: flujo.acciones,
      nodos_json: flujo.nodos_json,
    }
    const borrador = flujo.borrador_jsonb

    const { data: filaRpc, error: errRpc } = await admin
      .rpc('publicar_borrador_flujo', {
        p_flujo_id: id,
        p_empresa_id: empresaId,
        p_editado_por: user.id,
        p_editado_por_nombre: editadoPorNombre,
        p_activar: true,
      })

    if (errRpc) {
      console.error(JSON.stringify({
        nivel: 'error',
        mensaje: 'error_rpc_publicar_y_activar',
        flujo_id: id,
        detalle: errRpc.message,
      }))
      return NextResponse.json({ error: 'Error al activar el flujo' }, { status: 500 })
    }
    if (!filaRpc || (Array.isArray(filaRpc) && filaRpc.length === 0)) {
      // Race: el borrador desapareció entre SELECT y RPC. Recargamos
      // y devolvemos estado actual.
      const { data: actual } = await admin
        .from('flujos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
      return NextResponse.json(
        {
          error: 'El borrador ya no existe (otra sesión lo descartó). Reintentá la operación.',
          codigo: 'sin_borrador',
          flujo: actual ?? null,
        },
        { status: 409 },
      )
    }
    flujoActualizado = Array.isArray(filaRpc) ? filaRpc[0] : filaRpc

    // Auditoría: 2 rows (publicar + activar).
    const { error: errAud } = await admin.from('auditoria_flujos').insert([
      {
        empresa_id: empresaId,
        flujo_id: id,
        editado_por: user.id,
        campo_modificado: 'publicar',
        valor_anterior: JSON.stringify(snapshotAnterior),
        valor_nuevo: JSON.stringify(borrador),
        motivo,
      },
      {
        empresa_id: empresaId,
        flujo_id: id,
        editado_por: user.id,
        campo_modificado: 'activar',
        valor_anterior: estadoActual,
        valor_nuevo: 'activo',
        motivo,
      },
    ])
    if (errAud) {
      console.error(JSON.stringify({
        nivel: 'warn',
        mensaje: 'error_auditoria_activar_con_publicar',
        flujo_id: id,
        detalle: errAud.message,
      }))
    }
  } else {
    // 5b) Caso sin borrador: UPDATE simple. El WHERE estado <> 'activo'
    //     vuelve a cubrir el doble click (si entre SELECT y UPDATE
    //     otro lo activó, no pisamos nada).
    const { data: filaUpd, error: errUpd } = await admin
      .from('flujos')
      .update({
        estado: 'activo',
        editado_por: user.id,
        editado_por_nombre: editadoPorNombre,
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .neq('estado', 'activo')
      .select()
      .maybeSingle()

    if (errUpd) {
      console.error(JSON.stringify({
        nivel: 'error',
        mensaje: 'error_activar_simple',
        flujo_id: id,
        detalle: errUpd.message,
      }))
      return NextResponse.json({ error: 'Error al activar el flujo' }, { status: 500 })
    }
    if (!filaUpd) {
      // Race: ya está activo. Devolver el estado actual (no es error real,
      // pero es 409 porque ya se sirvió la transición desde otra sesión).
      const { data: actual } = await admin
        .from('flujos').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
      return NextResponse.json(
        {
          error: 'El flujo ya está activo.',
          codigo: 'ya_activo',
          flujo: actual ?? null,
        },
        { status: 409 },
      )
    }
    flujoActualizado = filaUpd

    const { error: errAud } = await admin.from('auditoria_flujos').insert({
      empresa_id: empresaId,
      flujo_id: id,
      editado_por: user.id,
      campo_modificado: 'activar',
      valor_anterior: estadoActual,
      valor_nuevo: 'activo',
      motivo,
    })
    if (errAud) {
      console.error(JSON.stringify({
        nivel: 'warn',
        mensaje: 'error_auditoria_activar',
        flujo_id: id,
        detalle: errAud.message,
      }))
    }
  }

  return NextResponse.json({ flujo: flujoActualizado })
}
