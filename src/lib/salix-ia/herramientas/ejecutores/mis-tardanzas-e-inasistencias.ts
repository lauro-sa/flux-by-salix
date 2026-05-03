/**
 * Ejecutor: mis_tardanzas_e_inasistencias
 *
 * Lista tardanzas e inasistencias del propio empleado para el periodo solicitado.
 * Solo soporta los últimos 3 periodos (actual, anterior, antepasado). Devuelve
 * fechas, minutos de tardanza y motivo si está cargado.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { obtenerMiembroPersonal, resolverPeriodoSolicitado, MENSAJE_FUERA_DE_ALCANCE } from '@/lib/salix-ia/helpers-personal'
import { cargarFeriados, esDiaHabil } from '@/lib/asistencias/dias-habiles'
import { formatoFechaCortaPeriodo } from '@/lib/asistencias/periodo-actual'

interface AsistenciaRow {
  fecha: string
  estado: string
  tipo: string
  puntualidad_min: number | null
  notas: string | null
}

export async function ejecutarMisTardanzasEInasistencias(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>,
): Promise<ResultadoHerramienta> {
  const miembro = await obtenerMiembroPersonal(ctx)
  if (!miembro) {
    return { exito: false, error: 'No encontré tus datos de miembro activo en esta empresa.' }
  }

  const periodo = resolverPeriodoSolicitado(miembro, params.periodo as string | undefined)
  if (!periodo) {
    return {
      exito: true,
      datos: { fuera_de_alcance: true },
      mensaje_usuario: MENSAJE_FUERA_DE_ALCANCE,
    }
  }

  const { data, error } = await ctx.admin
    .from('asistencias')
    .select('fecha, estado, tipo, puntualidad_min, notas')
    .eq('empresa_id', ctx.empresa_id)
    .eq('miembro_id', miembro.id)
    .gte('fecha', periodo.desde)
    .lte('fecha', periodo.hasta)

  if (error) {
    return { exito: false, error: `No pude leer tu asistencia: ${error.message}` }
  }

  const registros = (data || []) as AsistenciaRow[]
  const tardanzas = registros.filter(r => r.tipo === 'tardanza' || (r.puntualidad_min ?? 0) > 0)

  // Calculamos inasistencias por diferencia: días hábiles del periodo - días con registro presencial.
  const inicio = new Date(periodo.desde + 'T12:00:00Z')
  const fin = new Date(periodo.hasta + 'T12:00:00Z')
  const feriados = await cargarFeriados(ctx.admin, ctx.empresa_id, inicio, fin)

  const diasConRegistro = new Set(registros.filter(r => r.estado !== 'ausente').map(r => r.fecha))
  const inasistencias: { fecha: string; motivo: string | null }[] = []
  const cursor = new Date(inicio)
  const hoy = new Date().toISOString().split('T')[0]

  while (cursor <= fin) {
    const iso = cursor.toISOString().split('T')[0]
    // Solo cuentan días hábiles ya transcurridos (no contamos días futuros como ausencia).
    if (iso <= hoy && esDiaHabil(cursor, feriados) && !diasConRegistro.has(iso)) {
      const ausenciaCargada = registros.find(r => r.fecha === iso && r.estado === 'ausente')
      inasistencias.push({ fecha: iso, motivo: ausenciaCargada?.notas ?? null })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const partes = [`Periodo: ${periodo.etiqueta}`]
  if (tardanzas.length === 0) {
    partes.push('• No registrás tardanzas.')
  } else {
    partes.push(`• Tardanzas (${tardanzas.length}):`)
    for (const t of tardanzas) {
      partes.push(`  - ${formatoFechaCortaPeriodo(t.fecha)}: ${t.puntualidad_min ?? 0} min tarde`)
    }
  }
  if (inasistencias.length === 0) {
    partes.push('• No registrás inasistencias.')
  } else {
    partes.push(`• Inasistencias (${inasistencias.length}):`)
    for (const i of inasistencias) {
      partes.push(`  - ${formatoFechaCortaPeriodo(i.fecha)}${i.motivo ? ` (${i.motivo})` : ''}`)
    }
  }

  return {
    exito: true,
    datos: {
      periodo,
      tardanzas,
      inasistencias,
    },
    mensaje_usuario: partes.join('\n'),
  }
}
