/**
 * Ejecutor: mi_periodo_actual
 *
 * Devuelve el resumen del periodo en curso del propio empleado: días trabajados,
 * días laborables hasta hoy, ausencias y tardanzas. Lectura directa sobre
 * `asistencias` filtrando por `miembro_id` propio.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { obtenerMiembroPersonal } from '@/lib/salix-ia/helpers-personal'
import { periodoActual } from '@/lib/asistencias/periodo-actual'
import { cargarFeriados, esDiaHabil } from '@/lib/asistencias/dias-habiles'

interface AsistenciaRow {
  fecha: string
  estado: string
  tipo: string
  puntualidad_min: number | null
}

export async function ejecutarMiPeriodoActual(
  ctx: ContextoSalixIA,
): Promise<ResultadoHerramienta> {
  const miembro = await obtenerMiembroPersonal(ctx)
  if (!miembro) {
    return { exito: false, error: 'No encontré tus datos de miembro activo en esta empresa.' }
  }

  const periodo = periodoActual(miembro.compensacion_frecuencia)

  // Asistencias del periodo (solo hasta hoy — no tiene sentido contar futuras).
  const hoyIso = new Date().toISOString().split('T')[0]
  const hasta = hoyIso < periodo.hasta ? hoyIso : periodo.hasta

  const { data, error } = await ctx.admin
    .from('asistencias')
    .select('fecha, estado, tipo, puntualidad_min')
    .eq('empresa_id', ctx.empresa_id)
    .eq('miembro_id', miembro.id)
    .gte('fecha', periodo.desde)
    .lte('fecha', hasta)

  if (error) {
    return { exito: false, error: `No pude leer tu asistencia del periodo: ${error.message}` }
  }

  const registros = (data || []) as AsistenciaRow[]

  // Días laborables transcurridos: lunes-viernes hábiles entre periodo.desde y hasta.
  const inicio = new Date(periodo.desde + 'T12:00:00Z')
  const fin = new Date(hasta + 'T12:00:00Z')
  const feriados = await cargarFeriados(ctx.admin, ctx.empresa_id, inicio, fin)

  let diasLaborables = 0
  const cursor = new Date(inicio)
  while (cursor <= fin) {
    if (esDiaHabil(cursor, feriados)) diasLaborables++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const diasTrabajados = registros.filter(r => r.estado !== 'ausente').length
  const tardanzas = registros.filter(r => r.tipo === 'tardanza' || (r.puntualidad_min ?? 0) > 0).length
  const ausencias = Math.max(0, diasLaborables - diasTrabajados)

  const partes = [
    `Periodo en curso: ${periodo.etiqueta}`,
    `• Días trabajados: ${diasTrabajados} / ${diasLaborables} laborables hasta hoy`,
    `• Tardanzas: ${tardanzas}`,
    `• Ausencias: ${ausencias}`,
  ]

  return {
    exito: true,
    datos: {
      periodo,
      dias_trabajados: diasTrabajados,
      dias_laborables_hasta_hoy: diasLaborables,
      tardanzas,
      ausencias,
    },
    mensaje_usuario: partes.join('\n'),
  }
}
