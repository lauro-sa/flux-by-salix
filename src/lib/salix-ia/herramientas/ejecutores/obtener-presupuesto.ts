/**
 * Ejecutor: obtener_presupuesto
 * Obtiene datos completos de un presupuesto: encabezado, líneas/productos, totales, cuotas.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarObtenerPresupuesto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const visibilidad = determinarVisibilidad(ctx.miembro, 'presupuestos')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver presupuestos' }
  }

  let presupuesto_id = params.presupuesto_id as string

  // Si no hay ID, buscar por número
  if (!presupuesto_id && params.numero) {
    const { data: encontrado } = await ctx.admin
      .from('presupuestos')
      .select('id')
      .eq('empresa_id', ctx.empresa_id)
      .ilike('numero', `%${params.numero}%`)
      .limit(1)
      .single()

    if (encontrado) {
      presupuesto_id = encontrado.id
    }
  }

  if (!presupuesto_id) {
    return { exito: false, error: 'Se requiere el ID o número del presupuesto' }
  }

  // Obtener presupuesto
  let query = ctx.admin
    .from('presupuestos')
    .select(`
      id, numero, estado, moneda, referencia,
      contacto_id, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono, contacto_direccion,
      subtotal_neto, total_impuestos, descuento_global, descuento_global_monto, total_final,
      condicion_pago_label, condicion_pago_tipo,
      fecha_emision, fecha_vencimiento, fecha_aceptacion,
      notas_html, condiciones_html,
      creado_por_nombre, creado_en, actualizado_en
    `)
    .eq('id', presupuesto_id)
    .eq('empresa_id', ctx.empresa_id)

  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  const { data: presupuesto, error } = await query.single()

  if (error || !presupuesto) {
    return { exito: false, error: 'Presupuesto no encontrado' }
  }

  // Obtener líneas del presupuesto (productos, secciones, notas, descuentos)
  const { data: lineas } = await ctx.admin
    .from('lineas_presupuesto')
    .select('tipo_linea, codigo_producto, descripcion, descripcion_detalle, cantidad, unidad, precio_unitario, descuento, impuesto_label, impuesto_porcentaje, subtotal, impuesto_monto, total, monto, orden')
    .eq('presupuesto_id', presupuesto_id)
    .eq('empresa_id', ctx.empresa_id)
    .order('orden', { ascending: true })

  // Obtener cuotas si hay plan de pago
  const { data: cuotas } = await ctx.admin
    .from('presupuesto_cuotas')
    .select('numero, descripcion, porcentaje, monto, estado, dias_desde_emision')
    .eq('presupuesto_id', presupuesto_id)
    .eq('empresa_id', ctx.empresa_id)
    .order('numero', { ascending: true })

  // Formatear líneas para el mensaje
  const contacto = [presupuesto.contacto_nombre, presupuesto.contacto_apellido].filter(Boolean).join(' ')
  const lineasProducto = (lineas || []).filter((l: { tipo_linea: string }) => l.tipo_linea === 'producto')

  const partes: string[] = [
    `*Presupuesto ${presupuesto.numero}*`,
    `👤 ${contacto}${presupuesto.contacto_direccion ? ` — ${presupuesto.contacto_direccion}` : ''}`,
    `📊 Estado: *${presupuesto.estado}*`,
    `💰 Total: *$${Number(presupuesto.total_final).toLocaleString('es')} ${presupuesto.moneda}*`,
    '',
  ]

  if (presupuesto.referencia) {
    partes.splice(2, 0, `📝 Ref: ${presupuesto.referencia}`)
  }

  // Líneas/productos
  if (lineasProducto.length > 0) {
    partes.push(`*Productos/Servicios (${lineasProducto.length}):*`)
    for (const l of lineasProducto) {
      const linea = l as { descripcion: string; cantidad: number; precio_unitario: number; total: number; unidad: string | null; descuento: number }
      let txt = `• ${linea.descripcion}`
      txt += ` — ${linea.cantidad}${linea.unidad ? ` ${linea.unidad}` : ''} × $${Number(linea.precio_unitario).toLocaleString('es')}`
      if (linea.descuento > 0) txt += ` (-${linea.descuento}%)`
      txt += ` = *$${Number(linea.total).toLocaleString('es')}*`
      partes.push(txt)
    }
    partes.push('')
  }

  // Totales
  partes.push(`Subtotal: $${Number(presupuesto.subtotal_neto).toLocaleString('es')}`)
  if (Number(presupuesto.descuento_global) > 0) {
    partes.push(`Descuento: -${presupuesto.descuento_global}% ($${Number(presupuesto.descuento_global_monto).toLocaleString('es')})`)
  }
  if (Number(presupuesto.total_impuestos) > 0) {
    partes.push(`Impuestos: $${Number(presupuesto.total_impuestos).toLocaleString('es')}`)
  }
  partes.push(`*Total: $${Number(presupuesto.total_final).toLocaleString('es')} ${presupuesto.moneda}*`)

  // Cuotas
  if (cuotas && cuotas.length > 0) {
    partes.push('')
    partes.push(`*Plan de pago (${cuotas.length} cuotas):*`)
    for (const c of cuotas) {
      const cuota = c as { numero: number; descripcion: string | null; porcentaje: number; monto: number; estado: string }
      partes.push(`${cuota.numero}. ${cuota.descripcion || `Cuota ${cuota.numero}`} — $${Number(cuota.monto).toLocaleString('es')} (${cuota.porcentaje}%) _${cuota.estado}_`)
    }
  }

  // Fechas
  partes.push('')
  if (presupuesto.fecha_emision) {
    partes.push(`📅 Emitido: ${new Date(presupuesto.fecha_emision as string).toLocaleDateString('es', { timeZone: ctx.zona_horaria || 'America/Argentina/Buenos_Aires' })}`)
  }
  if (presupuesto.fecha_vencimiento) {
    partes.push(`⏰ Vence: ${new Date(presupuesto.fecha_vencimiento as string).toLocaleDateString('es', { timeZone: ctx.zona_horaria || 'America/Argentina/Buenos_Aires' })}`)
  }
  if (presupuesto.condicion_pago_label) {
    partes.push(`💳 Condición: ${presupuesto.condicion_pago_label}`)
  }

  return {
    exito: true,
    datos: {
      ...presupuesto,
      contacto_nombre_completo: contacto,
      lineas: lineas || [],
      cuotas: cuotas || [],
    },
    mensaje_usuario: partes.join('\n'),
  }
}
