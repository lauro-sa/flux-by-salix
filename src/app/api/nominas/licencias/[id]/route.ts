/**
 * /api/nominas/licencias/[id]
 *
 * PATCH  → edita una licencia. Casos:
 *          - Cerrar una licencia abierta: enviar `fecha_fin`.
 *          - Cambiar tipo / fechas / goce / notas.
 * DELETE → elimina la licencia. Solo permitido si la licencia no se
 *          aplicó todavía a un pago grabado — por ahora la BD no liga
 *          licencias a pagos, así que el delete es libre. Si querés
 *          conservar histórico, editá `notas` o cerrá la licencia.
 *
 * Auth: `nomina:editar` en ambos casos.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
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

interface PayloadPatch {
  tipo?: TipoLicencia
  fecha_inicio?: string
  fecha_fin?: string | null
  goce_sueldo?: boolean
  notas?: string | null
}

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

  const update: Record<string, unknown> = { actualizado_por: user.id }

  if (body.tipo !== undefined) {
    if (!TIPOS_VALIDOS.includes(body.tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    update.tipo = body.tipo
  }
  if (body.fecha_inicio !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_inicio)) {
      return NextResponse.json({ error: 'fecha_inicio inválida' }, { status: 400 })
    }
    update.fecha_inicio = body.fecha_inicio
  }
  if (body.fecha_fin !== undefined) {
    if (body.fecha_fin !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_fin)) {
      return NextResponse.json({ error: 'fecha_fin inválida' }, { status: 400 })
    }
    update.fecha_fin = body.fecha_fin
  }
  if (body.goce_sueldo !== undefined) update.goce_sueldo = body.goce_sueldo
  if (body.notas !== undefined) update.notas = body.notas

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data, error } = await admin
    .from('licencias_contrato')
    .update(update)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === '23P01') {
      return NextResponse.json({
        error: 'El cambio genera superposición con otra licencia del mismo contrato.',
      }, { status: 409 })
    }
    if (error.code === '23514') {
      return NextResponse.json({
        error: 'La fecha de fin no puede ser anterior al inicio.',
      }, { status: 400 })
    }
    console.error('[licencias:id] PATCH error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar la licencia' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })

  return NextResponse.json({ licencia: data as LicenciaContrato })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId } = guard

  const admin = crearClienteAdmin()
  const { error } = await admin
    .from('licencias_contrato')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', id)

  if (error) {
    console.error('[licencias:id] DELETE error:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la licencia' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
