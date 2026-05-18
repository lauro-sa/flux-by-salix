/**
 * PATCH /api/nominas/pagos/[id]
 *
 * Actualiza campos de un pago de nómina ya registrado. Hoy solo soporta
 * `comprobante_url` — la idea es asociar un comprobante real (transferencia,
 * voucher, recibo bancario) después de haber confirmado el pago en bulk,
 * cuando el operador todavía no lo tenía digitalizado al momento de pagar.
 *
 * Body:
 *   { comprobante_url: string | null }
 *
 * `null` se acepta y se interpreta como "quitar el comprobante adjunto".
 *
 * Auth: `nomina:editar`.
 *
 * Scope: el pago debe pertenecer a la empresa activa; sino 404 (no exponemos
 * existencia de pagos de otras empresas).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId } = guard

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  let body: { comprobante_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!('comprobante_url' in body)) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const nuevoUrl =
    body.comprobante_url === null
      ? null
      : typeof body.comprobante_url === 'string' && body.comprobante_url.trim().length > 0
      ? body.comprobante_url.trim()
      : null

  const admin = crearClienteAdmin()

  // Verificar pertenencia antes de tocar — la columna empresa_id en
  // pagos_nomina ya tiene RLS, pero el update con admin bypasea RLS.
  const { data: pago } = await admin
    .from('pagos_nomina')
    .select('id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const { error } = await admin
    .from('pagos_nomina')
    .update({ comprobante_url: nuevoUrl })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) {
    console.error('[nominas/pagos/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el pago' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, comprobante_url: nuevoUrl })
}
