import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'

/**
 * GET /api/dashboard — Estadísticas completas para la página de inicio.
 * Retorna métricas clave, pipeline de ventas, crecimiento de contactos,
 * actividades por persona, productos top, presupuestos por vencer y asistencia.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Fechas de referencia
    const hoy = new Date()
    const hace12Semanas = new Date(hoy)
    hace12Semanas.setDate(hace12Semanas.getDate() - 84)
    const en7Dias = new Date(hoy)
    en7Dias.setDate(en7Dias.getDate() + 7)
    const hoyStr = hoy.toISOString().split('T')[0]
    const inicioSemana = new Date(hoy)
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1) // Lunes

    // Ejecutar todas las consultas en paralelo
    const [
      resContactos,
      resPresupuestos,
      resConversaciones,
      resMensajesSinLeer,
      resPresupuestosRecientes,
      resContactosRecientes,
      resActividadesPendientes,
      resActividadesTotal,
      // ─── Nuevas consultas ───
      resPipelineMontos,
      resContactosCrecimiento,
      resActividadesCompletadasHoy,
      resActividadesPorPersona,
      resProductosTop,
      resPresupuestosPorVencer,
      resAsistenciaHoy,
      resAsistenciaSemana,
      resIngresosConfirmados,
      resHistoricoPresupuestos,
      resHistoricoContactos,
      resPresupuestosConContacto,
      resContactosConTipo,
    ] = await Promise.all([
      // ─── Consultas originales ───

      // Total de contactos
      admin
        .from('contactos')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId),

      // Presupuestos por estado
      admin
        .from('presupuestos')
        .select('estado')
        .eq('empresa_id', empresaId),

      // Conversaciones abiertas
      admin
        .from('conversaciones')
        .select('id, estado, tipo_canal', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .in('estado', ['abierta', 'en_espera']),

      // Mensajes sin leer
      admin
        .from('conversaciones')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .gt('no_leidos', 0),

      // Últimos 5 presupuestos
      admin
        .from('presupuestos')
        .select('id, numero, estado, contacto_nombre, contacto_apellido, total, creado_en')
        .eq('empresa_id', empresaId)
        .order('creado_en', { ascending: false })
        .limit(5),

      // Últimos 5 contactos creados
      admin
        .from('contactos')
        .select('id, nombre, apellido, correo, telefono, creado_en')
        .eq('empresa_id', empresaId)
        .order('creado_en', { ascending: false })
        .limit(5),

      // Actividades pendientes
      admin
        .from('actividades')
        .select('id, titulo, tipo_clave, estado_clave, prioridad, fecha_vencimiento, asignado_nombre')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado_clave', ['pendiente', 'vencida'])
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
        .limit(8),

      // Total actividades pendientes
      admin
        .from('actividades')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado_clave', ['pendiente', 'vencida']),

      // ─── Pipeline: presupuestos con montos por estado ───
      admin
        .from('presupuestos')
        .select('estado, total_final')
        .eq('empresa_id', empresaId),

      // ─── Crecimiento contactos: últimas 12 semanas ───
      admin
        .from('contactos')
        .select('creado_en')
        .eq('empresa_id', empresaId)
        .gte('creado_en', hace12Semanas.toISOString()),

      // ─── Actividades completadas hoy ───
      admin
        .from('actividades')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .eq('estado_clave', 'completada')
        .gte('fecha_completada', hoyStr),

      // ─── Actividades por persona (pendientes + completadas recientes) ───
      admin
        .from('actividades')
        .select('asignado_nombre, estado_clave')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado_clave', ['pendiente', 'vencida', 'completada']),

      // ─── Productos más cotizados (top 8) ───
      admin
        .from('productos')
        .select('id, nombre, tipo, precio_unitario, veces_presupuestado, veces_vendido')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .gt('veces_presupuestado', 0)
        .order('veces_presupuestado', { ascending: false })
        .limit(8),

      // ─── Presupuestos por vencer (enviados, vencen en próximos 7 días) ───
      admin
        .from('presupuestos')
        .select('id, numero, estado, contacto_nombre, contacto_apellido, total, fecha_vencimiento')
        .eq('empresa_id', empresaId)
        .eq('estado', 'enviado')
        .gte('fecha_vencimiento', hoyStr)
        .lte('fecha_vencimiento', en7Dias.toISOString().split('T')[0])
        .order('fecha_vencimiento', { ascending: true })
        .limit(10),

      // ─── Asistencia de hoy ───
      admin
        .from('asistencias')
        .select('miembro_id, estado, hora_entrada, hora_salida')
        .eq('empresa_id', empresaId)
        .eq('fecha', hoyStr),

      // ─── Asistencia de la semana ───
      admin
        .from('asistencias')
        .select('miembro_id, estado, fecha')
        .eq('empresa_id', empresaId)
        .gte('fecha', inicioSemana.toISOString().split('T')[0])
        .lte('fecha', hoyStr),

      // ─── Ingresos: presupuestos confirmados/orden_venta con fecha y monto ───
      admin
        .from('presupuestos')
        .select('estado, total_final, fecha_emision, creado_en')
        .eq('empresa_id', empresaId)
        .in('estado', ['confirmado_cliente', 'orden_venta']),

      // ─── Histórico presupuestos: todos con fecha para comparativa ───
      admin
        .from('presupuestos')
        .select('estado, total_final, creado_en')
        .eq('empresa_id', empresaId),

      // ─── Histórico contactos: todos con fecha de creación ───
      admin
        .from('contactos')
        .select('creado_en')
        .eq('empresa_id', empresaId),

      // ─── Clientes activos: contactos que tienen presupuestos, con tipo ───
      admin
        .from('presupuestos')
        .select('contacto_id, creado_en, estado')
        .eq('empresa_id', empresaId)
        .not('contacto_id', 'is', null),

      // ─── Contactos con su tipo (para cruzar con presupuestos) ───
      admin
        .from('contactos')
        .select('id, tipo_contacto:tipos_contacto(clave, etiqueta), creado_en')
        .eq('empresa_id', empresaId),
    ])

    // ─── Procesar datos originales ───

    const presupuestosPorEstado: Record<string, number> = {}
    for (const p of resPresupuestos.data || []) {
      presupuestosPorEstado[p.estado] = (presupuestosPorEstado[p.estado] || 0) + 1
    }

    const conversacionesPorCanal: Record<string, number> = {}
    for (const c of resConversaciones.data || []) {
      conversacionesPorCanal[c.tipo_canal] = (conversacionesPorCanal[c.tipo_canal] || 0) + 1
    }

    // ─── Pipeline de ventas: montos por estado ───
    const pipelineMontos: Record<string, number> = {}
    for (const p of resPipelineMontos.data || []) {
      const monto = parseFloat(p.total_final) || 0
      pipelineMontos[p.estado] = (pipelineMontos[p.estado] || 0) + monto
    }

    // ─── Crecimiento contactos por semana ───
    const contactosPorSemana: Array<{ semana: string; cantidad: number }> = []
    const mapaSemanasContactos: Record<string, number> = {}
    for (const c of resContactosCrecimiento.data || []) {
      const fecha = new Date(c.creado_en)
      // Obtener lunes de esa semana
      const lunes = new Date(fecha)
      lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
      const clave = lunes.toISOString().split('T')[0]
      mapaSemanasContactos[clave] = (mapaSemanasContactos[clave] || 0) + 1
    }
    // Generar 12 semanas completas
    for (let i = 11; i >= 0; i--) {
      const lunes = new Date(hoy)
      lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) - i * 7)
      const clave = lunes.toISOString().split('T')[0]
      contactosPorSemana.push({
        semana: clave,
        cantidad: mapaSemanasContactos[clave] || 0,
      })
    }

    // ─── Actividades por persona ───
    const mapaPersonas: Record<string, { pendientes: number; completadas: number }> = {}
    for (const a of resActividadesPorPersona.data || []) {
      const nombre = a.asignado_nombre || 'Sin asignar'
      if (!mapaPersonas[nombre]) mapaPersonas[nombre] = { pendientes: 0, completadas: 0 }
      if (a.estado_clave === 'completada') {
        mapaPersonas[nombre].completadas++
      } else {
        mapaPersonas[nombre].pendientes++
      }
    }
    const actividadesPorPersona = Object.entries(mapaPersonas)
      .map(([nombre, datos]) => ({ nombre, ...datos }))
      .sort((a, b) => b.pendientes - a.pendientes)
      .slice(0, 8)

    // ─── Asistencia hoy resumen ───
    const asistenciaHoy = { presentes: 0, ausentes: 0, tardanzas: 0, total: 0 }
    for (const a of resAsistenciaHoy.data || []) {
      asistenciaHoy.total++
      if (a.estado === 'presente') asistenciaHoy.presentes++
      else if (a.estado === 'ausente') asistenciaHoy.ausentes++
      else if (a.estado === 'tardanza') asistenciaHoy.tardanzas++
    }

    // ─── Asistencia semana por persona ───
    const mapaAsistenciaSemana: Record<string, { presentes: number; ausentes: number; tardanzas: number }> = {}
    for (const a of resAsistenciaSemana.data || []) {
      const id = a.miembro_id
      if (!mapaAsistenciaSemana[id]) mapaAsistenciaSemana[id] = { presentes: 0, ausentes: 0, tardanzas: 0 }
      if (a.estado === 'presente') mapaAsistenciaSemana[id].presentes++
      else if (a.estado === 'ausente') mapaAsistenciaSemana[id].ausentes++
      else if (a.estado === 'tardanza') mapaAsistenciaSemana[id].tardanzas++
    }

    // ─── Ingresos por mes — separando orden_venta (100% cerrado) de confirmado_cliente ───
    const ingresosPorMes: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }> = {}
    for (const p of resIngresosConfirmados.data || []) {
      const fecha = new Date(p.fecha_emision || p.creado_en)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      if (!ingresosPorMes[clave]) ingresosPorMes[clave] = { cantidad: 0, monto: 0, ordenes_cantidad: 0, ordenes_monto: 0 }
      const monto = parseFloat(p.total_final) || 0
      ingresosPorMes[clave].cantidad++
      ingresosPorMes[clave].monto += monto
      if (p.estado === 'orden_venta') {
        ingresosPorMes[clave].ordenes_cantidad++
        ingresosPorMes[clave].ordenes_monto += monto
      }
    }

    // Ingresos por año
    const ingresosPorAnio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }> = {}
    for (const p of resIngresosConfirmados.data || []) {
      const fecha = new Date(p.fecha_emision || p.creado_en)
      const anio = String(fecha.getFullYear())
      if (!ingresosPorAnio[anio]) ingresosPorAnio[anio] = { cantidad: 0, monto: 0, ordenes_cantidad: 0, ordenes_monto: 0 }
      const monto = parseFloat(p.total_final) || 0
      ingresosPorAnio[anio].cantidad++
      ingresosPorAnio[anio].monto += monto
      if (p.estado === 'orden_venta') {
        ingresosPorAnio[anio].ordenes_cantidad++
        ingresosPorAnio[anio].ordenes_monto += monto
      }
    }

    // ─── Comparativa interanual: presupuestos creados por mes-año ───
    const presupuestosPorMesAnio: Record<string, { creados: number; monto_total: number }> = {}
    for (const p of resHistoricoPresupuestos.data || []) {
      const fecha = new Date(p.creado_en)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      if (!presupuestosPorMesAnio[clave]) presupuestosPorMesAnio[clave] = { creados: 0, monto_total: 0 }
      presupuestosPorMesAnio[clave].creados++
      presupuestosPorMesAnio[clave].monto_total += parseFloat(p.total_final) || 0
    }

    // ─── Comparativa interanual: contactos creados por mes-año ───
    const contactosPorMesAnio: Record<string, number> = {}
    for (const c of resHistoricoContactos.data || []) {
      const fecha = new Date(c.creado_en)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      contactosPorMesAnio[clave] = (contactosPorMesAnio[clave] || 0) + 1
    }

    // ─── Clientes activos: contactos únicos con presupuestos, por tipo y mes ───
    // Mapa de contacto_id → tipo
    const mapaTipoContacto: Record<string, { clave: string; etiqueta: string }> = {}
    for (const c of resContactosConTipo.data || []) {
      // Supabase devuelve la relación como objeto o array según el join
      const raw = c.tipo_contacto as unknown
      const tipo = Array.isArray(raw) ? raw[0] : raw
      if (tipo && typeof tipo === 'object' && 'clave' in tipo) {
        mapaTipoContacto[c.id] = { clave: (tipo as { clave: string; etiqueta: string }).clave, etiqueta: (tipo as { clave: string; etiqueta: string }).etiqueta }
      }
    }

    // Clientes activos por tipo (total histórico — contactos únicos con al menos 1 presupuesto)
    const clientesActivosPorTipo: Record<string, { etiqueta: string; cantidad: number }> = {}
    const contactosConPresupuesto = new Set<string>()
    for (const p of resPresupuestosConContacto.data || []) {
      if (p.contacto_id) contactosConPresupuesto.add(p.contacto_id)
    }
    for (const id of contactosConPresupuesto) {
      const tipo = mapaTipoContacto[id]
      const clave = tipo?.clave || 'sin_tipo'
      const etiqueta = tipo?.etiqueta || 'Sin tipo'
      if (!clientesActivosPorTipo[clave]) clientesActivosPorTipo[clave] = { etiqueta, cantidad: 0 }
      clientesActivosPorTipo[clave].cantidad++
    }

    // Clientes nuevos por mes-año (primer presupuesto de cada contacto)
    const primerPresupuestoPorContacto: Record<string, string> = {} // contacto_id → fecha más antigua
    for (const p of resPresupuestosConContacto.data || []) {
      if (!p.contacto_id) continue
      if (!primerPresupuestoPorContacto[p.contacto_id] || p.creado_en < primerPresupuestoPorContacto[p.contacto_id]) {
        primerPresupuestoPorContacto[p.contacto_id] = p.creado_en
      }
    }

    // Nuevos clientes por mes (mes en que hicieron su primer presupuesto)
    const clientesNuevosPorMes: Record<string, Record<string, number>> = {} // "2026-03" → { empresa: 2, persona: 1 }
    for (const [contactoId, fechaPrimer] of Object.entries(primerPresupuestoPorContacto)) {
      const fecha = new Date(fechaPrimer)
      const claveMes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      const tipo = mapaTipoContacto[contactoId]?.clave || 'sin_tipo'
      if (!clientesNuevosPorMes[claveMes]) clientesNuevosPorMes[claveMes] = {}
      clientesNuevosPorMes[claveMes][tipo] = (clientesNuevosPorMes[claveMes][tipo] || 0) + 1
    }

    return NextResponse.json({
      contactos: {
        total: resContactos.count || 0,
        recientes: resContactosRecientes.data || [],
        crecimiento_semanal: contactosPorSemana,
      },
      presupuestos: {
        total: (resPresupuestos.data || []).length,
        por_estado: presupuestosPorEstado,
        recientes: resPresupuestosRecientes.data || [],
        pipeline_montos: pipelineMontos,
        por_vencer: resPresupuestosPorVencer.data || [],
      },
      conversaciones: {
        abiertas: resConversaciones.count || 0,
        por_canal: conversacionesPorCanal,
        sin_leer: resMensajesSinLeer.count || 0,
      },
      actividades: {
        pendientes: resActividadesPendientes.data || [],
        total_pendientes: resActividadesTotal.count || 0,
        completadas_hoy: resActividadesCompletadasHoy.count || 0,
        por_persona: actividadesPorPersona,
      },
      productos: {
        top: resProductosTop.data || [],
      },
      asistencia: {
        hoy: asistenciaHoy,
        semana: mapaAsistenciaSemana,
      },
      ingresos: {
        por_mes: ingresosPorMes,
        por_anio: ingresosPorAnio,
      },
      comparativa: {
        presupuestos_por_mes: presupuestosPorMesAnio,
        contactos_por_mes: contactosPorMesAnio,
      },
      clientes: {
        activos_por_tipo: clientesActivosPorTipo,
        total_activos: contactosConPresupuesto.size,
        nuevos_por_mes: clientesNuevosPorMes,
      },
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
