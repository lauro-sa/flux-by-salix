/**
 * Ejecutor: mi_recibo_periodo
 *
 * Devuelve el recibo de nómina del propio empleado para el periodo solicitado.
 * Si no se especifica periodo, resuelve el "periodo relevante" (último cerrado
 * pendiente de pago, o el actual si ya se cobró).
 *
 * Soporta solo los últimos 3 periodos. Más atrás devuelve la sugerencia de
 * consultar al administrador.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { obtenerMiembroPersonal, resolverPeriodoSolicitado, MENSAJE_FUERA_DE_ALCANCE } from '@/lib/salix-ia/helpers-personal'
import { periodoRelevante } from '@/lib/asistencias/periodo-relevante'
import { cargarFeriados, esDiaHabil } from '@/lib/asistencias/dias-habiles'
import { formatoFechaCortaPeriodo, type RangoPeriodo } from '@/lib/asistencias/periodo-actual'

interface AsistenciaRow {
  fecha: string
  estado: string
  tipo: string
  puntualidad_min: number | null
}

interface PagoNominaRow {
  monto_sugerido: number | null
  monto_abonado: number | null
  dias_habiles: number | null
  dias_trabajados: number | null
  dias_ausentes: number | null
  tardanzas: number | null
  notas: string | null
}

export async function ejecutarMiReciboPeriodo(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>,
): Promise<ResultadoHerramienta> {
  const miembro = await obtenerMiembroPersonal(ctx)
  if (!miembro) {
    return { exito: false, error: 'No encontré tus datos de miembro activo en esta empresa.' }
  }

  // Resolución del periodo: si el modelo pasó alias usamos ventana histórica;
  // si no pasó nada, usamos la heurística de "periodo relevante" (más natural
  // para preguntas tipo "¿cuánto cobro este mes?").
  let periodo: RangoPeriodo | null = null
  if (params.periodo) {
    periodo = resolverPeriodoSolicitado(miembro, params.periodo as string)
    if (!periodo) {
      return {
        exito: true,
        datos: { fuera_de_alcance: true },
        mensaje_usuario: MENSAJE_FUERA_DE_ALCANCE,
      }
    }
  } else {
    const relevante = await periodoRelevante(ctx.admin, {
      id: miembro.id,
      compensacion_frecuencia: miembro.compensacion_frecuencia,
    })
    periodo = relevante.rango
  }

  // Buscamos un registro previo de pagos_nomina para este miembro y periodo.
  // Si existe, los números ya están calculados (los usamos como fuente única
  // de verdad, igual que la plantilla de envío de recibo).
  const { data: pagoExistente } = await ctx.admin
    .from('pagos_nomina')
    .select('monto_sugerido, monto_abonado, dias_habiles, dias_trabajados, dias_ausentes, tardanzas, notas')
    .eq('empresa_id', ctx.empresa_id)
    .eq('miembro_id', miembro.id)
    .eq('fecha_inicio_periodo', periodo.desde)
    .eq('fecha_fin_periodo', periodo.hasta)
    .eq('eliminado', false)
    .maybeSingle()

  let datos: PagoNominaRow

  if (pagoExistente) {
    datos = pagoExistente as PagoNominaRow
  } else {
    // Sin pago registrado todavía (típico del periodo en curso): calculamos
    // los números en vivo con las mismas reglas que /api/asistencias/nomina,
    // simplificadas para el alcance personal.
    const { data: asist } = await ctx.admin
      .from('asistencias')
      .select('fecha, estado, tipo, puntualidad_min')
      .eq('empresa_id', ctx.empresa_id)
      .eq('miembro_id', miembro.id)
      .gte('fecha', periodo.desde)
      .lte('fecha', periodo.hasta)

    const registros = (asist || []) as AsistenciaRow[]
    const inicio = new Date(periodo.desde + 'T12:00:00Z')
    const fin = new Date(periodo.hasta + 'T12:00:00Z')
    const feriados = await cargarFeriados(ctx.admin, ctx.empresa_id, inicio, fin)

    let diasHabiles = 0
    const cursor = new Date(inicio)
    while (cursor <= fin) {
      if (esDiaHabil(cursor, feriados)) diasHabiles++
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const diasTrabajados = registros.filter(r => r.estado !== 'ausente').length
    const tardanzas = registros.filter(r => r.tipo === 'tardanza' || (r.puntualidad_min ?? 0) > 0).length
    const diasAusentes = Math.max(0, diasHabiles - diasTrabajados)

    // Estimación simple del monto según tipo de compensación. Para 'fijo' el
    // monto es directo; para 'por_dia' multiplicamos por días trabajados.
    const monto = miembro.compensacion_tipo === 'por_dia'
      ? Number(miembro.compensacion_monto ?? 0) * diasTrabajados
      : Number(miembro.compensacion_monto ?? 0)

    datos = {
      monto_sugerido: monto,
      monto_abonado: 0,
      dias_habiles: diasHabiles,
      dias_trabajados: diasTrabajados,
      dias_ausentes: diasAusentes,
      tardanzas,
      notas: null,
    }
  }

  const desdeCorto = formatoFechaCortaPeriodo(periodo.desde)
  const hastaCorto = formatoFechaCortaPeriodo(periodo.hasta)
  const monto = Number(datos.monto_sugerido ?? 0)

  const partes = [
    `Recibo de ${periodo.etiqueta} (${desdeCorto} – ${hastaCorto}):`,
    `• Monto: $${monto.toLocaleString('es-AR')}`,
    `• Días trabajados: ${datos.dias_trabajados ?? 0} / ${datos.dias_habiles ?? 0} laborables`,
    `• Ausencias: ${datos.dias_ausentes ?? 0}`,
    `• Tardanzas: ${datos.tardanzas ?? 0}`,
  ]
  if (datos.notas) partes.push(`• Notas: ${datos.notas}`)

  return {
    exito: true,
    datos: {
      periodo,
      monto_sugerido: datos.monto_sugerido,
      monto_abonado: datos.monto_abonado,
      dias_habiles: datos.dias_habiles,
      dias_trabajados: datos.dias_trabajados,
      dias_ausentes: datos.dias_ausentes,
      tardanzas: datos.tardanzas,
      notas: datos.notas,
      ya_pagado: Number(datos.monto_abonado ?? 0) > 0,
    },
    mensaje_usuario: partes.join('\n'),
  }
}
