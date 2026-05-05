/**
 * POST /api/flujos/[id]/publicar (PR 18.2)
 *
 * Mueve `borrador_jsonb` → columnas publicadas (`disparador`,
 * `condiciones`, `acciones`, `nodos_json`) en una sola operación
 * atómica. NO toca `estado`: si el flujo era 'activo', sigue activo
 * con la versión nueva ejecutándose; si era 'pausado', sigue pausado;
 * si era 'borrador', sigue borrador (caso raro porque ese estado
 * edita in-place).
 *
 * Permiso: `editar` — publicar el borrador es completar la edición.
 *
 * Auditoría: 1 row con `campo_modificado='publicar'`. `valor_anterior`
 * snapshot del bloque publicado previo, `valor_nuevo` snapshot del
 * borrador recién publicado. Cubre el versionado implícito sin
 * columna nueva.
 *
 * Atomicidad (decisión B.4): el UPDATE corre dentro de la función
 * SQL `publicar_borrador_flujo` (sql/058) con guarda
 * `borrador_jsonb IS NOT NULL` en el WHERE. Si entre el SELECT y la
 * llamada otro endpoint descartó el borrador, el RETURNING vuelve
 * null y devolvemos 409 con el estado actual.
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

  const guard = await requerirPermisoAPI('flujos', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  // Body opcional: solo `motivo` para auditoría.
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

  // 1) Cargar flujo (necesitamos: estado, borrador_jsonb, snapshot publicado).
  const { data: flujo } = await admin
    .from('flujos')
    .select('id, estado, borrador_jsonb, disparador, condiciones, acciones, nodos_json')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!flujo) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // 2) Evaluar transición (rechaza con sin_borrador si no hay borrador_jsonb).
  const evalT = evaluarTransicion(
    flujo.estado as EstadoFlujo,
    flujo.borrador_jsonb !== null,
    'publicar',
  )
  if (!evalT.permitida) {
    return NextResponse.json(
      { error: evalT.error!.mensaje, codigo: evalT.error!.codigo },
      { status: 409 },
    )
  }

  // 3) Validar el contenido del borrador. Defensa en profundidad: la
  //    UI no debería dejar publicar un borrador roto, pero si lo hace
  //    igual lo bloqueamos acá.
  const borrador = flujo.borrador_jsonb as BorradorJsonb
  const validacion = validarPublicable(borrador.disparador, borrador.acciones)
  if (!validacion.ok) {
    return NextResponse.json(
      { error: 'El borrador tiene errores que impiden publicar.', errores: validacion.errores },
      { status: 422 },
    )
  }

  // 4) Snapshot del bloque publicado actual (lo que va a quedar en
  //    `valor_anterior` de la auditoría).
  const snapshotAnterior = {
    disparador: flujo.disparador,
    condiciones: flujo.condiciones,
    acciones: flujo.acciones,
    nodos_json: flujo.nodos_json,
  }

  // 5) Editor para denormalizar.
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const editadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  // 6) UPDATE atómico via función SQL. p_activar=false: no toca `estado`.
  const { data: filaActualizada, error: errRpc } = await admin
    .rpc('publicar_borrador_flujo', {
      p_flujo_id: id,
      p_empresa_id: empresaId,
      p_editado_por: user.id,
      p_editado_por_nombre: editadoPorNombre,
      p_activar: false,
    })

  if (errRpc) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_rpc_publicar_borrador',
      flujo_id: id,
      detalle: errRpc.message,
    }))
    return NextResponse.json({ error: 'Error al publicar borrador' }, { status: 500 })
  }
  // RPC devuelve null si la guarda `borrador_jsonb IS NOT NULL` falló
  // entre el SELECT y la llamada (otra petición lo descartó). Recargamos
  // y devolvemos 409 con el estado actual (no pisamos nada).
  if (!filaActualizada || (Array.isArray(filaActualizada) && filaActualizada.length === 0)) {
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
  // RPC con RETURNS public.flujos puede llegar como objeto o como
  // array de un solo elemento dependiendo de la versión del client.
  const flujoActualizado = Array.isArray(filaActualizada) ? filaActualizada[0] : filaActualizada

  // 7) Auditoría (1 row).
  const { error: errAud } = await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: id,
    editado_por: user.id,
    campo_modificado: 'publicar',
    valor_anterior: JSON.stringify(snapshotAnterior),
    valor_nuevo: JSON.stringify(borrador),
    motivo,
  })
  if (errAud) {
    console.error(JSON.stringify({
      nivel: 'warn',
      mensaje: 'error_auditoria_publicar',
      flujo_id: id,
      detalle: errAud.message,
    }))
  }

  return NextResponse.json({ flujo: flujoActualizado })
}
