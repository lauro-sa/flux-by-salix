/**
 * /api/miembros/[id]/info-bancaria/[cuenta_id]
 *
 * PATCH  → modifica una cuenta. Acepta cualquier subset de campos
 *          editables. Registra cada cambio en `auditoria_info_bancaria`.
 *
 * DELETE → soft-delete (eliminada=true). La fila se preserva para
 *          que los pagos históricos sigan resolviéndose. No hay
 *          DELETE duro: si hace falta limpiar, se hace por separado.
 *
 * Permisos: igual que la ruta padre — el dueño o `nomina:editar`/
 * `usuarios:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

interface Auth { userId: string; empresaId: string }

async function verificarAuth(): Promise<Auth | null> {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return null
  const empresaId = user.app_metadata?.empresa_activa_id as string | undefined
  if (!empresaId) return null
  return { userId: user.id, empresaId }
}

async function autorizarAccesoMiembro(auth: Auth, miembroId: string) {
  const admin = crearClienteAdmin()
  const { data: miembroDest } = await admin
    .from('miembros')
    .select('id, usuario_id')
    .eq('id', miembroId)
    .eq('empresa_id', auth.empresaId)
    .maybeSingle()
  if (!miembroDest) return { permitido: false, miembroEmpresaOk: false }
  if (miembroDest.usuario_id === auth.userId) return { permitido: true, miembroEmpresaOk: true }
  const datosActor = await obtenerDatosMiembro(auth.userId, auth.empresaId)
  if (!datosActor) return { permitido: false, miembroEmpresaOk: true }
  const ok =
    verificarPermiso(datosActor, 'nomina', 'editar') ||
    verificarPermiso(datosActor, 'usuarios', 'editar')
  return { permitido: ok, miembroEmpresaOk: true }
}

/** Campos que el PATCH puede modificar. El resto está bloqueado. */
const CAMPOS_EDITABLES = [
  'tipo_pago',
  'tipo_cuenta',
  'entidad_id',
  'banco',
  'numero_cuenta',
  'alias',
  'etiqueta',
  'titular_nombre',
  'titular_documento',
  'activa',
  'predeterminada',
] as const
type CampoEditable = (typeof CAMPOS_EDITABLES)[number]

// ════════════════════════════════════════════════════════════════
// PATCH
// ════════════════════════════════════════════════════════════════

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cuenta_id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: miembroId, cuenta_id: cuentaId } = await params

  const { permitido, miembroEmpresaOk } = await autorizarAccesoMiembro(auth, miembroId)
  if (!miembroEmpresaOk) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: Partial<Record<CampoEditable, unknown>>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const admin = crearClienteAdmin()

  // Estado actual para auditar el delta.
  const { data: actual } = await admin
    .from('info_bancaria')
    .select('*')
    .eq('id', cuentaId)
    .eq('empresa_id', auth.empresaId)
    .eq('miembro_id', miembroId)
    .eq('eliminada', false)
    .maybeSingle()

  if (!actual) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  // Construir el set de cambios respetando la whitelist.
  const cambios: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) cambios[campo] = body[campo]
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ cuenta: actual })
  }

  // Validar tipo_pago si vino en el body.
  if ('tipo_pago' in cambios && cambios.tipo_pago !== 'banco' && cambios.tipo_pago !== 'digital') {
    return NextResponse.json({ error: "tipo_pago debe ser 'banco' o 'digital'" }, { status: 400 })
  }

  // Si se está marcando como predeterminada, desmarcar primero
  // cualquier otra del mismo miembro para no chocar contra el UNIQUE
  // parcial `info_bancaria_predeterminada_idx`.
  if (cambios.predeterminada === true && !(actual as Record<string, unknown>).predeterminada) {
    await admin
      .from('info_bancaria')
      .update({ predeterminada: false, actualizado_por: auth.userId })
      .eq('empresa_id', auth.empresaId)
      .eq('miembro_id', miembroId)
      .eq('eliminada', false)
      .eq('predeterminada', true)
      .neq('id', cuentaId)
  }

  // Si se está desactivando la predeterminada, también desmarcamos
  // `predeterminada` — no tiene sentido que sea default si no puede
  // seleccionarse en pagos.
  if (cambios.activa === false && (actual as Record<string, unknown>).predeterminada) {
    cambios.predeterminada = false
  }

  cambios.actualizado_por = auth.userId

  const { data: actualizada, error } = await admin
    .from('info_bancaria')
    .update(cambios)
    .eq('id', cuentaId)
    .select()
    .single()

  if (error || !actualizada) {
    console.error('[info-bancaria] PATCH error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar la cuenta' }, { status: 500 })
  }

  // Auditoría: una entrada por campo cambiado.
  const entradas: Array<Record<string, unknown>> = []
  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in cambios)) continue
    const antes = (actual as Record<string, unknown>)[campo]
    const despues = cambios[campo]
    if (antes === despues) continue
    // Acción especial: activar/desactivar se distinguen del editar
    // genérico para que la timeline las lea más natural.
    const accion =
      campo === 'activa'
        ? (despues ? 'activar' : 'desactivar')
        : 'editar'
    entradas.push({
      empresa_id: auth.empresaId,
      info_bancaria_id: cuentaId,
      miembro_id: miembroId,
      editado_por: auth.userId,
      accion,
      campo_modificado: campo,
      valor_anterior: antes === null || antes === undefined ? null : String(antes),
      valor_nuevo: despues === null || despues === undefined ? null : String(despues),
    })
  }
  if (entradas.length > 0) {
    await admin.from('auditoria_info_bancaria').insert(entradas)
  }

  return NextResponse.json({ cuenta: actualizada })
}

// ════════════════════════════════════════════════════════════════
// DELETE — soft delete
// ════════════════════════════════════════════════════════════════

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; cuenta_id: string }> }) {
  const auth = await verificarAuth()
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id: miembroId, cuenta_id: cuentaId } = await params

  const { permitido, miembroEmpresaOk } = await autorizarAccesoMiembro(auth, miembroId)
  if (!miembroEmpresaOk) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()
  const { data: actualizada, error } = await admin
    .from('info_bancaria')
    .update({ eliminada: true, activa: false, predeterminada: false, actualizado_por: auth.userId })
    .eq('id', cuentaId)
    .eq('empresa_id', auth.empresaId)
    .eq('miembro_id', miembroId)
    .eq('eliminada', false)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[info-bancaria] DELETE error:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta' }, { status: 500 })
  }
  if (!actualizada) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  // Si esta era la predeterminada, intentar promover otra activa del
  // mismo miembro para que el modal de pago siga teniendo preselección.
  // Si no hay otra activa, el miembro queda sin predeterminada hasta
  // que el operador marque manualmente.
  if ((actualizada as Record<string, unknown>).predeterminada === false) {
    // (acabamos de ponerla en false, pero quizá ya lo estaba antes —
    // no importa: en cualquier caso queremos asegurarnos de que haya
    // una predeterminada si hay candidatas)
    const { data: candidata } = await admin
      .from('info_bancaria')
      .select('id')
      .eq('empresa_id', auth.empresaId)
      .eq('miembro_id', miembroId)
      .eq('eliminada', false)
      .eq('activa', true)
      .eq('predeterminada', false)
      .order('actualizado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (candidata?.id) {
      const { count: yaHayPredet } = await admin
        .from('info_bancaria')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', auth.empresaId)
        .eq('miembro_id', miembroId)
        .eq('eliminada', false)
        .eq('predeterminada', true)
      if ((yaHayPredet ?? 0) === 0) {
        await admin
          .from('info_bancaria')
          .update({ predeterminada: true, actualizado_por: auth.userId })
          .eq('id', candidata.id)
      }
    }
  }

  await admin
    .from('auditoria_info_bancaria')
    .insert({
      empresa_id: auth.empresaId,
      info_bancaria_id: cuentaId,
      miembro_id: miembroId,
      editado_por: auth.userId,
      accion: 'eliminar',
    })

  return NextResponse.json({ ok: true })
}
