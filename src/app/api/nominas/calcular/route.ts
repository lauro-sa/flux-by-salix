/**
 * POST /api/nominas/calcular — Preview del recibo (sin persistir).
 *
 * Body: { miembro_id, periodo_inicio, periodo_fin }
 *
 * Llama al motor de cálculo y devuelve el desglose completo:
 * asistencia agregada, monto base, conceptos aplicados, conceptos
 * sugeridos, adelantos y total neto. La UI lo consume para mostrar el
 * recibo en vivo antes de confirmar el pago.
 *
 * Auth:
 *   - `nomina:ver_propio` si el miembro es el propio usuario.
 *   - `nomina:ver_todos`  para cualquier miembro de la empresa.
 *
 * Ver src/lib/nominas/motor-calculo.ts y PLAN_MODULO_NOMINAS.md (PR 7).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { calcularReciboDesdeBD } from '@/lib/nominas/motor-calculo'

interface Payload {
  miembro_id: string
  periodo_inicio: string
  periodo_fin: string
}

export async function POST(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: Payload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodo_inicio ?? '')) {
    return NextResponse.json({ error: 'periodo_inicio inválido (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodo_fin ?? '')) {
    return NextResponse.json({ error: 'periodo_fin inválido (YYYY-MM-DD)' }, { status: 400 })
  }
  if (body.periodo_fin < body.periodo_inicio) {
    return NextResponse.json({ error: 'periodo_fin debe ser >= periodo_inicio' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Si soloPropio, restringir al miembro vinculado al usuario.
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== body.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este miembro' }, { status: 403 })
    }
  }

  try {
    const detalle = await calcularReciboDesdeBD(admin, {
      miembroId: body.miembro_id,
      empresaId,
      periodoInicio: body.periodo_inicio,
      periodoFin: body.periodo_fin,
    })
    return NextResponse.json({ detalle })
  } catch (err) {
    console.error('[nominas/calcular] error:', err)
    return NextResponse.json({ error: 'Error al calcular recibo' }, { status: 500 })
  }
}
