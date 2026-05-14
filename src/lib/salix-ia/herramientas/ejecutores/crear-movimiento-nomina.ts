/**
 * Ejecutor: crear_movimiento_nomina
 * Crea un adelanto o descuento para un empleado y genera las cuotas
 * programadas según la frecuencia indicada.
 *
 * Reglas:
 *  - Los descuentos siempre son de 1 sola cuota (no se entregaron al empleado,
 *    son penalidades/multas que se aplican al próximo recibo).
 *  - Los adelantos pueden ser de 1 o N cuotas.
 *  - La frecuencia es la cadencia con la que se descuentan las cuotas
 *    sucesivas del recibo (semanal/quincenal/mensual).
 *  - Requiere permiso 'nomina' + 'editar' (mismo nivel que el endpoint
 *    /api/adelantos POST).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { verificarPermiso } from '@/lib/permisos-servidor'
import type { Rol } from '@/tipos/miembro'

type Frecuencia = 'semanal' | 'quincenal' | 'mensual'

/** Calcula las fechas de cada cuota a partir de la fecha base + frecuencia. */
function calcularFechasCuotas(fechaInicio: string, cuotas: number, frecuencia: Frecuencia): string[] {
  const fechas: string[] = []
  const d = new Date(fechaInicio + 'T12:00:00')

  for (let i = 0; i < cuotas; i++) {
    fechas.push(d.toISOString().split('T')[0])
    if (frecuencia === 'semanal') d.setDate(d.getDate() + 7)
    else if (frecuencia === 'quincenal') d.setDate(d.getDate() + 15)
    else d.setMonth(d.getMonth() + 1)
  }

  return fechas
}

export async function ejecutarCrearMovimientoNomina(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  // Permiso: requiere 'nomina' + 'editar' (crear y editar comparten permiso aquí)
  const tienePermiso = verificarPermiso(
    { rol: ctx.miembro.rol as Rol, permisos_custom: ctx.miembro.permisos_custom },
    'nomina',
    'editar'
  )
  if (!tienePermiso) {
    return { exito: false, error: 'No tenés permiso para crear adelantos ni descuentos de nómina.' }
  }

  // ─── Resolver miembro objetivo ───
  let miembro_id = (params.miembro_id as string)?.trim()
  const busquedaMiembro = (params.busqueda_miembro as string)?.trim()

  if (!miembro_id && !busquedaMiembro) {
    return { exito: false, error: 'Se requiere miembro_id o busqueda_miembro (nombre del empleado).' }
  }

  let nombreMiembro = ''

  if (!miembro_id && busquedaMiembro) {
    const palabras = busquedaMiembro.split(/\s+/).filter(p => p.length >= 2)
    const { data: miembros } = await ctx.admin
      .from('miembros')
      .select('id, perfiles:perfil_id(nombre, apellido)')
      .eq('empresa_id', ctx.empresa_id)
      .eq('activo', true)
      .limit(20)

    const lista = (miembros || []) as Array<{ id: string; perfiles: { nombre: string; apellido: string | null } | null }>
    const candidatos = lista.filter(m => {
      const nombreCompleto = `${m.perfiles?.nombre || ''} ${m.perfiles?.apellido || ''}`.toLowerCase()
      return palabras.every(p => nombreCompleto.includes(p.toLowerCase()))
    })

    if (candidatos.length === 0) {
      return { exito: false, error: `No encontré un empleado con "${busquedaMiembro}".` }
    }
    if (candidatos.length > 1) {
      const nombres = candidatos.map(c => `${c.perfiles?.nombre} ${c.perfiles?.apellido || ''}`).join(', ')
      return {
        exito: false,
        error: `Encontré varios empleados con "${busquedaMiembro}": ${nombres}. Especificá nombre y apellido.`,
      }
    }
    miembro_id = candidatos[0].id
    nombreMiembro = [candidatos[0].perfiles?.nombre, candidatos[0].perfiles?.apellido].filter(Boolean).join(' ')
  } else {
    // Tenemos id, busquemos el nombre para el mensaje final
    const { data: m } = await ctx.admin
      .from('miembros')
      .select('id, perfiles:perfil_id(nombre, apellido)')
      .eq('id', miembro_id)
      .eq('empresa_id', ctx.empresa_id)
      .maybeSingle()
    if (!m) {
      return { exito: false, error: 'El miembro indicado no existe en esta empresa.' }
    }
    const perf = (m as { perfiles: { nombre: string; apellido: string | null } | null }).perfiles
    nombreMiembro = [perf?.nombre, perf?.apellido].filter(Boolean).join(' ')
  }

  // ─── Validar y normalizar parámetros ───
  const tipoParam = ((params.tipo as string) || 'adelanto').toLowerCase()
  const tipo: 'adelanto' | 'descuento' = tipoParam === 'descuento' ? 'descuento' : 'adelanto'

  const monto = Number(params.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    return { exito: false, error: 'El monto debe ser un número mayor a 0.' }
  }

  // Descuentos siempre en 1 cuota (no se entregaron, se aplican de una)
  const cuotasParam = Number(params.cuotas)
  const cuotas = tipo === 'descuento' ? 1 : Math.max(1, Math.floor(Number.isFinite(cuotasParam) ? cuotasParam : 1))

  const frecuenciaParam = (params.frecuencia as string)?.toLowerCase()
  const frecuencia: Frecuencia =
    frecuenciaParam === 'semanal' || frecuenciaParam === 'quincenal' ? frecuenciaParam : 'mensual'

  const hoyISO = new Date().toISOString().split('T')[0]
  const fechaSolicitud = (params.fecha_solicitud as string)?.trim() || hoyISO
  const fechaInicioDescuento = (params.fecha_inicio_descuento as string)?.trim() || fechaSolicitud
  const descripcion = (params.descripcion as string)?.trim() || null

  // ─── Obtener nombre del creador ───
  const { data: perfilCreador } = await ctx.admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', ctx.usuario_id)
    .maybeSingle()
  const nombreCreador = perfilCreador
    ? `${perfilCreador.nombre} ${perfilCreador.apellido || ''}`.trim()
    : 'Salix IA'

  // ─── Insertar adelanto/descuento ───
  const { data: adelanto, error: errAdelanto } = await ctx.admin
    .from('adelantos_nomina')
    .insert({
      empresa_id: ctx.empresa_id,
      miembro_id,
      tipo,
      monto_total: String(monto),
      cuotas_totales: cuotas,
      cuotas_descontadas: 0,
      saldo_pendiente: String(monto),
      frecuencia_descuento: frecuencia,
      fecha_solicitud: fechaSolicitud,
      fecha_inicio_descuento: fechaInicioDescuento,
      estado: 'activo',
      notas: descripcion,
      creado_por: ctx.usuario_id,
      creado_por_nombre: nombreCreador,
    })
    .select('id')
    .single()

  if (errAdelanto || !adelanto) {
    return { exito: false, error: `Error creando movimiento: ${errAdelanto?.message || 'desconocido'}` }
  }

  // ─── Generar cuotas (última absorbe diferencia de redondeo) ───
  const montoCuota = Math.round((monto / cuotas) * 100) / 100
  const fechas = calcularFechasCuotas(fechaInicioDescuento, cuotas, frecuencia)

  const cuotasData = fechas.map((fecha, idx) => {
    const esUltima = idx === cuotas - 1
    const montoEsta = esUltima
      ? Math.round((monto - montoCuota * (cuotas - 1)) * 100) / 100
      : montoCuota
    return {
      adelanto_id: adelanto.id,
      empresa_id: ctx.empresa_id,
      miembro_id,
      numero_cuota: idx + 1,
      monto_cuota: String(montoEsta),
      fecha_programada: fecha,
      estado: 'pendiente',
    }
  })

  const { error: errCuotas } = await ctx.admin.from('adelantos_cuotas').insert(cuotasData)

  if (errCuotas) {
    // Rollback: eliminar el adelanto huérfano
    await ctx.admin.from('adelantos_nomina').delete().eq('id', adelanto.id)
    return { exito: false, error: `Error generando cuotas: ${errCuotas.message}` }
  }

  // ─── Mensaje al usuario ───
  const tipoTexto = tipo === 'adelanto' ? 'Adelanto' : 'Descuento'
  const cuotasTexto = cuotas === 1 ? '1 cuota' : `${cuotas} cuotas ${frecuencia}es`
  const descTexto = descripcion ? `\n📝 ${descripcion}` : ''

  return {
    exito: true,
    datos: { adelanto_id: adelanto.id, miembro_id, tipo, monto, cuotas, frecuencia },
    mensaje_usuario:
      `✅ ${tipoTexto} de *$${monto.toLocaleString('es-AR')}* registrado para *${nombreMiembro}*.\n\n` +
      `📅 ${cuotasTexto} desde ${fechaInicioDescuento}` +
      descTexto,
  }
}
