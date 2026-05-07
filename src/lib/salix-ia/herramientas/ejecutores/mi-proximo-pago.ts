/**
 * Ejecutor: mi_proximo_pago
 *
 * Devuelve el rango de días hábiles posibles para el próximo cobro del propio
 * empleado. Resuelve automáticamente el periodo relevante:
 *  - Si el último cerrado está pendiente de pago → ese es el próximo cobro.
 *  - Si ya está pagado → el próximo cobro corresponde al periodo en curso (cierra después).
 *
 * Considera fines de semana y feriados (oficiales del país + tabla `feriados`).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { obtenerMiembroPersonal } from '@/lib/salix-ia/helpers-personal'
import { periodoRelevante } from '@/lib/asistencias/periodo-relevante'
import { calcularRangoPagoHabiles } from '@/lib/asistencias/dias-habiles'
import { formatoFechaCortaPeriodo } from '@/lib/asistencias/periodo-actual'

const DIAS_HABILES_PAGO_DEFAULT = 3

export async function ejecutarMiProximoPago(
  ctx: ContextoSalixIA,
): Promise<ResultadoHerramienta> {
  const miembro = await obtenerMiembroPersonal(ctx)
  if (!miembro) {
    return { exito: false, error: 'No encontré tus datos de miembro activo en esta empresa.' }
  }

  // Resolver el periodo relevante (último cerrado pendiente de pago vs. en curso).
  const { rango, estado } = await periodoRelevante(ctx.admin, {
    id: miembro.id,
    compensacion_frecuencia: miembro.compensacion_frecuencia,
  })

  // Calcular el rango de días hábiles disponibles a partir del cierre del periodo.
  const fechaCierre = new Date(rango.hasta + 'T12:00:00Z')
  const rangoPago = await calcularRangoPagoHabiles(
    ctx.admin,
    ctx.empresa_id,
    fechaCierre,
    DIAS_HABILES_PAGO_DEFAULT,
  )

  const desdeCorto = formatoFechaCortaPeriodo(rangoPago.desde)
  const hastaCorto = formatoFechaCortaPeriodo(rangoPago.hasta)
  const cierreCorto = formatoFechaCortaPeriodo(rango.hasta)

  const introduccion = estado === 'cerrado_pendiente_pago'
    ? `El periodo ${rango.etiqueta} cerró el ${cierreCorto}.`
    : `El periodo ${rango.etiqueta} cierra el ${cierreCorto}.`

  const mensaje = rangoPago.fechas.length > 0
    ? `${introduccion} Vas a cobrar entre el ${desdeCorto} y el ${hastaCorto} (los primeros ${DIAS_HABILES_PAGO_DEFAULT} días hábiles después del cierre).`
    : `${introduccion} No pude calcular el rango exacto de pago. Consultá con tu administrador.`

  return {
    exito: true,
    datos: {
      periodo: rango,
      estado,
      rango_pago: rangoPago,
      dias_habiles_pago: DIAS_HABILES_PAGO_DEFAULT,
    },
    mensaje_usuario: mensaje,
  }
}
