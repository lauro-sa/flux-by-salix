/**
 * /api/nominas/conceptos/[id]
 *
 * PATCH   → actualiza campos del concepto (whitelist amplia: todos
 *           menos identificadores y autoría que se setea en server).
 * DELETE  → soft delete (activo = false). Si el concepto está en uso
 *           por algún `conceptos_contrato`, igual se permite porque
 *           ya hay UNIQUE/FK que protegen consistencia (el contrato
 *           queda apuntando a un concepto inactivo, no se rompe).
 *
 * Auth: requiere `nomina:editar` para ambos.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type {
  ConceptoNomina,
  TipoConcepto,
  CategoriaConcepto,
  ModoCalculoConcepto,
} from '@/tipos/nominas'

interface Params { params: Promise<{ id: string }> }

const TIPOS: TipoConcepto[] = ['haber', 'descuento']
const CATEGORIAS: CategoriaConcepto[] = [
  'presentismo', 'premio', 'bono', 'antiguedad', 'adicional',
  'descuento_uniforme', 'descuento_otro', 'otro',
]
const MODOS: ModoCalculoConcepto[] = ['monto_fijo', 'porcentaje_basico', 'por_dia', 'por_evento', 'manual']

interface PayloadPatch {
  nombre?: string
  descripcion?: string | null
  icono?: string
  color?: string
  tipo?: TipoConcepto
  categoria?: CategoriaConcepto | null
  modo_calculo?: ModoCalculoConcepto
  valor?: number | null
  automatico?: boolean
  condicion_jsonb?: Record<string, unknown> | null
  recurrente?: boolean
  activo?: boolean
  orden?: number
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadPatch
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (body.tipo && !TIPOS.includes(body.tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  if (body.categoria && !CATEGORIAS.includes(body.categoria)) return NextResponse.json({ error: 'categoria inválida' }, { status: 400 })
  if (body.modo_calculo && !MODOS.includes(body.modo_calculo)) return NextResponse.json({ error: 'modo_calculo inválido' }, { status: 400 })

  // El CHECK de la tabla enforza la consistencia modo↔valor; igual
  // ayudamos al usuario con un error claro.
  if (body.modo_calculo === 'manual' && body.valor !== null && body.valor !== undefined) {
    return NextResponse.json({ error: 'En modo manual el valor debe ser nulo' }, { status: 400 })
  }

  const update: Record<string, unknown> = { actualizado_por: user.id }
  const campos: (keyof PayloadPatch)[] = [
    'nombre', 'descripcion', 'icono', 'color', 'tipo', 'categoria',
    'modo_calculo', 'valor', 'automatico', 'condicion_jsonb',
    'recurrente', 'activo', 'orden',
  ]
  for (const c of campos) if (c in body) update[c] = body[c]

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('conceptos_nomina')
    .update(update)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[conceptos:id] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar concepto' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })

  return NextResponse.json({ concepto: data as ConceptoNomina })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('conceptos_nomina')
    .update({ activo: false, actualizado_por: user.id })
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[conceptos:id] DELETE error:', error)
    return NextResponse.json({ error: 'Error al desactivar concepto' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
