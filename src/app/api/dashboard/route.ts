import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'

/**
 * GET /api/dashboard — Estadísticas generales para la página de inicio.
 * Retorna conteos de contactos, presupuestos por estado, conversaciones abiertas,
 * mensajes sin leer y métricas del inbox de los últimos 30 días.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

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
    ] = await Promise.all([
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

      // Mensajes sin leer (conversaciones con mensajes no leídos)
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

      // Actividades pendientes (para el usuario actual)
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
    ])

    // Procesar presupuestos por estado
    const presupuestosPorEstado: Record<string, number> = {}
    for (const p of resPresupuestos.data || []) {
      presupuestosPorEstado[p.estado] = (presupuestosPorEstado[p.estado] || 0) + 1
    }

    // Conversaciones por canal
    const conversacionesPorCanal: Record<string, number> = {}
    for (const c of resConversaciones.data || []) {
      conversacionesPorCanal[c.tipo_canal] = (conversacionesPorCanal[c.tipo_canal] || 0) + 1
    }

    return NextResponse.json({
      contactos: {
        total: resContactos.count || 0,
        recientes: resContactosRecientes.data || [],
      },
      presupuestos: {
        total: (resPresupuestos.data || []).length,
        por_estado: presupuestosPorEstado,
        recientes: resPresupuestosRecientes.data || [],
      },
      conversaciones: {
        abiertas: resConversaciones.count || 0,
        por_canal: conversacionesPorCanal,
        sin_leer: resMensajesSinLeer.count || 0,
      },
      actividades: {
        pendientes: resActividadesPendientes.data || [],
        total_pendientes: resActividadesTotal.count || 0,
      },
    })
  } catch (err) {
    registrarError(err, { ruta: '/api/dashboard', accion: 'obtener' })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
