import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'
import { resolverRangoFecha } from '@/lib/presets-fecha'

/**
 * GET /api/miembros/[id]/metricas
 *
 * Devuelve métricas operativas de un miembro: visitas, presupuestos, órdenes,
 * actividades, recorridos, contactos, mensajes WhatsApp y pagos cobrados.
 *
 * Para cada categoría:
 *   - acumulado: contadores históricos (sin filtro de fecha)
 *   - mes_actual / mes_anterior: para comparativa
 *   - serie_mensual: agrupada por mes
 *
 * Query params:
 *   - anio (opcional): si se pasa, devuelve enero-diciembre de ese año
 *   - meses (opcional, default 12): si NO hay anio, cantidad de meses hacia atrás
 *
 * El cálculo se hace en JS sobre filas mínimas (id + fecha + monto). Las queries
 * usan los índices de empresa_id+asignado_a/creado_por que los listados ya tienen.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { id: miembroId } = await params
    const admin = crearClienteAdmin()

    // Resolver el usuario_id del miembro (las FKs apuntan a auth.users.id, no a miembros.id)
    const { data: miembroDest } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!miembroDest) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Permiso: el propio miembro puede ver sus métricas; otros requieren usuarios:ver
    const esPropio = miembroDest.usuario_id === user.id
    if (!esPropio) {
      const datos = await obtenerDatosMiembro(user.id, empresaId)
      if (!datos || !verificarPermiso(datos, 'usuarios', 'ver')) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
    }

    // Sin usuario_id (empleado solo fichaje) → no hay métricas operativas
    if (!miembroDest.usuario_id) {
      return NextResponse.json({ sin_cuenta: true })
    }

    const usuarioId = miembroDest.usuario_id as string

    // Zona horaria de la empresa para cortes mes/día correctos
    const { data: empresa } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', empresaId)
      .maybeSingle()
    const zona = (empresa?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    const url = new URL(req.url)
    const anioParam = url.searchParams.get('anio')
    const ahora = new Date()

    // Resolver rango: si hay año específico, enero-diciembre; si no, últimos N meses
    const inicioMesActual = resolverRangoFecha('este_mes', ahora, zona).desde!
    const inicioMesAnterior = resolverRangoFecha('mes_pasado', ahora, zona).desde!
    const finMesAnterior = resolverRangoFecha('mes_pasado', ahora, zona).hasta!

    let inicioSerie: Date
    let finSerie: Date
    let mesesBase: string[]

    if (anioParam) {
      const anio = parseInt(anioParam, 10)
      // 1 enero al 31 dic del año pedido (en zona empresa)
      inicioSerie = new Date(`${anio}-01-01T00:00:00Z`)
      finSerie = new Date(`${anio}-12-31T23:59:59Z`)
      mesesBase = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`)
    } else {
      const mesesSerie = Math.min(Math.max(parseInt(url.searchParams.get('meses') || '12'), 1), 36)
      inicioSerie = (() => {
        const d = new Date(inicioMesActual)
        d.setUTCMonth(d.getUTCMonth() - (mesesSerie - 1))
        return d
      })()
      finSerie = ahora
      mesesBase = []
      for (let i = 0; i < mesesSerie; i++) {
        const d = new Date(inicioMesActual)
        d.setUTCMonth(d.getUTCMonth() - (mesesSerie - 1 - i))
        const partes = new Intl.DateTimeFormat('en-GB', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(d)
        const a = partes.find(p => p.type === 'year')?.value || ''
        const m = partes.find(p => p.type === 'month')?.value || ''
        mesesBase.push(`${a}-${m}`)
      }
    }

    // ─── Queries en paralelo: filas del rango visible ───
    const [
      visitas,
      presupuestos,
      ordenesAsignadas,
      actividadesCreadas,
      recorridos,
      pagos,
      mensajesWA,
    ] = await Promise.all([
      admin
        .from('visitas')
        .select('id, estado, fecha_programada, fecha_completada')
        .eq('empresa_id', empresaId)
        .eq('asignado_a', usuarioId)
        .eq('en_papelera', false)
        .gte('fecha_programada', inicioSerie.toISOString())
        .lte('fecha_programada', finSerie.toISOString())
        .limit(10000),

      admin
        .from('presupuestos')
        .select('id, estado, fecha_emision, total_final, fecha_aceptacion')
        .eq('empresa_id', empresaId)
        .eq('creado_por', usuarioId)
        .eq('en_papelera', false)
        .gte('fecha_emision', inicioSerie.toISOString())
        .lte('fecha_emision', finSerie.toISOString())
        .limit(10000),

      // Órdenes via tabla intermedia + join (filtra por fecha de creación)
      admin
        .from('asignados_orden_trabajo')
        .select('orden_trabajo_id, ordenes_trabajo!inner(id, estado, creado_en, fecha_inicio, fecha_fin_real, en_papelera)')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', usuarioId)
        .eq('ordenes_trabajo.en_papelera', false)
        .gte('ordenes_trabajo.creado_en', inicioSerie.toISOString())
        .lte('ordenes_trabajo.creado_en', finSerie.toISOString())
        .limit(10000),

      admin
        .from('actividades')
        .select('id, estado_clave, creado_en, fecha_completada')
        .eq('empresa_id', empresaId)
        .eq('creado_por', usuarioId)
        .eq('en_papelera', false)
        .gte('creado_en', inicioSerie.toISOString())
        .lte('creado_en', finSerie.toISOString())
        .limit(10000),

      admin
        .from('recorridos')
        .select('id, estado, fecha, total_visitas, visitas_completadas, distancia_total_km, duracion_total_min')
        .eq('empresa_id', empresaId)
        .eq('asignado_a', usuarioId)
        .gte('fecha', formatearFechaISO(inicioSerie))
        .lte('fecha', formatearFechaISO(finSerie))
        .limit(10000),

      // Pagos cobrados/registrados por el usuario (montos)
      admin
        .from('presupuesto_pagos')
        .select('id, fecha_pago, monto_en_moneda_presupuesto')
        .eq('empresa_id', empresaId)
        .eq('creado_por', usuarioId)
        .gte('fecha_pago', inicioSerie.toISOString())
        .lte('fecha_pago', finSerie.toISOString())
        .limit(10000),

      // Mensajes WhatsApp salientes del usuario (join con canales para filtrar tipo)
      admin
        .from('mensajes')
        .select('id, creado_en, conversaciones!inner(tipo_canal)')
        .eq('empresa_id', empresaId)
        .eq('remitente_id', usuarioId)
        .eq('es_entrante', false)
        .eq('es_nota_interna', false)
        .eq('conversaciones.tipo_canal', 'whatsapp')
        .gte('creado_en', inicioSerie.toISOString())
        .lte('creado_en', finSerie.toISOString())
        .limit(10000),
    ])

    // Conteos acumulados (sin rango de fecha) — head:true para no traer filas
    const [
      totalVisitas,
      totalVisitasCompletadas,
      totalPresupuestos,
      totalPresupuestosAceptados,
      totalOrdenes,
      totalOrdenesCompletadas,
      totalActividades,
      totalActividadesCompletadas,
      totalRecorridos,
      totalRecorridosCompletados,
      totalContactos,
      totalMensajesWA,
      totalPagos,
      sumaMontosPresupuestos,
      sumaPagosCobrados,
    ] = await Promise.all([
      contar(admin, 'visitas', { empresa_id: empresaId, asignado_a: usuarioId, en_papelera: false }),
      contar(admin, 'visitas', { empresa_id: empresaId, asignado_a: usuarioId, en_papelera: false, estado: 'completada' }),
      contar(admin, 'presupuestos', { empresa_id: empresaId, creado_por: usuarioId, en_papelera: false }),
      contar(admin, 'presupuestos', { empresa_id: empresaId, creado_por: usuarioId, en_papelera: false, estado: 'aceptado' }),
      contar(admin, 'asignados_orden_trabajo', { empresa_id: empresaId, usuario_id: usuarioId }),
      contarOrdenesCompletadas(admin, empresaId, usuarioId),
      contar(admin, 'actividades', { empresa_id: empresaId, creado_por: usuarioId, en_papelera: false }),
      contar(admin, 'actividades', { empresa_id: empresaId, creado_por: usuarioId, en_papelera: false, estado_clave: 'completada' }),
      contar(admin, 'recorridos', { empresa_id: empresaId, asignado_a: usuarioId }),
      contar(admin, 'recorridos', { empresa_id: empresaId, asignado_a: usuarioId, estado: 'completado' }),
      contar(admin, 'contactos', { empresa_id: empresaId, miembro_id: miembroId, en_papelera: false }),
      contarMensajesWA(admin, empresaId, usuarioId),
      contar(admin, 'presupuesto_pagos', { empresa_id: empresaId, creado_por: usuarioId }),
      sumarPresupuestosTotales(admin, empresaId, usuarioId),
      sumarPagosCobrados(admin, empresaId, usuarioId),
    ])

    // ─── Procesamiento de filas ───
    type FilaVisita = { id: string; estado: string; fecha_programada: string; fecha_completada: string | null }
    type FilaPresupuesto = { id: string; estado: string; fecha_emision: string; total_final: string | number; fecha_aceptacion: string | null }
    type FilaOrdenJoin = { orden_trabajo_id: string; ordenes_trabajo: { id: string; estado: string; creado_en: string; fecha_inicio: string | null; fecha_fin_real: string | null } | { id: string; estado: string; creado_en: string; fecha_inicio: string | null; fecha_fin_real: string | null }[] }
    type FilaOrden = { id: string; estado: string; creado_en: string; fecha_inicio: string | null; fecha_fin_real: string | null }
    type FilaActividad = { id: string; estado_clave: string; creado_en: string; fecha_completada: string | null }
    type FilaRecorrido = { id: string; estado: string; fecha: string; total_visitas: number; visitas_completadas: number; distancia_total_km: string | null; duracion_total_min: number | null }
    type FilaPago = { id: string; fecha_pago: string; monto_en_moneda_presupuesto: string | number }
    type FilaMensajeWA = { id: string; creado_en: string }

    const filasVisitas = (visitas.data || []) as FilaVisita[]
    const filasPresupuestos = (presupuestos.data || []) as FilaPresupuesto[]
    const filasOrdenes = ((ordenesAsignadas.data || []) as FilaOrdenJoin[]).map(f => {
      const ot = Array.isArray(f.ordenes_trabajo) ? f.ordenes_trabajo[0] : f.ordenes_trabajo
      return ot
    }).filter(Boolean) as FilaOrden[]
    const filasActividades = (actividadesCreadas.data || []) as FilaActividad[]
    const filasRecorridos = (recorridos.data || []) as FilaRecorrido[]
    const filasPagos = (pagos.data || []) as FilaPago[]
    const filasMensajesWA = (mensajesWA.data || []) as FilaMensajeWA[]

    // Helper: cae una fecha en el rango [desde, hasta]?
    const enRango = (fecha: string | null, desde: Date, hasta: Date) => {
      if (!fecha) return false
      const t = new Date(fecha).getTime()
      return t >= desde.getTime() && t <= hasta.getTime()
    }

    // Helper: clave 'YYYY-MM' en zona empresa
    const claveMes = (fechaISO: string): string => {
      const d = new Date(fechaISO)
      const partes = new Intl.DateTimeFormat('en-GB', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(d)
      const a = partes.find(p => p.type === 'year')?.value || ''
      const m = partes.find(p => p.type === 'month')?.value || ''
      return `${a}-${m}`
    }

    // Helper: horas trabajadas en una orden (fecha_fin_real - fecha_inicio en horas)
    const horasOrden = (o: FilaOrden): number => {
      if (!o.fecha_inicio || !o.fecha_fin_real) return 0
      const ms = new Date(o.fecha_fin_real).getTime() - new Date(o.fecha_inicio).getTime()
      return ms > 0 ? ms / (1000 * 60 * 60) : 0
    }

    // ─── Métricas: VISITAS ───
    const visitasMesActual = filasVisitas.filter(v => enRango(v.fecha_programada, inicioMesActual, ahora))
    const visitasMesAnterior = filasVisitas.filter(v => enRango(v.fecha_programada, inicioMesAnterior, finMesAnterior))
    const serieVisitas = construirSerie(mesesBase, filasVisitas, v => claveMes(v.fecha_programada), filas => ({
      total: filas.length,
      completadas: filas.filter(f => f.estado === 'completada').length,
    }))

    // ─── Métricas: PRESUPUESTOS ───
    const sumarMontos = (filas: FilaPresupuesto[]) => filas.reduce((acc, f) => acc + Number(f.total_final || 0), 0)
    const presupuestosMesActual = filasPresupuestos.filter(p => enRango(p.fecha_emision, inicioMesActual, ahora))
    const presupuestosMesAnterior = filasPresupuestos.filter(p => enRango(p.fecha_emision, inicioMesAnterior, finMesAnterior))
    const seriePresupuestos = construirSerie(mesesBase, filasPresupuestos, p => claveMes(p.fecha_emision), filas => ({
      total: filas.length,
      aceptados: filas.filter(f => f.estado === 'aceptado').length,
      monto: sumarMontos(filas),
      monto_aceptado: sumarMontos(filas.filter(f => f.estado === 'aceptado')),
    }))

    // ─── Métricas: ÓRDENES ───
    const ordenesMesActual = filasOrdenes.filter(o => enRango(o.creado_en, inicioMesActual, ahora))
    const ordenesMesAnterior = filasOrdenes.filter(o => enRango(o.creado_en, inicioMesAnterior, finMesAnterior))
    const sumarHoras = (filas: FilaOrden[]) => filas.reduce((acc, o) => acc + horasOrden(o), 0)
    const serieOrdenes = construirSerie(mesesBase, filasOrdenes, o => claveMes(o.creado_en), filas => ({
      total: filas.length,
      completadas: filas.filter(f => f.estado === 'completada').length,
      horas: redondear1(sumarHoras(filas)),
    }))

    // ─── Métricas: ACTIVIDADES ───
    const actividadesMesActual = filasActividades.filter(a => enRango(a.creado_en, inicioMesActual, ahora))
    const actividadesMesAnterior = filasActividades.filter(a => enRango(a.creado_en, inicioMesAnterior, finMesAnterior))
    const serieActividades = construirSerie(mesesBase, filasActividades, a => claveMes(a.creado_en), filas => ({
      total: filas.length,
      completadas: filas.filter(f => f.estado_clave === 'completada').length,
    }))

    // ─── Métricas: RECORRIDOS ───
    const recorridosMesActual = filasRecorridos.filter(r => fechaSimpleEnRango(r.fecha, inicioMesActual, ahora))
    const recorridosMesAnterior = filasRecorridos.filter(r => fechaSimpleEnRango(r.fecha, inicioMesAnterior, finMesAnterior))
    const sumarKm = (filas: FilaRecorrido[]) => filas.reduce((acc, f) => acc + Number(f.distancia_total_km || 0), 0)
    const sumarMin = (filas: FilaRecorrido[]) => filas.reduce((acc, f) => acc + Number(f.duracion_total_min || 0), 0)
    const sumarVisitasComp = (filas: FilaRecorrido[]) => filas.reduce((acc, f) => acc + (f.visitas_completadas || 0), 0)
    const serieRecorridos = construirSerie(mesesBase, filasRecorridos, r => mesDeFechaSimple(r.fecha), filas => ({
      total: filas.length,
      completados: filas.filter(f => f.estado === 'completado').length,
      visitas_completadas: sumarVisitasComp(filas),
      kms: redondear1(sumarKm(filas)),
    }))

    // ─── Métricas: PAGOS COBRADOS ───
    const sumarPagos = (filas: FilaPago[]) => filas.reduce((acc, f) => acc + Number(f.monto_en_moneda_presupuesto || 0), 0)
    const pagosMesActual = filasPagos.filter(p => enRango(p.fecha_pago, inicioMesActual, ahora))
    const pagosMesAnterior = filasPagos.filter(p => enRango(p.fecha_pago, inicioMesAnterior, finMesAnterior))
    const seriePagos = construirSerie(mesesBase, filasPagos, p => claveMes(p.fecha_pago), filas => ({
      total: filas.length,
      monto: sumarPagos(filas),
    }))

    // ─── Métricas: MENSAJES WHATSAPP ───
    const waMesActual = filasMensajesWA.filter(m => enRango(m.creado_en, inicioMesActual, ahora))
    const waMesAnterior = filasMensajesWA.filter(m => enRango(m.creado_en, inicioMesAnterior, finMesAnterior))
    const serieWA = construirSerie(mesesBase, filasMensajesWA, m => claveMes(m.creado_en), filas => ({
      total: filas.length,
    }))

    return NextResponse.json({
      sin_cuenta: false,
      desde: inicioSerie.toISOString(),
      hasta: finSerie.toISOString(),
      meses_serie: mesesBase,
      anio_filtrado: anioParam ? parseInt(anioParam, 10) : null,
      visitas: {
        acumulado: { total: totalVisitas, completadas: totalVisitasCompletadas },
        mes_actual: { total: visitasMesActual.length, completadas: visitasMesActual.filter(v => v.estado === 'completada').length },
        mes_anterior: { total: visitasMesAnterior.length, completadas: visitasMesAnterior.filter(v => v.estado === 'completada').length },
        serie_mensual: serieVisitas,
      },
      presupuestos: {
        acumulado: { total: totalPresupuestos, aceptados: totalPresupuestosAceptados, monto: sumaMontosPresupuestos },
        mes_actual: {
          total: presupuestosMesActual.length,
          aceptados: presupuestosMesActual.filter(p => p.estado === 'aceptado').length,
          monto: sumarMontos(presupuestosMesActual),
          monto_aceptado: sumarMontos(presupuestosMesActual.filter(p => p.estado === 'aceptado')),
        },
        mes_anterior: {
          total: presupuestosMesAnterior.length,
          aceptados: presupuestosMesAnterior.filter(p => p.estado === 'aceptado').length,
          monto: sumarMontos(presupuestosMesAnterior),
          monto_aceptado: sumarMontos(presupuestosMesAnterior.filter(p => p.estado === 'aceptado')),
        },
        serie_mensual: seriePresupuestos,
      },
      ordenes: {
        acumulado: { total: totalOrdenes, completadas: totalOrdenesCompletadas },
        mes_actual: {
          total: ordenesMesActual.length,
          completadas: ordenesMesActual.filter(o => o.estado === 'completada').length,
          horas: redondear1(sumarHoras(ordenesMesActual)),
        },
        mes_anterior: {
          total: ordenesMesAnterior.length,
          completadas: ordenesMesAnterior.filter(o => o.estado === 'completada').length,
          horas: redondear1(sumarHoras(ordenesMesAnterior)),
        },
        serie_mensual: serieOrdenes,
      },
      actividades: {
        acumulado: { total: totalActividades, completadas: totalActividadesCompletadas },
        mes_actual: { total: actividadesMesActual.length, completadas: actividadesMesActual.filter(a => a.estado_clave === 'completada').length },
        mes_anterior: { total: actividadesMesAnterior.length, completadas: actividadesMesAnterior.filter(a => a.estado_clave === 'completada').length },
        serie_mensual: serieActividades,
      },
      recorridos: {
        acumulado: { total: totalRecorridos, completados: totalRecorridosCompletados },
        mes_actual: {
          total: recorridosMesActual.length,
          completados: recorridosMesActual.filter(r => r.estado === 'completado').length,
          visitas_completadas: sumarVisitasComp(recorridosMesActual),
          kms: redondear1(sumarKm(recorridosMesActual)),
          minutos: sumarMin(recorridosMesActual),
        },
        mes_anterior: {
          total: recorridosMesAnterior.length,
          completados: recorridosMesAnterior.filter(r => r.estado === 'completado').length,
          visitas_completadas: sumarVisitasComp(recorridosMesAnterior),
          kms: redondear1(sumarKm(recorridosMesAnterior)),
          minutos: sumarMin(recorridosMesAnterior),
        },
        serie_mensual: serieRecorridos,
      },
      pagos: {
        acumulado: { total: totalPagos, monto: sumaPagosCobrados },
        mes_actual: { total: pagosMesActual.length, monto: sumarPagos(pagosMesActual) },
        mes_anterior: { total: pagosMesAnterior.length, monto: sumarPagos(pagosMesAnterior) },
        serie_mensual: seriePagos,
      },
      whatsapp: {
        acumulado: { total: totalMensajesWA },
        mes_actual: { total: waMesActual.length },
        mes_anterior: { total: waMesAnterior.length },
        serie_mensual: serieWA,
      },
      contactos: {
        acumulado: { total: totalContactos },
      },
    })
  } catch (err) {
    console.error('Error métricas miembro:', err)
    return NextResponse.json({ error: 'Error al calcular métricas' }, { status: 500 })
  }
}

// ─── Helpers ───

async function contar(
  admin: ReturnType<typeof crearClienteAdmin>,
  tabla: string,
  filtros: Record<string, unknown>,
): Promise<number> {
  let q = admin.from(tabla).select('*', { count: 'exact', head: true })
  for (const [k, v] of Object.entries(filtros)) {
    q = q.eq(k, v as string | number | boolean)
  }
  const { count } = await q
  return count || 0
}

// Órdenes completadas: requiere join con ordenes_trabajo.estado
async function contarOrdenesCompletadas(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  usuarioId: string,
): Promise<number> {
  const { count } = await admin
    .from('asignados_orden_trabajo')
    .select('*, ordenes_trabajo!inner(estado, en_papelera)', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .eq('ordenes_trabajo.estado', 'completada')
    .eq('ordenes_trabajo.en_papelera', false)
  return count || 0
}

// Mensajes WhatsApp salientes: requiere join con conversaciones.tipo_canal
async function contarMensajesWA(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  usuarioId: string,
): Promise<number> {
  const { count } = await admin
    .from('mensajes')
    .select('*, conversaciones!inner(tipo_canal)', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('remitente_id', usuarioId)
    .eq('es_entrante', false)
    .eq('es_nota_interna', false)
    .eq('conversaciones.tipo_canal', 'whatsapp')
  return count || 0
}

// Suma del total_final de presupuestos creados (histórico)
async function sumarPresupuestosTotales(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  usuarioId: string,
): Promise<number> {
  const { data } = await admin
    .from('presupuestos')
    .select('total_final')
    .eq('empresa_id', empresaId)
    .eq('creado_por', usuarioId)
    .eq('en_papelera', false)
    .limit(50000)
  return (data || []).reduce((acc: number, f: { total_final: string | number }) => acc + Number(f.total_final || 0), 0)
}

// Suma de pagos cobrados (histórico)
async function sumarPagosCobrados(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  usuarioId: string,
): Promise<number> {
  const { data } = await admin
    .from('presupuesto_pagos')
    .select('monto_en_moneda_presupuesto')
    .eq('empresa_id', empresaId)
    .eq('creado_por', usuarioId)
    .limit(50000)
  return (data || []).reduce((acc: number, f: { monto_en_moneda_presupuesto: string | number }) => acc + Number(f.monto_en_moneda_presupuesto || 0), 0)
}

// Construye la serie mensual a partir de filas, con un punto por mes incluso si está vacío
function construirSerie<T, R extends Record<string, number>>(
  mesesBase: string[],
  filas: T[],
  obtenerClaveMes: (fila: T) => string,
  agregar: (filas: T[]) => R,
): Array<{ mes: string } & R> {
  const grupos = new Map<string, T[]>()
  for (const m of mesesBase) grupos.set(m, [])
  for (const f of filas) {
    const k = obtenerClaveMes(f)
    if (grupos.has(k)) grupos.get(k)!.push(f)
  }
  return mesesBase.map(mes => ({ mes, ...agregar(grupos.get(mes) || []) }))
}

function formatearFechaISO(d: Date): string {
  const a = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${a}-${m}-${dd}`
}
function mesDeFechaSimple(fecha: string): string {
  return fecha.slice(0, 7)
}
function fechaSimpleEnRango(fecha: string, desde: Date, hasta: Date): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`).getTime()
  return d >= desde.getTime() && d <= hasta.getTime()
}
function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}
