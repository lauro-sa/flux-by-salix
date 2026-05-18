/**
 * POST /api/nominas/liquidar
 *
 * Congela el cálculo de uno o N empleados de un período: pasa de borrador
 * (virtual, calc en vivo) a 'liquidado' guardando snapshot_calculo.
 *
 * Body:
 *   {
 *     periodo_inicio: 'YYYY-MM-DD',
 *     periodo_fin:    'YYYY-MM-DD',
 *     miembros_ids:   string[]      // 1 o N empleados a liquidar
 *   }
 *
 * Devuelve: { resultados: Array<{ miembro_id, ok, code?, mensaje? }> }
 * El status global es 200 incluso si algunos fallaron — el cliente
 * inspecciona cada item.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { calcularReciboDesdeBD } from '@/lib/nominas/motor-calculo'
import { transicionarLiquidacionEmpleado } from '@/lib/nominas/transicion-liquidacion'

interface Payload {
  periodo_inicio: string
  periodo_fin: string
  miembros_ids: string[]
}

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Payload
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { periodo_inicio, periodo_fin, miembros_ids } = body
  if (!periodo_inicio || !periodo_fin || !Array.isArray(miembros_ids) || miembros_ids.length === 0) {
    return NextResponse.json({ error: 'periodo_inicio, periodo_fin y miembros_ids[] requeridos' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('nombre, apellido').eq('id', user.id).single()
  const nombreActor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Sistema'

  // Por cada miembro: calcular snapshot + transicionar.
  const resultados = await Promise.all(miembros_ids.map(async miembroId => {
    try {
      const recibo = await calcularReciboDesdeBD(admin, {
        empresaId,
        miembroId,
        periodoInicio: periodo_inicio,
        periodoFin: periodo_fin,
      })
      const snapshot = {
        version_motor: 'v3.0',
        calculado_en: new Date().toISOString(),
        ...recibo,
      } as unknown as Record<string, unknown>

      const r = await transicionarLiquidacionEmpleado(admin, {
        empresaId,
        miembroId,
        periodoInicio: periodo_inicio,
        periodoFin: periodo_fin,
        hastaClave: 'liquidado',
        snapshotCalculo: snapshot,
        usuario: { id: user.id, nombre: nombreActor },
      })
      return r.ok
        ? { miembro_id: miembroId, ok: true }
        : { miembro_id: miembroId, ok: false, code: r.code, mensaje: r.mensaje }
    } catch (e) {
      return { miembro_id: miembroId, ok: false, code: 'error_calc', mensaje: e instanceof Error ? e.message : 'Error al calcular' }
    }
  }))

  return NextResponse.json({ resultados })
}
