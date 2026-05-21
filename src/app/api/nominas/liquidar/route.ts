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
import { obtenerFilaListadoParaSnapshot } from '@/lib/nominas/obtener-fila-listado'

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

  // Por cada miembro: validar solapamiento + calcular snapshot + transicionar.
  const resultados = await Promise.all(miembros_ids.map(async miembroId => {
    try {
      // ─── Validación de solapamiento ───
      //
      // Rechazamos si el miembro ya tiene una liquidación cuyo rango
      // de fechas se solapa con el que se está pidiendo. Esto evita
      // generar liquidaciones huérfanas en distintas granularidades
      // (típico: clickear "Liquidar" desde vista Mes y después desde
      // vista Quincena del mismo período).
      //
      // Solape = NOT (existente.fin < pedido.inicio OR existente.inicio > pedido.fin).
      //
      // Excluye:
      //   - La fila exacta (mismo inicio y fin), por idempotencia: si el
      //     operador re-liquida el mismo período, dejamos pasar y la
      //     transición decide si lo permite (estado != borrador → ilegal).
      //   - Filas que NO tengan snapshot todavía y estén en 'borrador'.
      //     Los borradores virtuales no consumen período.
      const { data: solapadas } = await admin
        .from('liquidaciones_empleado_periodo')
        .select('periodo_inicio, periodo_fin, estado_clave')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembroId)
        .neq('estado_clave', 'borrador')
        .lte('periodo_inicio', periodo_fin)
        .gte('periodo_fin', periodo_inicio)
      const conflictos = (solapadas ?? []).filter(s =>
        !(s.periodo_inicio === periodo_inicio && s.periodo_fin === periodo_fin),
      )
      if (conflictos.length > 0) {
        const c = conflictos[0]
        return {
          miembro_id: miembroId,
          ok: false,
          code: 'solapamiento',
          mensaje: `Ya existe una liquidación ${c.estado_clave} para el período ${c.periodo_inicio} → ${c.periodo_fin} que se solapa. Cancelá esa primero si querés liquidar con otra granularidad.`,
        }
      }

      const recibo = await calcularReciboDesdeBD(admin, {
        empresaId,
        miembroId,
        periodoInicio: periodo_inicio,
        periodoFin: periodo_fin,
      })
      // Antes de transicionar pedimos al endpoint /api/nominas la fila
      // completa para este miembro (todavía en estado 'borrador'). Esto
      // captura las métricas detalladas del listado (horas brutas, días
      // jornada, etc.) que el motor base no produce. Una vez liquidado,
      // el endpoint leerá del snapshot sin recalcular.
      const filaListado = await obtenerFilaListadoParaSnapshot(
        request, miembroId, periodo_inicio, periodo_fin,
      )
      const snapshot = {
        version_motor: 'v3.1',
        calculado_en: new Date().toISOString(),
        // `detalle` con shape estable lo consume calcular-con-snapshot.ts
        // y generar-pdf-recibo.ts (ambos esperan snapshot.detalle).
        detalle: recibo,
        // `fila_listado` permite a /api/nominas GET reconstruir la card
        // sin pasar por el motor.
        fila_listado: filaListado,
      } as Record<string, unknown>

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
