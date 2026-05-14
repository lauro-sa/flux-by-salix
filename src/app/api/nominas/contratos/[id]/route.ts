/**
 * /api/nominas/contratos/[id]
 *
 * GET   → detalle de un contrato.
 * PATCH → edita SOLO campos administrativos (motivo, notas, pdf_url).
 *         Los cambios económicos (modalidad/monto/frecuencia/condicion/
 *         sector/turno) requieren un **contrato nuevo** vía POST a
 *         /api/nominas/contratos, por la inmutabilidad del histórico
 *         (el plan lo aclara: PR 5 / sección "API").
 *
 * Auth: GET con `nomina:ver_propio` o `nomina:ver_todos`; PATCH con
 * `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { ContratoLaboral } from '@/tipos/nominas'

interface Params {
  params: Promise<{ id: string }>
}

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('contratos_laborales')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[contratos:id] GET error:', error)
    return NextResponse.json({ error: 'Error al cargar contrato' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  // ver_propio: validar que el contrato es del miembro vinculado al usuario.
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== data.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este contrato' }, { status: 403 })
    }
  }

  return NextResponse.json({ contrato: data as ContratoLaboral })
}

// ════════════════════════════════════════════════════════════════
// PATCH (solo campos administrativos)
// ════════════════════════════════════════════════════════════════

interface PayloadPatch {
  motivo_cambio?: string | null
  notas?: string | null
  pdf_url?: string | null
}

const CAMPOS_PERMITIDOS: (keyof PayloadPatch)[] = ['motivo_cambio', 'notas', 'pdf_url']

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadPatch
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Whitelist: descartamos cualquier otro campo. Si alguien manda
  // `monto_base`, lo ignoramos silenciosamente — la regla de negocio
  // (cambios económicos = contrato nuevo) se enforza acá.
  const update: Record<string, unknown> = { actualizado_por: user.id }
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) update[campo] = body[campo]
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('contratos_laborales')
    .update(update)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[contratos:id] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  return NextResponse.json({ contrato: data as ContratoLaboral })
}
