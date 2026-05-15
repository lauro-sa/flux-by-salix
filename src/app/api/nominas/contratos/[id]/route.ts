/**
 * /api/nominas/contratos/[id]
 *
 * GET   → detalle de un contrato.
 * PATCH → dos modos según el body:
 *         - `{ accion: 'terminar', fecha_fin, motivo_fin, nota_fin? }`:
 *           cierra el contrato (vigente=false + fecha_fin + motivo).
 *           El empleado deja de aparecer en Liquidaciones siguientes.
 *         - `{ motivo_cambio?, notas?, pdf_url? }`: edita SOLO campos
 *           administrativos. Los cambios económicos (modalidad/monto/
 *           frecuencia/condición/sector/turno) requieren un contrato
 *           NUEVO vía POST a /api/nominas/contratos.
 *
 * Auth: GET con `nomina:ver_propio` o `nomina:ver_todos`; PATCH con
 * `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { ContratoLaboral, MotivoFinContrato } from '@/tipos/nominas'

const MOTIVOS_VALIDOS: MotivoFinContrato[] = [
  'renuncia',
  'despido_con_causa',
  'despido_sin_causa',
  'fin_plazo',
  'mutuo_acuerdo',
  'abandono',
  'jubilacion',
  'fallecimiento',
  'cambio_condiciones',
  'renovacion',
  'otro',
]

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
// PATCH — dos modos: terminar o editar campos administrativos
// ════════════════════════════════════════════════════════════════

interface PayloadEditar {
  motivo_cambio?: string | null
  notas?: string | null
  pdf_url?: string | null
}

interface PayloadTerminar {
  accion: 'terminar'
  fecha_fin: string
  motivo_fin: MotivoFinContrato
  nota_fin?: string | null
}

type PayloadPatch = PayloadEditar | PayloadTerminar

const CAMPOS_EDITABLES: (keyof PayloadEditar)[] = ['motivo_cambio', 'notas', 'pdf_url']

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

  const admin = crearClienteAdmin()

  // ─── Modo terminar: cierra el contrato vigente ───
  if ('accion' in body && body.accion === 'terminar') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_fin ?? '')) {
      return NextResponse.json({ error: 'fecha_fin inválida (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!MOTIVOS_VALIDOS.includes(body.motivo_fin)) {
      return NextResponse.json({ error: 'motivo_fin inválido' }, { status: 400 })
    }
    if (body.motivo_fin === 'otro' && !body.nota_fin?.trim()) {
      return NextResponse.json({ error: 'Motivo "otro" requiere una nota.' }, { status: 400 })
    }

    // Cargar contrato para validar coherencia (no terminar uno ya cerrado,
    // fecha_fin no anterior al inicio).
    const { data: actual } = await admin
      .from('contratos_laborales')
      .select('id, fecha_inicio, fecha_fin, vigente')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .maybeSingle()

    if (!actual) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    if (!actual.vigente) {
      return NextResponse.json({ error: 'El contrato ya está cerrado.' }, { status: 409 })
    }
    if (body.fecha_fin < actual.fecha_inicio) {
      return NextResponse.json({
        error: `La fecha de baja no puede ser anterior al inicio del contrato (${actual.fecha_inicio}).`,
      }, { status: 400 })
    }

    const { data, error } = await admin
      .from('contratos_laborales')
      .update({
        vigente: false,
        fecha_fin: body.fecha_fin,
        motivo_fin: body.motivo_fin,
        nota_fin: body.nota_fin ?? null,
        actualizado_por: user.id,
      })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[contratos:id] PATCH terminar error:', error)
      return NextResponse.json({ error: 'No se pudo cerrar el contrato' }, { status: 500 })
    }

    return NextResponse.json({ contrato: data as ContratoLaboral })
  }

  // ─── Modo edición administrativa ───
  // Whitelist: descartamos cualquier otro campo. Si alguien manda
  // `monto_base`, lo ignoramos silenciosamente — la regla de negocio
  // (cambios económicos = contrato nuevo) se enforza acá.
  const editar = body as PayloadEditar
  const update: Record<string, unknown> = { actualizado_por: user.id }
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in editar) update[campo] = editar[campo]
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

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
