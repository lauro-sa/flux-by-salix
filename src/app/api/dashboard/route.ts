import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'
import { formatearFechaISO, obtenerComponentesFecha } from '@/lib/formato-fecha'

/**
 * GET /api/dashboard — Estadísticas completas para la página de inicio.
 * Retorna métricas clave, pipeline de ventas, crecimiento de contactos,
 * actividades por persona, productos top, presupuestos por vencer y asistencia.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Cargar zona horaria de la empresa para que todos los "hoy/esta semana" del dashboard
    // coincidan con el día local del usuario, no con UTC.
    const { data: empDash } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaDash = (empDash?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    // Fechas de referencia (calculadas en zona de empresa)
    const hoy = new Date()
    const hace12Semanas = new Date(hoy.getTime() - 84 * 24 * 60 * 60 * 1000)
    const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
    const hoyStr = formatearFechaISO(hoy, zonaDash)
    const { diaSemana: dowLocal } = obtenerComponentesFecha(hoy, zonaDash)
    // Offset al lunes (0=domingo...6=sábado) → si es domingo, retrocedemos 6 días; sino, (dow-1).
    const diasAlLunes = dowLocal === 0 ? 6 : dowLocal - 1
    const inicioSemana = new Date(hoy.getTime() - diasAlLunes * 24 * 60 * 60 * 1000)

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
      resMensajesRecientes,
      resActividadesProximas,
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

      // Últimos 5 presupuestos (no eliminados)
      admin
        .from('presupuestos')
        .select('id, numero, estado, contacto_nombre, contacto_apellido, total_final, creado_en')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .order('creado_en', { ascending: false })
        .limit(5),

      // Últimos 5 contactos creados (no eliminados, con tipo)
      admin
        .from('contactos')
        .select('id, nombre, apellido, correo, telefono, creado_en, tipo_contacto:tipos_contacto(clave, etiqueta, color)')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .order('creado_en', { ascending: false })
        .limit(5),

      // Actividades pendientes
      admin
        .from('actividades')
        .select('id, titulo, tipo_clave, estado_clave, prioridad, fecha_vencimiento, asignados')
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
        .select('asignados, estado_clave')
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
        .lte('fecha_vencimiento', formatearFechaISO(en7Dias, zonaDash))
        .order('fecha_vencimiento', { ascending: true })
        .limit(10),

      // ─── Asistencia de hoy (con detalle para widget) ───
      admin
        .from('asistencias')
        .select('id, miembro_id, estado, tipo, hora_entrada, hora_salida, puntualidad_min, metodo_registro')
        .eq('empresa_id', empresaId)
        .eq('fecha', hoyStr),

      // ─── Asistencia de la semana ───
      admin
        .from('asistencias')
        .select('miembro_id, estado, tipo, fecha')
        .eq('empresa_id', empresaId)
        .gte('fecha', formatearFechaISO(inicioSemana, zonaDash))
        .lte('fecha', hoyStr),

      // ─── Ingresos: presupuestos confirmados/orden_venta con fecha, monto y contacto ───
      // FK desambiguada: presupuestos tiene dos FKs hacia contactos (contacto_id y atencion_contacto_id)
      admin
        .from('presupuestos')
        .select('id, numero, estado, total_final, fecha_aceptacion, fecha_emision, creado_en, contacto:contactos!presupuestos_contacto_id_fkey(nombre, apellido)')
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

      // ─── Mensajes recientes (últimos 30 para cubrir todos los canales) ───
      admin
        .from('mensajes')
        .select('id, texto, remitente_nombre, remitente_tipo, es_entrante, tipo_contenido, correo_asunto, correo_de, es_nota_interna, creado_en, conversacion_id, conversacion:conversaciones(tipo_canal, contacto_nombre, canal_id)')
        .eq('empresa_id', empresaId)
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .limit(30),

      // ─── Actividades próximas (ordenadas por vencimiento más cercano) ───
      admin
        .from('actividades')
        .select('id, titulo, tipo_clave, estado_clave, prioridad, fecha_vencimiento, asignados')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .in('estado_clave', ['pendiente'])
        .not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', hoyStr)
        .order('fecha_vencimiento', { ascending: true })
        .limit(5),
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
      // Obtener lunes de esa semana (en zona de empresa)
      const lunes = new Date(fecha)
      lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
      const clave = formatearFechaISO(lunes, zonaDash)
      mapaSemanasContactos[clave] = (mapaSemanasContactos[clave] || 0) + 1
    }
    // Generar 12 semanas completas
    for (let i = 11; i >= 0; i--) {
      const lunes = new Date(hoy)
      lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) - i * 7)
      const clave = formatearFechaISO(lunes, zonaDash)
      contactosPorSemana.push({
        semana: clave,
        cantidad: mapaSemanasContactos[clave] || 0,
      })
    }

    // ─── Actividades por persona ───
    const mapaPersonas: Record<string, { pendientes: number; completadas: number }> = {}
    for (const a of resActividadesPorPersona.data || []) {
      const listaAsig = Array.isArray(a.asignados) ? a.asignados as { id: string; nombre: string }[] : []
      const nombres = listaAsig.length > 0 ? listaAsig.map(x => x.nombre) : ['Sin asignar']
      for (const nombre of nombres) {
        if (!mapaPersonas[nombre]) mapaPersonas[nombre] = { pendientes: 0, completadas: 0 }
        if (a.estado_clave === 'completada') {
          mapaPersonas[nombre].completadas++
        } else {
          mapaPersonas[nombre].pendientes++
        }
      }
    }
    const actividadesPorPersona = Object.entries(mapaPersonas)
      .map(([nombre, datos]) => ({ nombre, ...datos }))
      .sort((a, b) => b.pendientes - a.pendientes)
      .slice(0, 8)

    // ─── Asistencia hoy resumen + detalle por persona ───
    const asistenciaHoy = { presentes: 0, ausentes: 0, tardanzas: 0, total: 0 }

    // Obtener datos de miembros (nombre, sector, puesto, rol)
    const miembroIds = (resAsistenciaHoy.data || []).map(a => a.miembro_id)
    const mapaMiembros: Record<string, {
      usuario_id: string; nombre: string; sector: string | null
      puesto: string | null; rol: string | null
    }> = {}
    if (miembroIds.length > 0) {
      const { data: miembrosData } = await admin
        .from('miembros')
        .select('id, usuario_id, rol, puesto_nombre, sector')
        .in('id', miembroIds)
      const usuarioIds = (miembrosData || []).map(m => m.usuario_id).filter(Boolean)
      const { data: perfilesData } = await admin
        .from('perfiles')
        .select('id, nombre')
        .in('id', usuarioIds)
      const mapaPerfil: Record<string, string> = {}
      for (const p of perfilesData || []) mapaPerfil[p.id] = p.nombre || 'Sin nombre'
      for (const m of miembrosData || []) {
        mapaMiembros[m.id] = {
          usuario_id: m.usuario_id,
          nombre: mapaPerfil[m.usuario_id] || 'Sin nombre',
          sector: m.sector || null,
          puesto: m.puesto_nombre || null,
          rol: m.rol || null,
        }
      }
    }

    const detalleHoy: Array<{
      id: string; miembro_id: string; usuario_id: string; nombre: string; estado: string; tipo: string
      hora_entrada: string | null; hora_salida: string | null; puntualidad_min: number | null
      metodo_registro: string; sector: string | null; puesto: string | null; rol: string | null
    }> = []
    for (const a of resAsistenciaHoy.data || []) {
      const info = mapaMiembros[a.miembro_id]
      asistenciaHoy.total++
      if (a.estado === 'ausente') asistenciaHoy.ausentes++
      else if (a.tipo === 'tardanza') asistenciaHoy.tardanzas++
      else asistenciaHoy.presentes++
      detalleHoy.push({
        id: a.id,
        miembro_id: a.miembro_id,
        usuario_id: info?.usuario_id || '',
        nombre: info?.nombre || 'Sin nombre',
        estado: a.estado,
        tipo: a.tipo,
        hora_entrada: a.hora_entrada,
        hora_salida: a.hora_salida,
        puntualidad_min: a.puntualidad_min,
        metodo_registro: a.metodo_registro,
        sector: info?.sector || null,
        puesto: info?.puesto || null,
        rol: info?.rol || null,
      })
    }

    // ─── Asistencia semana por persona ───
    const mapaAsistenciaSemana: Record<string, { presentes: number; ausentes: number; tardanzas: number }> = {}
    for (const a of resAsistenciaSemana.data || []) {
      const id = a.miembro_id
      if (!mapaAsistenciaSemana[id]) mapaAsistenciaSemana[id] = { presentes: 0, ausentes: 0, tardanzas: 0 }
      if (a.estado === 'ausente') mapaAsistenciaSemana[id].ausentes++
      else if (a.tipo === 'tardanza') mapaAsistenciaSemana[id].tardanzas++
      else mapaAsistenciaSemana[id].presentes++
    }

    // ─── Ingresos por mes — separando orden_venta (100% cerrado) de confirmado_cliente ───
    // Usa fecha_aceptacion (cuando el cliente aceptó), con fallback a fecha_emision para registros anteriores
    const ingresosPorMes: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }> = {}
    const claveMesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    const detalleMesActual: Array<{ id: string; numero: string; estado: string; contacto_nombre: string | null; contacto_apellido: string | null; total: number; fecha: string }> = []
    for (const p of resIngresosConfirmados.data || []) {
      const fechaUsada = p.fecha_aceptacion || p.fecha_emision || p.creado_en
      const fecha = new Date(fechaUsada)
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
      if (!ingresosPorMes[clave]) ingresosPorMes[clave] = { cantidad: 0, monto: 0, ordenes_cantidad: 0, ordenes_monto: 0 }
      const monto = parseFloat(p.total_final) || 0
      ingresosPorMes[clave].cantidad++
      ingresosPorMes[clave].monto += monto
      if (p.estado === 'orden_venta') {
        ingresosPorMes[clave].ordenes_cantidad++
        ingresosPorMes[clave].ordenes_monto += monto
      }
      if (clave === claveMesActual) {
        const contacto = Array.isArray(p.contacto) ? p.contacto[0] : p.contacto
        detalleMesActual.push({
          id: p.id,
          numero: p.numero,
          estado: p.estado,
          contacto_nombre: (contacto as Record<string, string> | null)?.nombre || null,
          contacto_apellido: (contacto as Record<string, string> | null)?.apellido || null,
          total: monto,
          fecha: fechaUsada,
        })
      }
    }
    // Ordenar detalle del mes por fecha desc
    detalleMesActual.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Ingresos por año
    const ingresosPorAnio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }> = {}
    for (const p of resIngresosConfirmados.data || []) {
      const fecha = new Date(p.fecha_aceptacion || p.fecha_emision || p.creado_en)
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
        recientes: (resContactosRecientes.data || []).map(c => {
          const tipo = Array.isArray(c.tipo_contacto) ? c.tipo_contacto[0] : c.tipo_contacto
          return {
            id: c.id,
            nombre: c.nombre,
            apellido: c.apellido,
            correo: c.correo,
            telefono: c.telefono,
            creado_en: c.creado_en,
            tipo_clave: (tipo as Record<string, unknown>)?.clave || null,
            tipo_etiqueta: (tipo as Record<string, unknown>)?.etiqueta || null,
            tipo_color: (tipo as Record<string, unknown>)?.color || null,
          }
        }),
        crecimiento_semanal: contactosPorSemana,
      },
      presupuestos: {
        total: (resPresupuestos.data || []).length,
        por_estado: presupuestosPorEstado,
        recientes: (resPresupuestosRecientes.data || []).map(p => ({
          ...p,
          total: p.total_final,
        })),
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
        detalle_hoy: detalleHoy,
        semana: mapaAsistenciaSemana,
        usuario_id: user.id,
      },
      ingresos: {
        por_mes: ingresosPorMes,
        por_anio: ingresosPorAnio,
        detalle_mes_actual: detalleMesActual,
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
      mensajes_recientes: (resMensajesRecientes.data || []).map(m => {
        const conv = (Array.isArray(m.conversacion) ? m.conversacion[0] : m.conversacion) as Record<string, unknown> | null
        const canal = conv?.canal as Record<string, unknown> | Array<Record<string, unknown>> | null
        const canalObj = Array.isArray(canal) ? canal[0] : canal
        return {
          id: m.id,
          texto: m.texto,
          remitente_nombre: m.remitente_nombre,
          remitente_tipo: m.remitente_tipo,
          es_entrante: m.es_entrante,
          tipo_contenido: m.tipo_contenido,
          correo_asunto: m.correo_asunto,
          correo_de: m.correo_de,
          creado_en: m.creado_en,
          conversacion_id: m.conversacion_id,
          tipo_canal: (conv?.tipo_canal as string) || 'desconocido',
          contacto_nombre: (conv?.contacto_nombre as string) || null,
          nombre_canal: (canalObj?.nombre as string) || null,
        }
      }),
      actividades_proximas: resActividadesProximas.data || [],
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
