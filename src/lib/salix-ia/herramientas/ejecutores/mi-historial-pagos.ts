/**
 * Ejecutor: mi_historial_pagos
 *
 * Devuelve los últimos pagos cobrados (monto_abonado > 0) por el propio
 * empleado, máximo 3. Cada entrada incluye periodo, fecha de pago y monto.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { obtenerMiembroPersonal, MENSAJE_FUERA_DE_ALCANCE } from '@/lib/salix-ia/helpers-personal'
import { formatoFechaCortaPeriodo } from '@/lib/asistencias/periodo-actual'

const LIMITE_MAX = 3

interface PagoNominaRow {
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  concepto: string | null
  monto_abonado: number | null
  editado_en: string | null
  creado_en: string
}

export async function ejecutarMiHistorialPagos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>,
): Promise<ResultadoHerramienta> {
  const miembro = await obtenerMiembroPersonal(ctx)
  if (!miembro) {
    return { exito: false, error: 'No encontré tus datos de miembro activo en esta empresa.' }
  }

  // Validamos límite — la tool nunca devuelve más de 3 aunque el modelo pida más.
  const limiteSolicitado = typeof params.limite === 'number' ? params.limite : LIMITE_MAX
  const limite = Math.min(Math.max(1, Math.floor(limiteSolicitado)), LIMITE_MAX)

  const { data, error } = await ctx.admin
    .from('pagos_nomina')
    .select('fecha_inicio_periodo, fecha_fin_periodo, concepto, monto_abonado, editado_en, creado_en')
    .eq('empresa_id', ctx.empresa_id)
    .eq('miembro_id', miembro.id)
    .eq('eliminado', false)
    .gt('monto_abonado', 0)
    .order('fecha_fin_periodo', { ascending: false })
    .limit(limite)

  if (error) {
    return { exito: false, error: `No pude leer tu historial de pagos: ${error.message}` }
  }

  const pagos = (data || []) as PagoNominaRow[]

  if (pagos.length === 0) {
    return {
      exito: true,
      datos: { pagos: [], limite },
      mensaje_usuario: 'Todavía no tengo pagos registrados a tu nombre. Si esperabas ver alguno, consultá con tu administrador.',
    }
  }

  const partes = ['Tus últimos pagos cobrados:']
  for (const p of pagos) {
    const desde = formatoFechaCortaPeriodo(p.fecha_inicio_periodo)
    const hasta = formatoFechaCortaPeriodo(p.fecha_fin_periodo)
    const monto = Number(p.monto_abonado ?? 0)
    const fechaPago = formatoFechaCortaPeriodo((p.editado_en ?? p.creado_en).split('T')[0])
    partes.push(`• ${desde} – ${hasta} · $${monto.toLocaleString('es-AR')} · pagado el ${fechaPago}`)
  }
  partes.push('')
  partes.push(MENSAJE_FUERA_DE_ALCANCE)

  return {
    exito: true,
    datos: { pagos, limite },
    mensaje_usuario: partes.join('\n'),
  }
}
