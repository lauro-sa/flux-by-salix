/**
 * /api/nominas/contratos/[id]/licencias
 *
 * GET  → lista las licencias del contrato (ordenadas por fecha_inicio desc).
 * POST → crea una licencia nueva.
 *
 * Cuerpo del POST:
 *   {
 *     tipo: TipoLicencia,
 *     fecha_inicio: 'YYYY-MM-DD',
 *     fecha_fin?: 'YYYY-MM-DD' | null,  // null = abierta
 *     goce_sueldo?: boolean,            // default true
 *     notas?: string,
 *   }
 *
 * La BD ya rechaza superposiciones por EXCLUDE constraint; este
 * endpoint solo valida estructura y permisos.
 *
 * Auth: GET con `nomina:ver_propio` o `nomina:ver_todos`; POST con
 * `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { LicenciaContrato, TipoLicencia } from '@/tipos/nominas'

interface Params {
  params: Promise<{ id: string }>
}

const TIPOS_VALIDOS: TipoLicencia[] = [
  'medica',
  'maternidad',
  'paternidad',
  'estudio',
  'examen',
  'duelo',
  'matrimonio',
  'mudanza',
  'vacaciones',
  'suspension_disciplinaria',
  'suspension_economica',
  'otro',
]

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: contratoId } = await params
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()

  // Si soloPropio, validar que el contrato es del miembro vinculado al usuario.
  if (vis.soloPropio) {
    const { data: c } = await admin
      .from('contratos_laborales')
      .select('miembro_id')
      .eq('empresa_id', empresaId)
      .eq('id', contratoId)
      .maybeSingle()
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!c || !miembroPropio || c.miembro_id !== miembroPropio.id) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('licencias_contrato')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('contrato_id', contratoId)
    .order('fecha_inicio', { ascending: false })

  if (error) {
    console.error('[licencias] GET error:', error)
    return NextResponse.json({ error: 'Error al cargar licencias' }, { status: 500 })
  }

  return NextResponse.json({ licencias: (data ?? []) as LicenciaContrato[] })
}

// ════════════════════════════════════════════════════════════════
// POST
// ════════════════════════════════════════════════════════════════

interface PayloadPost {
  tipo: TipoLicencia
  fecha_inicio: string
  fecha_fin?: string | null
  goce_sueldo?: boolean
  notas?: string | null
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contratoId } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadPost
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_inicio ?? '')) {
    return NextResponse.json({ error: 'fecha_inicio inválida (YYYY-MM-DD)' }, { status: 400 })
  }
  if (body.fecha_fin && !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_fin)) {
    return NextResponse.json({ error: 'fecha_fin inválida (YYYY-MM-DD)' }, { status: 400 })
  }
  if (body.fecha_fin && body.fecha_fin < body.fecha_inicio) {
    return NextResponse.json({ error: 'fecha_fin debe ser >= fecha_inicio' }, { status: 400 })
  }
  if (body.tipo === 'otro' && !body.notas?.trim()) {
    return NextResponse.json({ error: 'Tipo "otro" requiere una nota.' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Necesitamos el miembro_id del contrato para denormalizar en la
  // tabla de licencias (acelera queries por miembro).
  const { data: contrato } = await admin
    .from('contratos_laborales')
    .select('miembro_id')
    .eq('empresa_id', empresaId)
    .eq('id', contratoId)
    .maybeSingle()

  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  const { data, error } = await admin
    .from('licencias_contrato')
    .insert({
      empresa_id: empresaId,
      miembro_id: contrato.miembro_id,
      contrato_id: contratoId,
      tipo: body.tipo,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin ?? null,
      goce_sueldo: body.goce_sueldo ?? true,
      notas: body.notas ?? null,
      creado_por: user.id,
    })
    .select()
    .maybeSingle()

  if (error) {
    // El constraint EXCLUDE devuelve código 23P01 cuando hay superposición.
    if (error.code === '23P01') {
      return NextResponse.json({
        error: 'La licencia se superpone con otra ya cargada para este contrato.',
      }, { status: 409 })
    }
    console.error('[licencias] POST error:', error)
    return NextResponse.json({ error: 'No se pudo crear la licencia' }, { status: 500 })
  }

  return NextResponse.json({ licencia: data as LicenciaContrato })
}
