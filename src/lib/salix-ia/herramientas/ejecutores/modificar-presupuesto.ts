/**
 * Ejecutor: modificar_presupuesto
 * Modifica el estado de un presupuesto: enviar, aceptar, rechazar, cancelar, etc.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

const ESTADOS_PRESUPUESTO = ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido', 'cancelado']

// Transiciones válidas de estado
const TRANSICIONES: Record<string, string[]> = {
  borrador: ['enviado', 'cancelado'],
  enviado: ['aceptado', 'rechazado', 'cancelado'],
  aceptado: ['cancelado'],
  rechazado: ['borrador', 'cancelado'],
  vencido: ['borrador', 'cancelado'],
  cancelado: ['borrador'],
}

export async function ejecutarModificarPresupuesto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const presupuesto_id = params.presupuesto_id as string
  if (!presupuesto_id) {
    return { exito: false, error: 'Se requiere el ID del presupuesto' }
  }

  const { data: presupuesto, error: errorBusca } = await ctx.admin
    .from('presupuestos')
    .select('id, numero, estado, contacto_nombre, contacto_apellido, total_final, moneda')
    .eq('id', presupuesto_id)
    .eq('empresa_id', ctx.empresa_id)
    .single()

  if (errorBusca || !presupuesto) {
    return { exito: false, error: 'Presupuesto no encontrado' }
  }

  const nuevoEstado = params.estado as string
  if (!nuevoEstado) {
    return { exito: false, error: `El presupuesto ${presupuesto.numero} está en estado "${presupuesto.estado}". ¿A qué estado querés cambiarlo?` }
  }

  if (!ESTADOS_PRESUPUESTO.includes(nuevoEstado)) {
    return { exito: false, error: `Estado "${nuevoEstado}" no válido. Disponibles: ${ESTADOS_PRESUPUESTO.join(', ')}` }
  }

  // Validar transición
  const transicionesPermitidas = TRANSICIONES[presupuesto.estado as string] || []
  if (!transicionesPermitidas.includes(nuevoEstado)) {
    return {
      exito: false,
      error: `No se puede pasar de "${presupuesto.estado}" a "${nuevoEstado}". Transiciones válidas desde "${presupuesto.estado}": ${transicionesPermitidas.join(', ') || 'ninguna'}.`,
    }
  }

  const { error } = await ctx.admin
    .from('presupuestos')
    .update({
      estado: nuevoEstado,
      editado_por: ctx.usuario_id,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', presupuesto_id)

  if (error) {
    return { exito: false, error: `Error modificando presupuesto: ${error.message}` }
  }

  const contacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')

  return {
    exito: true,
    datos: { id: presupuesto_id, numero: presupuesto.numero, estado_anterior: presupuesto.estado, estado_nuevo: nuevoEstado },
    mensaje_usuario: `Presupuesto ${presupuesto.numero} (${contacto}) cambiado de "${presupuesto.estado}" a "${nuevoEstado}".`,
  }
}
