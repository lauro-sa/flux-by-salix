/**
 * /api/nominas/conceptos
 *
 * GET                  → lista todos los conceptos de la empresa
 *                       (activos primero, por orden ascendente).
 * POST                 → crea un concepto en el catálogo.
 *
 * Para PATCH y DELETE (soft) ver /api/nominas/conceptos/[id].
 *
 * Auth:
 *   GET   → cualquier miembro con permiso `nomina:ver_propio` o ver_todos
 *           (los empleados pueden necesitar saber qué conceptos existen
 *           para entender su recibo).
 *   POST  → permiso `nomina:editar` (configura el catálogo).
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type {
  ConceptoNomina,
  TipoConcepto,
  CategoriaConcepto,
  ModoCalculoConcepto,
} from '@/tipos/nominas'

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const incluirInactivos = request.nextUrl.searchParams.get('incluirInactivos') === 'true'

  const admin = crearClienteAdmin()
  let query = admin
    .from('conceptos_nomina')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('orden', { ascending: true })
    .order('creado_en', { ascending: true })

  if (!incluirInactivos) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) {
    console.error('[conceptos] GET error:', error)
    return NextResponse.json({ error: 'Error al listar conceptos' }, { status: 500 })
  }

  return NextResponse.json({ conceptos: (data || []) as ConceptoNomina[] })
}

// ════════════════════════════════════════════════════════════════
// POST
// ════════════════════════════════════════════════════════════════

interface PayloadCrearConcepto {
  nombre: string
  descripcion?: string | null
  icono?: string | null
  color?: string | null
  tipo: TipoConcepto
  categoria?: CategoriaConcepto | null
  modo_calculo: ModoCalculoConcepto
  valor?: number | null
  automatico?: boolean
  condicion_jsonb?: Record<string, unknown> | null
  recurrente?: boolean
  activo?: boolean
  orden?: number
}

const TIPOS: TipoConcepto[] = ['haber', 'descuento']
const CATEGORIAS: CategoriaConcepto[] = [
  'presentismo', 'premio', 'bono', 'antiguedad', 'adicional',
  'descuento_uniforme', 'descuento_otro', 'otro',
]
const MODOS: ModoCalculoConcepto[] = ['monto_fijo', 'porcentaje_basico', 'por_dia', 'por_evento', 'manual']

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadCrearConcepto
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (!body.nombre || !body.nombre.trim()) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }
  if (!TIPOS.includes(body.tipo)) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }
  if (body.categoria && !CATEGORIAS.includes(body.categoria)) {
    return NextResponse.json({ error: 'categoria inválida' }, { status: 400 })
  }
  if (!MODOS.includes(body.modo_calculo)) {
    return NextResponse.json({ error: 'modo_calculo inválido' }, { status: 400 })
  }
  // valor: requerido salvo modo='manual' (donde debe ser NULL — lo enforza el CHECK).
  if (body.modo_calculo === 'manual') {
    if (body.valor !== null && body.valor !== undefined) {
      return NextResponse.json({ error: 'En modo manual el valor debe ser nulo' }, { status: 400 })
    }
  } else {
    if (body.valor === null || body.valor === undefined || !Number.isFinite(body.valor)) {
      return NextResponse.json({ error: 'valor requerido cuando modo ≠ manual' }, { status: 400 })
    }
  }

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('conceptos_nomina')
    .insert({
      empresa_id: empresaId,
      nombre: body.nombre.trim(),
      descripcion: body.descripcion ?? null,
      icono: body.icono ?? 'star',
      color: body.color ?? '#6b7280',
      tipo: body.tipo,
      categoria: body.categoria ?? null,
      modo_calculo: body.modo_calculo,
      valor: body.modo_calculo === 'manual' ? null : body.valor,
      automatico: body.automatico ?? true,
      condicion_jsonb: body.condicion_jsonb ?? null,
      recurrente: body.recurrente ?? true,
      activo: body.activo ?? true,
      orden: body.orden ?? 0,
      creado_por: user.id,
      actualizado_por: user.id,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[conceptos] POST error:', error)
    return NextResponse.json({ error: 'No se pudo crear el concepto' }, { status: 500 })
  }

  return NextResponse.json({ concepto: data as ConceptoNomina }, { status: 201 })
}
