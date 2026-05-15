/**
 * /api/nominas/conceptos/[id]
 *
 * PATCH   → actualiza campos del concepto (whitelist amplia: todos
 *           menos identificadores y autoría que se setea en server).
 * DELETE  → si es predefinido: 409 (usar toggle activo).
 *           Si NO es predefinido y no está referenciado por ningún
 *           contrato ni pago: hard delete real.
 *           Si NO es predefinido pero está referenciado: soft delete
 *           (activo = false) para no romper históricos.
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
  periodicidad?: 'mensual' | 'por_periodo' | 'unico'
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
    'recurrente', 'activo', 'orden', 'periodicidad',
  ]
  for (const c of campos) if (c in body) update[c] = body[c]
  // Validar periodicidad si vino.
  if ('periodicidad' in body && !['mensual', 'por_periodo', 'unico'].includes(body.periodicidad as string)) {
    return NextResponse.json({ error: 'periodicidad inválida' }, { status: 400 })
  }

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

  // Si es predefinido del sistema, bloqueamos el borrado. El operador
  // puede usar el toggle `activo` para desactivarlo, pero no quitarlo
  // del catálogo — están atados a la lógica del motor.
  const { data: actual } = await admin
    .from('conceptos_nomina')
    .select('es_predefinido')
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .maybeSingle()
  if (!actual) return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })
  if (actual.es_predefinido) {
    return NextResponse.json({
      error: 'Este concepto es predefinido del sistema y no se puede eliminar. Desactivalo con el switch "Activo" si no querés que aparezca.',
      codigo: 'PREDEFINIDO',
    }, { status: 409 })
  }

  // Para no predefinidos, chequeamos si está asignado a algún
  // contrato vigente. `conceptos_contrato` tiene ON DELETE RESTRICT,
  // así que un hard delete tiraría error de FK si lo borráramos. En
  // ese caso hacemos soft delete (activo=false). La tabla snapshot
  // `conceptos_aplicados_pago` tiene ON DELETE SET NULL, así que no
  // bloquea — el nombre_snapshot queda y los pagos siguen mostrando
  // el detalle aunque el concepto desaparezca del catálogo.
  const { count: refContratos } = await admin
    .from('conceptos_contrato')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('concepto_id', id)

  if ((refContratos ?? 0) > 0) {
    // Soft delete: queda en la BD pero inactivo, así los pagos
    // históricos siguen mostrando el nombre correcto.
    const { data, error } = await admin
      .from('conceptos_nomina')
      .update({ activo: false, actualizado_por: user.id })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[conceptos:id] DELETE soft error:', error)
      return NextResponse.json({ error: 'Error al desactivar concepto' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, modo: 'desactivado' })
  }

  // Hard delete: no hay referencias, podemos borrarlo de verdad.
  const { error } = await admin
    .from('conceptos_nomina')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', id)

  if (error) {
    console.error('[conceptos:id] DELETE hard error:', error)
    return NextResponse.json({ error: 'Error al eliminar concepto' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, modo: 'eliminado' })
}
