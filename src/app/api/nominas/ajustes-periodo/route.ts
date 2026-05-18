/**
 * /api/nominas/ajustes-periodo
 *
 * GET ?miembro_id=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD →
 *     Lista los ajustes (override/excluir/agregar) del miembro en
 *     ese período. Incluye detalle del concepto (nombre, tipo, color)
 *     para que la UI los pueda mostrar sin un fetch adicional.
 *
 * POST → Crea un ajuste. Body:
 *        {
 *          miembro_id, periodo_inicio, periodo_fin, concepto_id,
 *          tipo_ajuste: 'override' | 'excluir' | 'agregar',
 *          monto_override?: number | null,
 *          motivo?: string | null,
 *        }
 *        Si ya existe un ajuste para (miembro, periodo, concepto), se
 *        ACTUALIZA (upsert) — esto permite que la UI sea declarativa.
 *
 * Validaciones de coherencia:
 *   - 'override' y 'agregar' requieren `monto_override` numérico.
 *   - 'excluir' requiere `monto_override = null`.
 *   - 'override' y 'excluir' requieren que el concepto esté asignado
 *     al contrato vigente del miembro (sino es un 'agregar').
 *   - 'agregar' requiere que el concepto NO esté asignado al contrato
 *     vigente (sino es un 'override').
 *
 * Auth: requiere `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

type TipoAjuste = 'override' | 'excluir' | 'agregar'

interface PayloadCrear {
  miembro_id: string
  periodo_inicio: string
  periodo_fin: string
  concepto_id: string
  tipo_ajuste: TipoAjuste
  monto_override?: number | null
  motivo?: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'ver_todos')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId } = guard

  const params = request.nextUrl.searchParams
  const miembroId = params.get('miembro_id')
  const desde = params.get('desde')
  const hasta = params.get('hasta')

  if (!miembroId) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!desde || !ISO_DATE.test(desde)) return NextResponse.json({ error: 'desde inválido (YYYY-MM-DD)' }, { status: 400 })
  if (!hasta || !ISO_DATE.test(hasta)) return NextResponse.json({ error: 'hasta inválido (YYYY-MM-DD)' }, { status: 400 })

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('ajustes_concepto_periodo')
    .select(`
      *,
      concepto:conceptos_nomina (
        nombre, descripcion, icono, color, tipo, categoria,
        modo_calculo, valor
      )
    `)
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .eq('periodo_inicio', desde)
    .eq('periodo_fin', hasta)
    .order('creado_en', { ascending: true })

  if (error) {
    console.error('[ajustes-periodo] GET error:', error)
    return NextResponse.json({ error: 'Error al listar ajustes' }, { status: 500 })
  }
  return NextResponse.json({ ajustes: data ?? [] })
}

// ════════════════════════════════════════════════════════════════
// POST — crear o actualizar (upsert)
// ════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadCrear
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // ─── Validaciones de forma ───
  if (!body.miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!body.concepto_id) return NextResponse.json({ error: 'concepto_id requerido' }, { status: 400 })
  if (!ISO_DATE.test(body.periodo_inicio ?? '')) return NextResponse.json({ error: 'periodo_inicio inválido' }, { status: 400 })
  if (!ISO_DATE.test(body.periodo_fin ?? '')) return NextResponse.json({ error: 'periodo_fin inválido' }, { status: 400 })
  if (body.periodo_fin < body.periodo_inicio) return NextResponse.json({ error: 'periodo_fin debe ser >= periodo_inicio' }, { status: 400 })
  if (!['override', 'excluir', 'agregar'].includes(body.tipo_ajuste)) {
    return NextResponse.json({ error: 'tipo_ajuste inválido' }, { status: 400 })
  }

  // ─── Coherencia tipo_ajuste ↔ monto_override ───
  const tipo: TipoAjuste = body.tipo_ajuste
  if (tipo === 'excluir') {
    if (body.monto_override !== null && body.monto_override !== undefined) {
      return NextResponse.json({ error: "tipo 'excluir' no acepta monto_override" }, { status: 400 })
    }
  } else {
    if (typeof body.monto_override !== 'number' || !Number.isFinite(body.monto_override) || body.monto_override < 0) {
      return NextResponse.json({ error: `tipo '${tipo}' requiere monto_override numérico ≥ 0` }, { status: 400 })
    }
  }

  const admin = crearClienteAdmin()

  // Validar miembro de la empresa.
  const { data: miembro } = await admin
    .from('miembros')
    .select('id')
    .eq('id', body.miembro_id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!miembro) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })

  // Validar que el concepto exista en la empresa.
  const { data: concepto } = await admin
    .from('conceptos_nomina')
    .select('id, activo')
    .eq('id', body.concepto_id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!concepto) return NextResponse.json({ error: 'Concepto no encontrado en la empresa' }, { status: 404 })

  // ─── Coherencia con el contrato vigente ───
  // 'override'/'excluir' requieren que el concepto ESTÉ en el contrato vigente.
  // 'agregar' requiere que NO esté (sino es un override).
  const { data: contratoVigente } = await admin
    .from('contratos_laborales')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', body.miembro_id)
    .eq('vigente', true)
    .maybeSingle()

  let estaEnContrato = false
  if (contratoVigente) {
    const { data: asignacion } = await admin
      .from('conceptos_contrato')
      .select('id')
      .eq('contrato_id', contratoVigente.id)
      .eq('concepto_id', body.concepto_id)
      .is('fecha_baja', null)
      .maybeSingle()
    estaEnContrato = !!asignacion
  }

  if ((tipo === 'override' || tipo === 'excluir') && !estaEnContrato) {
    return NextResponse.json({
      error: `Para '${tipo}' el concepto debe estar asignado al contrato vigente. Usá 'agregar' si querés aplicarlo solo a este período.`,
    }, { status: 400 })
  }
  if (tipo === 'agregar' && estaEnContrato) {
    return NextResponse.json({
      error: `El concepto ya está en el contrato vigente. Para cambiarle el monto este período usá 'override'.`,
    }, { status: 400 })
  }

  // ─── Upsert por (miembro, período, concepto) ───
  // Si ya existe, actualizamos (PUT-like). Esto permite que la UI sea
  // declarativa: el operador toca un botón y el endpoint se encarga
  // de crear o actualizar según corresponda.
  const { data: existente } = await admin
    .from('ajustes_concepto_periodo')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', body.miembro_id)
    .eq('periodo_inicio', body.periodo_inicio)
    .eq('periodo_fin', body.periodo_fin)
    .eq('concepto_id', body.concepto_id)
    .maybeSingle()

  const datosFila = {
    tipo_ajuste: tipo,
    monto_override: tipo === 'excluir' ? null : body.monto_override,
    motivo: body.motivo?.trim() || null,
  }

  if (existente) {
    // Snapshot del estado anterior para la auditoría.
    const { data: anterior } = await admin
      .from('ajustes_concepto_periodo')
      .select('id, tipo_ajuste, monto_override, motivo')
      .eq('id', existente.id)
      .maybeSingle()

    const { data: actualizado, error } = await admin
      .from('ajustes_concepto_periodo')
      .update({ ...datosFila, actualizado_por: user.id })
      .eq('id', existente.id)
      .select()
      .single()
    if (error || !actualizado) {
      console.error('[ajustes-periodo] update error:', error)
      return NextResponse.json({ error: 'No se pudo actualizar el ajuste' }, { status: 500 })
    }

    // Auditoría best-effort (no abortamos si falla).
    await admin.from('auditoria_ajustes_concepto_periodo').insert({
      empresa_id: empresaId,
      ajuste_id: existente.id,
      miembro_id: body.miembro_id,
      concepto_id: body.concepto_id,
      periodo_inicio: body.periodo_inicio,
      periodo_fin: body.periodo_fin,
      editado_por: user.id,
      accion: 'actualizar',
      estado_anterior: anterior,
      estado_nuevo: { id: actualizado.id, ...datosFila },
    })

    return NextResponse.json({ ajuste: actualizado, modo: 'actualizado' })
  }

  const { data: creado, error } = await admin
    .from('ajustes_concepto_periodo')
    .insert({
      empresa_id: empresaId,
      miembro_id: body.miembro_id,
      periodo_inicio: body.periodo_inicio,
      periodo_fin: body.periodo_fin,
      concepto_id: body.concepto_id,
      ...datosFila,
      creado_por: user.id,
      actualizado_por: user.id,
    })
    .select()
    .single()

  if (error || !creado) {
    console.error('[ajustes-periodo] insert error:', error)
    return NextResponse.json({ error: 'No se pudo crear el ajuste' }, { status: 500 })
  }

  await admin.from('auditoria_ajustes_concepto_periodo').insert({
    empresa_id: empresaId,
    ajuste_id: creado.id,
    miembro_id: body.miembro_id,
    concepto_id: body.concepto_id,
    periodo_inicio: body.periodo_inicio,
    periodo_fin: body.periodo_fin,
    editado_por: user.id,
    accion: 'crear',
    estado_anterior: null,
    estado_nuevo: { id: creado.id, ...datosFila },
  })

  return NextResponse.json({ ajuste: creado, modo: 'creado' }, { status: 201 })
}
