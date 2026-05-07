import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'
import { registrarError } from '@/lib/logger'
import { formatearFechaISO, obtenerComponentesFecha } from '@/lib/formato-fecha'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'
import type { Modulo, Accion } from '@/tipos/permisos'
import { EstadosCuota } from '@/tipos/cuota'
import { EstadosConversacion } from '@/tipos/conversacion'

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

    // Permisos del usuario — cada bloque del dashboard se calcula solo si el
    // usuario puede ver el módulo correspondiente. Esto evita que un empleado
    // sin acceso a presupuestos vea montos/pipeline/ingresos en su dashboard.
    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    const tieneAlgunVer = (modulo: Modulo): boolean => {
      const acciones: Accion[] = ['ver_todos', 'ver_propio', 'ver']
      return acciones.some(a => verificarPermiso(datosMiembro, modulo, a))
    }
    const permisos = {
      contactos: tieneAlgunVer('contactos'),
      presupuestos: tieneAlgunVer('presupuestos'),
      actividades: tieneAlgunVer('actividades'),
      productos: tieneAlgunVer('productos'),
      asistencias: tieneAlgunVer('asistencias'),
      // Ingresos y pipeline dependen de ver_todos en presupuestos (son datos
      // agregados del equipo; ver_propio no da la foto completa).
      presupuestos_todos: verificarPermiso(datosMiembro, 'presupuestos', 'ver_todos'),
      asistencias_todos: verificarPermiso(datosMiembro, 'asistencias', 'ver_todos'),
      // Resumen de OT en métricas: requiere ver_todos para foto del equipo
      ordenes_trabajo: tieneAlgunVer('ordenes_trabajo'),
      ordenes_trabajo_todos: verificarPermiso(datosMiembro, 'ordenes_trabajo', 'ver_todos'),
      // Nómina: requiere ver_todos (es info financiera del equipo, no debe verse parcialmente)
      nomina_todos: verificarPermiso(datosMiembro, 'nomina', 'ver_todos'),
      inbox_whatsapp: tieneAlgunVer('inbox_whatsapp'),
      inbox_correo: tieneAlgunVer('inbox_correo'),
      inbox_interno: tieneAlgunVer('inbox_interno'),
      inbox: tieneAlgunVer('inbox_whatsapp') || tieneAlgunVer('inbox_correo') || tieneAlgunVer('inbox_interno'),
    }
    // Lista de canales permitidos para filtrar `mensajes_recientes` y evitar
    // que pestañas como "WhatsApp" aparezcan cuando el usuario no tiene acceso.
    const canalesPermitidos = new Set<string>()
    if (permisos.inbox_whatsapp) canalesPermitidos.add('whatsapp')
    if (permisos.inbox_correo) canalesPermitidos.add('correo')
    if (permisos.inbox_interno) canalesPermitidos.add('interno')

    // Cargar zona horaria de la empresa para que todos los "hoy/esta semana" del dashboard
    // coincidan con el día local del usuario, no con UTC.
    const { data: empDash } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaDash = (empDash?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    // Fechas de referencia (calculadas en zona de empresa)
    const hoy = new Date()
    const hace12Semanas = new Date(hoy.getTime() - 84 * 24 * 60 * 60 * 1000)
    const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
    const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000)
    const hoyStr = formatearFechaISO(hoy, zonaDash)
    const mananaStr = formatearFechaISO(manana, zonaDash)
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
      resActividadesHoy,
      resRecordatoriosHoy,
      resNotasCompartidas,
      resPagosCobrados,
      resCuotasPendientes,
      resOrdenesTrabajo,
      resPagosNomina,
      resAdelantosActivos,
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
        .in('estado', [EstadosConversacion.ABIERTA, EstadosConversacion.EN_ESPERA]),

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

      // ─── Ingresos: presupuestos confirmados/orden_venta/completado ───
      // FK desambiguada: presupuestos tiene dos FKs hacia contactos (contacto_id y atencion_contacto_id)
      admin
        .from('presupuestos')
        .select('id, numero, estado, total_final, subtotal_neto, total_impuestos, fecha_aceptacion, fecha_emision, creado_en, contacto:contactos!presupuestos_contacto_id_fkey(nombre, apellido)')
        .eq('empresa_id', empresaId)
        .in('estado', ['confirmado_cliente', 'orden_venta', 'completado']),

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

      // ─── Actividades de hoy (pendientes con vencimiento hoy) — para chip "hoy" ───
      admin
        .from('actividades')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false)
        .eq('estado_clave', 'pendiente')
        .gte('fecha_vencimiento', hoyStr)
        .lt('fecha_vencimiento', mananaStr),

      // ─── Recordatorios del usuario pendientes o para hoy (vencidos + hoy) ───
      admin
        .from('recordatorios')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('asignado_a', user.id)
        .eq('completado', false)
        .lte('fecha', hoyStr),

      // ─── Notas compartidas con el usuario: contamos en post-proceso (filtro _tiene_cambios) ───
      admin
        .from('notas_rapidas_compartidas')
        .select('leido_en, nota:notas_rapidas(actualizado_en, en_papelera, archivada)')
        .eq('usuario_id', user.id),

      // ─── Pagos cobrados: enriquecidos con presupuesto + cuota ───
      // Usado para "Cobrado por mes", comparativa devengado vs cobrado y
      // detalle mes-a-mes que muestra dónde sale cada peso. Incluye
      // subtotal_neto y total_impuestos para calcular el IVA cobrado.
      admin
        .from('presupuesto_pagos')
        .select(`
          id, monto_en_moneda_presupuesto, monto_percepciones, cotizacion_cambio,
          moneda, fecha_pago, metodo,
          presupuesto_id, cuota_id, es_adicional, concepto_adicional,
          cuota:presupuesto_cuotas(numero, descripcion),
          presupuesto:presupuestos!presupuesto_pagos_presupuesto_id_fkey(
            numero, fecha_aceptacion, fecha_emision, total_final, estado,
            subtotal_neto, total_impuestos,
            contacto_nombre, contacto_apellido
          )
        `)
        .eq('empresa_id', empresaId)
        .is('eliminado_en', null),

      // ─── Todas las cuotas: usadas para proyección y para conocer el
      // monto del adelanto (cuota 1) de cada presupuesto en orden_venta. ──
      admin
        .from('presupuesto_cuotas')
        .select(`
          id, presupuesto_id, numero, monto, porcentaje, estado, dias_desde_emision,
          presupuesto:presupuestos!presupuesto_cuotas_presupuesto_id_fkey(
            id, fecha_emision, estado, en_papelera, total_final
          )
        `)
        .eq('empresa_id', empresaId),

      // ─── Órdenes de trabajo: estado + fechas para resumen del mes ───
      // Usamos creado_en y fecha_fin_real para calcular tiempo promedio de
      // cierre (cuando se completó vs cuando se creó).
      admin
        .from('ordenes_trabajo')
        .select('estado, fecha_inicio, fecha_fin_real, creado_en')
        .eq('empresa_id', empresaId)
        .eq('en_papelera', false),

      // ─── Pagos de nómina: períodos cuyo fin cae en el mes actual ───
      // Para mostrar "a pagar este mes" (sugerido pendiente) y "pagado".
      admin
        .from('pagos_nomina')
        .select('miembro_id, monto_sugerido, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo')
        .eq('empresa_id', empresaId)
        .eq('eliminado', false),

      // ─── Adelantos de nómina activos: cuántas personas tienen adelantos vivos ───
      admin
        .from('adelantos_nomina')
        .select('miembro_id, monto_total, estado')
        .eq('empresa_id', empresaId)
        .eq('eliminado', false)
        .in('estado', ['pendiente', 'aprobado', 'en_descuento']),
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
        .select('id, usuario_id, rol, puesto_id')
        .in('id', miembroIds)
      const usuarioIds = (miembrosData || []).map(m => m.usuario_id).filter(Boolean)
      const { data: perfilesData } = await admin
        .from('perfiles')
        .select('id, nombre')
        .in('id', usuarioIds)
      const mapaPerfil: Record<string, string> = {}
      for (const p of perfilesData || []) mapaPerfil[p.id] = p.nombre || 'Sin nombre'
      const etiquetas = await cargarEtiquetasMiembros(admin, (miembrosData || []).map(m => ({ id: m.id, puesto_id: m.puesto_id })))
      for (const m of miembrosData || []) {
        const et = etiquetas.get(m.id)
        mapaMiembros[m.id] = {
          usuario_id: m.usuario_id,
          nombre: mapaPerfil[m.usuario_id] || 'Sin nombre',
          sector: et?.sector ?? null,
          puesto: et?.puesto ?? null,
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

    // ─── Proyección de cobro futuro + mapa de adelantos ──────────────────
    // Una pasada por las cuotas para:
    //  - Sumar pendientes/parciales en `proyeccionPorMes` (cobros futuros)
    //  - Indexar cuota 1 de cada presupuesto en `adelantoPorPresupuesto`
    //    (usado abajo para asumir adelanto cobrado en orden_venta sin pagos)
    const proyeccionPorMes: Record<string, { cantidad: number; monto: number }> = {}
    const adelantoPorPresupuesto = new Map<string, number>()
    // Para mostrar "X/N cuotas cobradas" en cada presupuesto del detalle
    const cuotasCountPorPresupuesto = new Map<string, { total: number; cobradas: number }>()

    for (const c of (resCuotasPendientes.data || []) as Array<{
      presupuesto_id: string
      numero: number
      monto: string | number
      porcentaje: string | number
      estado: string
      dias_desde_emision: number | null
      presupuesto: { fecha_emision: string; estado: string; en_papelera: boolean; total_final: string | number | null } | { fecha_emision: string; estado: string; en_papelera: boolean; total_final: string | number | null }[] | null
    }>) {
      const pres = Array.isArray(c.presupuesto) ? c.presupuesto[0] : c.presupuesto
      if (!pres) continue
      if (pres.en_papelera) continue
      if (['cancelado', 'rechazado', 'borrador'].includes(pres.estado)) continue

      // Recalcular el monto desde `total_final * porcentaje / 100` — siempre
      // CON IMPUESTOS, lo que el cliente realmente paga. La columna
      // `presupuesto_cuotas.monto` está inconsistente en datos viejos
      // (algunas filas tienen el neto en lugar del total con IVA).
      const totalFinal = Number(pres.total_final) || 0
      const porcentaje = Number(c.porcentaje) || 0
      const montoCalc = (totalFinal * porcentaje) / 100
      const montoBd = Number(c.monto) || 0
      const monto = montoCalc > 0 ? montoCalc : montoBd

      // Acumular conteo de cuotas por presupuesto
      const conteo = cuotasCountPorPresupuesto.get(c.presupuesto_id) || { total: 0, cobradas: 0 }
      conteo.total++
      if (c.estado === EstadosCuota.COBRADA) conteo.cobradas++
      cuotasCountPorPresupuesto.set(c.presupuesto_id, conteo)

      if (c.numero === 1) {
        adelantoPorPresupuesto.set(c.presupuesto_id, monto)
      }

      if (c.estado === EstadosCuota.PENDIENTE || c.estado === EstadosCuota.PARCIAL) {
        const fechaBase = new Date(pres.fecha_emision)
        fechaBase.setDate(fechaBase.getDate() + (c.dias_desde_emision || 0))
        const clave = `${fechaBase.getFullYear()}-${String(fechaBase.getMonth() + 1).padStart(2, '0')}`
        if (!proyeccionPorMes[clave]) proyeccionPorMes[clave] = { cantidad: 0, monto: 0 }
        proyeccionPorMes[clave].cantidad++
        proyeccionPorMes[clave].monto += monto
      }
    }

    // ─── Cobrado por mes + detalle mes-a-mes ──────────────────────────
    // Fuente principal: `presupuesto_pagos.fecha_pago` (cobro real).
    // Para presupuestos en estado `completado` sin pagos cargados (datos
    // viejos), imputamos el faltante al mes de fecha_aceptacion/fecha_emision.
    const cobradoPorMes: Record<string, { cantidad: number; monto: number }> = {}

    // Tipos del JOIN devuelto por Supabase (la relación puede venir como objeto o array)
    type PresupuestoEnJoin = {
      numero: string
      fecha_aceptacion: string | null
      fecha_emision: string | null
      total_final: string | number | null
      estado: string
      subtotal_neto: string | number | null
      total_impuestos: string | number | null
      contacto_nombre: string | null
      contacto_apellido: string | null
    }
    type PagoEnriquecido = {
      id: string
      monto_en_moneda_presupuesto: string | number | null
      monto_percepciones: string | number | null
      cotizacion_cambio: string | number | null
      moneda: string
      fecha_pago: string
      metodo: string | null
      presupuesto_id: string
      cuota_id: string | null
      es_adicional: boolean
      concepto_adicional: string | null
      cuota: { numero: number; descripcion: string | null } | { numero: number; descripcion: string | null }[] | null
      presupuesto: PresupuestoEnJoin | PresupuestoEnJoin[] | null
    }

    // Detalle de cada cobro (real o estimado) — alimenta el widget mes-a-mes.
    // tipo_estimacion:
    //   'real'                  → pago cargado en presupuesto_pagos
    //   'completado_total'      → completado sin pagos: asumimos total cobrado
    //   'orden_venta_adelanto'  → orden_venta sin pagos: asumimos adelanto (cuota 1)
    //   'sin_cobros'            → confirmado_cliente sin pagos: monto $0, solo informativo
    type TipoEstimacion = 'real' | 'completado_total' | 'orden_venta_adelanto' | 'sin_cobros'
    type DetalleCobro = {
      pago_id: string | null
      presupuesto_id: string
      presupuesto_numero: string
      presupuesto_total: number
      presupuesto_saldo: number
      presupuesto_subtotal_neto: number
      presupuesto_total_impuestos: number
      presupuesto_fecha_aceptacion: string | null
      presupuesto_estado: string
      presupuesto_cuotas_count: number   // total de cuotas del plan
      presupuesto_cuotas_cobradas: number // cuántas están cobradas
      contacto_nombre: string | null
      contacto_apellido: string | null
      fecha_pago: string
      monto: number
      monto_neto: number   // proporción del pago sin IVA
      monto_iva: number    // proporción del pago de IVA
      monto_percepciones: number  // percepciones cobradas (en moneda del presupuesto)
      cuota_numero: number | null
      cuota_descripcion: string | null
      metodo: string | null
      tipo_estimacion: TipoEstimacion
    }
    const detalleCobros: DetalleCobro[] = []

    // Index: presupuesto_id → suma cobrada (excluye adicionales: éstos son
    // entradas de dinero por trabajos extra fuera del presupuesto y no
    // descuentan saldo del presupuesto base).
    const pagosPorPresupuesto = new Map<string, number>()
    // Acumulador aparte de adicionales por mes: para reportes contables.
    const adicionalesPorMes: Record<string, { cantidad: number; monto: number }> = {}
    // Acumulador de percepciones cobradas por mes (en moneda del presupuesto).
    // Las percepciones forman parte del cobrado total porque desde el cliente
    // sale igual, pero NO son ingreso real de la empresa: hay que depositarlas
    // al fisco. Para Contaduría hay que poder descontarlas del ingreso neto.
    const percepcionesPorMes: Record<string, number> = {}
    const pagosCrudos = (resPagosCobrados.data || []) as PagoEnriquecido[]
    for (const p of pagosCrudos) {
      if (p.es_adicional) continue
      const monto = Number(p.monto_en_moneda_presupuesto) || 0
      pagosPorPresupuesto.set(p.presupuesto_id, (pagosPorPresupuesto.get(p.presupuesto_id) || 0) + monto)
    }

    // Procesar cada pago real
    for (const p of pagosCrudos) {
      const monto = Number(p.monto_en_moneda_presupuesto) || 0
      // Clave de mes en zona horaria de la empresa: evita que un pago del
      // 31 a las 23h ART caiga en el mes siguiente sólo porque el server es UTC.
      const { anio, mes } = obtenerComponentesFecha(new Date(p.fecha_pago), zonaDash)
      const clave = `${anio}-${String(mes).padStart(2, '0')}`

      // Adicionales: van a su propio acumulador, no se mezclan con el cobrado
      // del presupuesto y no se imputan a cuotas ni saldo.
      if (p.es_adicional) {
        if (!adicionalesPorMes[clave]) adicionalesPorMes[clave] = { cantidad: 0, monto: 0 }
        adicionalesPorMes[clave].cantidad++
        adicionalesPorMes[clave].monto += monto
        continue
      }

      if (!cobradoPorMes[clave]) cobradoPorMes[clave] = { cantidad: 0, monto: 0 }
      cobradoPorMes[clave].cantidad++
      cobradoPorMes[clave].monto += monto

      // Percepciones del pago en moneda del presupuesto (= percepciones del
      // pago * cotización del pago). Son retención fiscal — separadas para
      // poder descontarlas del ingreso neto en reportes contables.
      const cotizacionPago = Number(p.cotizacion_cambio ?? 1) || 1
      const percepcionesEnPpto =
        (Number(p.monto_percepciones) || 0) * cotizacionPago
      if (percepcionesEnPpto > 0) {
        percepcionesPorMes[clave] = (percepcionesPorMes[clave] || 0) + percepcionesEnPpto
      }

      const pres = Array.isArray(p.presupuesto) ? p.presupuesto[0] : p.presupuesto
      const cuota = Array.isArray(p.cuota) ? p.cuota[0] : p.cuota
      const total = pres ? Number(pres.total_final) || 0 : 0
      const subtotalNeto = pres ? Number(pres.subtotal_neto) || 0 : 0
      const totalImpuestos = pres ? Number(pres.total_impuestos) || 0 : 0
      const totalPagado = pagosPorPresupuesto.get(p.presupuesto_id) || 0
      const saldo = Math.max(0, total - totalPagado)
      // IVA proporcional al pago: si el pago cubre 30% del total, le toca el 30% del IVA
      const proporcion = total > 0 ? monto / total : 0
      const montoIva = totalImpuestos * proporcion
      const montoNeto = monto - montoIva
      const conteo = cuotasCountPorPresupuesto.get(p.presupuesto_id) || { total: 0, cobradas: 0 }

      detalleCobros.push({
        pago_id: p.id,
        presupuesto_id: p.presupuesto_id,
        presupuesto_numero: pres?.numero || '',
        presupuesto_total: total,
        presupuesto_saldo: saldo,
        presupuesto_subtotal_neto: subtotalNeto,
        presupuesto_total_impuestos: totalImpuestos,
        presupuesto_fecha_aceptacion: pres?.fecha_aceptacion || null,
        presupuesto_estado: pres?.estado || '',
        presupuesto_cuotas_count: conteo.total,
        presupuesto_cuotas_cobradas: conteo.cobradas,
        contacto_nombre: pres?.contacto_nombre || null,
        contacto_apellido: pres?.contacto_apellido || null,
        fecha_pago: p.fecha_pago,
        monto,
        monto_neto: montoNeto,
        monto_iva: montoIva,
        // Percepciones cobradas (en moneda del presupuesto). 0 si no hay.
        monto_percepciones:
          (Number(p.monto_percepciones) || 0) * (Number(p.cotizacion_cambio ?? 1) || 1),
        cuota_numero: cuota?.numero || null,
        cuota_descripcion: cuota?.descripcion || null,
        metodo: p.metodo,
        tipo_estimacion: 'real',
      })
    }

    // Para cada presupuesto confirmado/orden_venta/completado, decidimos:
    //   - completado sin pagos        → asumimos TOTAL cobrado a fecha_aceptacion (alerta: cargar comprobantes)
    //   - orden_venta sin pagos       → asumimos ADELANTO (cuota 1) cobrado a fecha_aceptacion (alerta: cargar primer pago)
    //   - confirmado_cliente sin pagos → mostrar con $0, sin imputar nada (solo informativo)
    //   - cualquiera con pagos parciales → además de los pagos reales, completar faltante si es completado
    // El widget muestra alertas según `tipo_estimacion`.
    for (const p of (resIngresosConfirmados.data || []) as Array<{
      id: string; numero: string; estado: string; total_final: string | number | null
      subtotal_neto: string | number | null; total_impuestos: string | number | null
      fecha_aceptacion: string | null; fecha_emision: string | null; creado_en: string
      contacto: { nombre: string | null; apellido: string | null } | { nombre: string | null; apellido: string | null }[] | null
    }>) {
      const total = Number(p.total_final) || 0
      if (total <= 0) continue
      const subtotalNeto = Number(p.subtotal_neto) || 0
      const totalImpuestos = Number(p.total_impuestos) || 0
      const yaPagado = pagosPorPresupuesto.get(p.id) || 0
      const cont = Array.isArray(p.contacto) ? p.contacto[0] : p.contacto
      const fechaRef = p.fecha_aceptacion || p.fecha_emision || p.creado_en
      const conteo = cuotasCountPorPresupuesto.get(p.id) || { total: 0, cobradas: 0 }

      const imputar = (monto: number, tipo: TipoEstimacion, saldo: number) => {
        const fecha = new Date(fechaRef)
        const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        if (monto > 0) {
          if (!cobradoPorMes[clave]) cobradoPorMes[clave] = { cantidad: 0, monto: 0 }
          cobradoPorMes[clave].cantidad++
          cobradoPorMes[clave].monto += monto
        }
        const proporcion = total > 0 ? monto / total : 0
        const montoIva = totalImpuestos * proporcion
        const montoNeto = monto - montoIva
        detalleCobros.push({
          pago_id: null,
          presupuesto_id: p.id,
          presupuesto_numero: p.numero,
          presupuesto_total: total,
          presupuesto_saldo: saldo,
          presupuesto_subtotal_neto: subtotalNeto,
          presupuesto_total_impuestos: totalImpuestos,
          presupuesto_fecha_aceptacion: p.fecha_aceptacion,
          presupuesto_estado: p.estado,
          presupuesto_cuotas_count: conteo.total,
          presupuesto_cuotas_cobradas: conteo.cobradas,
          contacto_nombre: cont?.nombre || null,
          contacto_apellido: cont?.apellido || null,
          fecha_pago: fechaRef,
          monto,
          monto_neto: montoNeto,
          monto_iva: montoIva,
          monto_percepciones: 0, // detalles estimados no tienen percepciones reales
          cuota_numero: null,
          cuota_descripcion: null,
          metodo: null,
          tipo_estimacion: tipo,
        })
      }

      if (p.estado === 'completado') {
        // Pasar a 'completado' = ciclo cerrado, NO implica cobro automático.
        // Si los pagos cargados no cubren el total, mostramos entrada
        // informativa con monto $0 y alerta "faltan comprobantes" — pero
        // NO inflamos el cobrado del mes con asunciones.
        const faltante = total - yaPagado
        if (faltante < 0.01) continue // ya está cubierto por pagos reales
        imputar(0, 'completado_total', faltante)
      } else if (p.estado === 'orden_venta' && yaPagado < 0.01 && p.fecha_aceptacion) {
        // Pasar a 'orden_venta' sí implica que el cliente firmó y normalmente
        // paga el adelanto en ese momento. Asumimos el adelanto (cuota 1)
        // cobrado a fecha_aceptacion, con alerta para cargar el comprobante.
        const adelanto = adelantoPorPresupuesto.get(p.id) ?? total
        imputar(adelanto, 'orden_venta_adelanto', total - adelanto)
      } else if (p.estado === 'confirmado_cliente' && yaPagado < 0.01 && p.fecha_aceptacion) {
        // Confirmado por el cliente pero sin actividad de cobro: $0 informativo
        imputar(0, 'sin_cobros', total)
      }
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
      if (p.estado === 'orden_venta' || p.estado === 'completado') {
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
      if (p.estado === 'orden_venta' || p.estado === 'completado') {
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

    // ─── Resumen de Nómina del mes actual ───────────────────────────────
    // Tomamos los pagos_nomina cuyo fecha_fin_periodo cae en el mes actual.
    // (Un pago de nómina representa un período liquidado; el "fin" indica
    // cuándo se cierra ese período, normalmente fin de mes).
    const claveMesActualNomina = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    let nominaSugeridoMes = 0
    let nominaAbonadoMes = 0
    let nominaCantPersonas = 0
    let nominaCantPendientes = 0
    const miembrosNominaMes = new Set<string>()
    for (const p of (resPagosNomina.data || []) as Array<{
      miembro_id: string
      monto_sugerido: string | number | null
      monto_abonado: string | number | null
      fecha_fin_periodo: string | null
    }>) {
      if (!p.fecha_fin_periodo) continue
      const claveFin = p.fecha_fin_periodo.slice(0, 7) // YYYY-MM
      if (claveFin !== claveMesActualNomina) continue
      const sugerido = Number(p.monto_sugerido) || 0
      const abonado = Number(p.monto_abonado) || 0
      nominaSugeridoMes += sugerido
      nominaAbonadoMes += abonado
      miembrosNominaMes.add(p.miembro_id)
      // Pendiente si todavía no se pagó el total sugerido
      if (abonado < sugerido - 0.01) nominaCantPendientes++
    }
    nominaCantPersonas = miembrosNominaMes.size
    const nominaPendienteMes = Math.max(0, nominaSugeridoMes - nominaAbonadoMes)

    // Adelantos activos: distintos miembros con adelantos vivos
    const miembrosConAdelanto = new Set<string>()
    let adelantosMontoTotal = 0
    for (const a of (resAdelantosActivos.data || []) as Array<{
      miembro_id: string; monto_total: string | number | null
    }>) {
      miembrosConAdelanto.add(a.miembro_id)
      adelantosMontoTotal += Number(a.monto_total) || 0
    }

    // ─── Resumen de Órdenes de trabajo ─────────────────────────────────
    // Conteo por estado, completadas del mes actual y tiempo promedio de
    // cierre (días entre creado_en y fecha_fin_real para las completadas).
    const ordenesPorEstado: Record<string, number> = {}
    let ordenesCompletadasMes = 0
    let sumDiasCierre = 0
    let cantConCierre = 0
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    for (const o of (resOrdenesTrabajo.data || []) as Array<{
      estado: string; fecha_inicio: string | null; fecha_fin_real: string | null; creado_en: string
    }>) {
      ordenesPorEstado[o.estado] = (ordenesPorEstado[o.estado] || 0) + 1
      if (o.estado === 'completada' && o.fecha_fin_real) {
        const fin = new Date(o.fecha_fin_real)
        if (fin >= inicioMes) ordenesCompletadasMes++
        // Tiempo de cierre = fecha_fin_real − creado_en (en días)
        const inicio = new Date(o.creado_en)
        const dias = (fin.getTime() - inicio.getTime()) / 86400000
        if (dias >= 0 && dias < 365) {
          sumDiasCierre += dias
          cantConCierre++
        }
      }
    }
    const tiempoPromedioCierreDias = cantConCierre > 0
      ? Math.round(sumDiasCierre / cantConCierre)
      : 0

    // ─── Notas compartidas con cambios no leídos ───
    // Misma lógica que _tiene_cambios en /api/notas-rapidas: nunca leída, o
    // actualizada después de la última lectura. Excluye archivadas y papelera.
    let notasConCambios = 0
    type FilaNotaCompartida = {
      leido_en: string | null
      nota: { actualizado_en: string | null; en_papelera: boolean; archivada: boolean } | null
    }
    for (const row of (resNotasCompartidas.data || []) as unknown as FilaNotaCompartida[]) {
      const nota = Array.isArray(row.nota) ? row.nota[0] : row.nota
      if (!nota || nota.en_papelera || nota.archivada) continue
      const tieneCambios = !row.leido_en || (nota.actualizado_en && new Date(nota.actualizado_en) > new Date(row.leido_en))
      if (tieneCambios) notasConCambios++
    }

    // Armamos la respuesta condicionada por permisos. Los bloques cuyo módulo
    // el usuario no puede ver se devuelven como `null` para que el frontend
    // oculte el widget completo (el valor `null` es explícito y distinto de
    // "datos vacíos"). El objeto `permisos` al final le dice al cliente qué
    // widgets puede intentar renderizar.
    return NextResponse.json({
      permisos,
      contactos: permisos.contactos ? {
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
      } : null,
      presupuestos: permisos.presupuestos ? {
        total: (resPresupuestos.data || []).length,
        por_estado: presupuestosPorEstado,
        recientes: (resPresupuestosRecientes.data || []).map(p => ({
          ...p,
          total: p.total_final,
        })),
        // Pipeline (montos agregados del equipo) solo si ve_todos.
        pipeline_montos: permisos.presupuestos_todos ? pipelineMontos : {},
        por_vencer: resPresupuestosPorVencer.data || [],
      } : null,
      conversaciones: permisos.inbox ? {
        abiertas: resConversaciones.count || 0,
        por_canal: conversacionesPorCanal,
        sin_leer: resMensajesSinLeer.count || 0,
      } : null,
      actividades: permisos.actividades ? {
        pendientes: resActividadesPendientes.data || [],
        total_pendientes: resActividadesTotal.count || 0,
        total_hoy: resActividadesHoy.count || 0,
        completadas_hoy: resActividadesCompletadasHoy.count || 0,
        por_persona: actividadesPorPersona,
      } : null,
      // Alertas personales (recordatorios propios, notas compartidas con el
      // usuario) siempre van — son del usuario, no del equipo.
      alertas: {
        recordatorios_hoy: resRecordatoriosHoy.count || 0,
        notas_con_cambios: notasConCambios,
      },
      productos: permisos.productos ? {
        top: resProductosTop.data || [],
      } : null,
      asistencia: permisos.asistencias ? {
        // Si solo tiene ver_propio, ocultamos los detalles del equipo y
        // devolvemos solo el usuario_id para que el widget muestre su fila.
        hoy: permisos.asistencias_todos ? asistenciaHoy : null,
        detalle_hoy: permisos.asistencias_todos ? detalleHoy : [],
        semana: permisos.asistencias_todos ? mapaAsistenciaSemana : {},
        usuario_id: user.id,
      } : null,
      // Ingresos, comparativa y clientes exponen montos agregados: requieren
      // ver_todos de presupuestos.
      ingresos: permisos.presupuestos_todos ? {
        por_mes: ingresosPorMes,
        por_anio: ingresosPorAnio,
        detalle_mes_actual: detalleMesActual,
      } : null,
      // Cobros reales (lo que efectivamente entró). Distinto de "ingresos"
      // que mide presupuestos aceptados (devengado).
      cobros: permisos.presupuestos_todos ? {
        cobrado_por_mes: cobradoPorMes,
        proyeccion_por_mes: proyeccionPorMes,
        detalle: detalleCobros,
        // Subset informativo: cuánto del cobrado fue retenciones/percepciones
        // (en moneda del presupuesto). Sirve para descontar del ingreso neto.
        percepciones_por_mes: percepcionesPorMes,
        // Pagos por trabajos extra fuera del presupuesto: no descuentan saldo
        // pero sí entran a la caja. Reportados aparte para no contaminar la
        // tasa de cobro / saldo por presupuesto.
        adicionales_por_mes: adicionalesPorMes,
      } : null,
      comparativa: permisos.presupuestos_todos ? {
        presupuestos_por_mes: presupuestosPorMesAnio,
        contactos_por_mes: contactosPorMesAnio,
      } : null,
      // Resumen de OT: totales por estado + completadas del mes + tiempo
      // promedio de cierre. Requiere ver_todos del módulo (foto del equipo).
      ordenes_trabajo: permisos.ordenes_trabajo_todos ? {
        por_estado: ordenesPorEstado,
        completadas_mes: ordenesCompletadasMes,
        tiempo_promedio_cierre_dias: tiempoPromedioCierreDias,
        total: (resOrdenesTrabajo.data || []).length,
      } : null,
      // Resumen de nómina del mes: a pagar / pagado / adelantos activos.
      // Solo si tiene ver_todos en nómina (info financiera del equipo).
      nomina: permisos.nomina_todos ? {
        sugerido_mes: nominaSugeridoMes,
        abonado_mes: nominaAbonadoMes,
        pendiente_mes: nominaPendienteMes,
        cant_personas: nominaCantPersonas,
        cant_pendientes: nominaCantPendientes,
        adelantos_activos_personas: miembrosConAdelanto.size,
        adelantos_monto_total: adelantosMontoTotal,
      } : null,
      clientes: permisos.presupuestos_todos && permisos.contactos ? {
        activos_por_tipo: clientesActivosPorTipo,
        total_activos: contactosConPresupuesto.size,
        nuevos_por_mes: clientesNuevosPorMes,
      } : null,
      mensajes_recientes: permisos.inbox ? (resMensajesRecientes.data || []).filter(m => {
        // Solo mensajes del canal permitido para este usuario
        const conv = (Array.isArray(m.conversacion) ? m.conversacion[0] : m.conversacion) as Record<string, unknown> | null
        const canal = (conv?.tipo_canal as string) || ''
        return canalesPermitidos.has(canal)
      }).map(m => {
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
      }) : [],
      actividades_proximas: permisos.actividades ? (resActividadesProximas.data || []) : [],
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
