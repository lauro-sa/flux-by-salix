/**
 * API Route: /api/ia/credito
 * GET    — Lista cargas/ajustes de crédito por proveedor + cálculo de saldo
 * POST   — Registra nueva carga o ajuste de saldo
 * PUT    — Edita una carga existente
 * DELETE — Elimina una carga
 *
 * Query params (GET): ?proveedor=anthropic
 * Tipos: 'carga' (recarga de crédito) | 'ajuste' (saldo real actual)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface CargaRow {
  id: string
  proveedor: string
  tipo: string
  monto: string
  nota: string
  creado_en: string
}

/** Calcula el saldo base y si hay que descontar consumo */
function calcularSaldo(cargas: CargaRow[]): { saldo: number; descontarConsumo: boolean } {
  const ordenadas = [...cargas].sort(
    (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
  )

  let saldo = 0
  let ultimoTipo: string = 'carga'

  for (const c of ordenadas) {
    if (c.tipo === 'ajuste') {
      // Un ajuste = "mi saldo real es X" → resetea
      saldo = parseFloat(c.monto)
    } else {
      saldo += parseFloat(c.monto)
    }
    ultimoTipo = c.tipo
  }

  // Si el último registro es un ajuste, el saldo ya incluye el consumo real
  // del proveedor, así que NO hay que restar el consumo estimado.
  // Si hay cargas después de un ajuste, SÍ hay que restar.
  return { saldo, descontarConsumo: ultimoTipo !== 'ajuste' }
}

export async function GET(request: NextRequest) {
  const guard = await requerirPermisoAPI('config_empresa', 'ver')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId: empresa_id } = guard

  const proveedor = request.nextUrl.searchParams.get('proveedor')
  const admin = crearClienteAdmin()

  let query = admin
    .from('cargas_credito_ia')
    .select('id, proveedor, tipo, monto, nota, creado_en')
    .eq('empresa_id', empresa_id)
    .order('creado_en', { ascending: false })

  if (proveedor) {
    query = query.eq('proveedor', proveedor)
  }

  const { data: cargas, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const lista = (cargas || []) as CargaRow[]

  // Calcular saldo base por proveedor (crédito cargado - ajustes)
  const saldoBase: Record<string, number> = {}
  const descontarConsumo: Record<string, boolean> = {}
  const porProveedor = new Map<string, CargaRow[]>()

  for (const c of lista) {
    const arr = porProveedor.get(c.proveedor) || []
    arr.push(c)
    porProveedor.set(c.proveedor, arr)
  }

  for (const [p, cargasP] of porProveedor) {
    const resultado = calcularSaldo(cargasP)
    saldoBase[p] = resultado.saldo
    descontarConsumo[p] = resultado.descontarConsumo
  }

  return NextResponse.json({ cargas: lista, saldo_base: saldoBase, descontar_consumo: descontarConsumo })
}

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('config_empresa', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId: empresa_id } = guard

  const body = await request.json()
  const { proveedor, monto, nota, fecha, tipo } = body as {
    proveedor: string
    monto: number
    nota?: string
    fecha?: string
    tipo?: 'carga' | 'ajuste'
  }

  if (!proveedor || monto === undefined || monto < 0) {
    return NextResponse.json(
      { error: 'Se requiere proveedor y monto válido' },
      { status: 400 },
    )
  }

  // Para cargas, monto debe ser > 0. Para ajustes, puede ser 0.
  if ((tipo || 'carga') === 'carga' && monto <= 0) {
    return NextResponse.json(
      { error: 'El monto de la carga debe ser mayor a 0' },
      { status: 400 },
    )
  }

  const admin = crearClienteAdmin()

  const { data, error } = await admin
    .from('cargas_credito_ia')
    .insert({
      empresa_id,
      proveedor,
      tipo: tipo || 'carga',
      monto: monto.toFixed(2),
      nota: nota || '',
      ...(fecha ? { creado_en: new Date(fecha).toISOString() } : {}),
    })
    .select('id, proveedor, tipo, monto, nota, creado_en')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ carga: data })
}

export async function PUT(request: NextRequest) {
  const guard = await requerirPermisoAPI('config_empresa', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId: empresa_id } = guard

  const body = await request.json()
  const { id, monto, nota, fecha } = body as {
    id: string
    monto?: number
    nota?: string
    fecha?: string
  }

  if (!id) {
    return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const cambios: Record<string, unknown> = {}
  if (monto !== undefined) cambios.monto = monto.toFixed(2)
  if (nota !== undefined) cambios.nota = nota
  if (fecha) cambios.creado_en = new Date(fecha).toISOString()

  const { data, error } = await admin
    .from('cargas_credito_ia')
    .update(cambios)
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .select('id, proveedor, tipo, monto, nota, creado_en')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ carga: data })
}

export async function DELETE(request: NextRequest) {
  const guard = await requerirPermisoAPI('config_empresa', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId: empresa_id } = guard

  const { id } = await request.json() as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'Se requiere id' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  const { error } = await admin
    .from('cargas_credito_ia')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresa_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
