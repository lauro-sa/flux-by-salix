import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/presupuestos/config — Obtener configuración de presupuestos de la empresa.
 * Si no existe, crea una con valores por defecto.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de presupuestos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_presupuestos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de presupuestos' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Intentar obtener config existente
    let { data: config } = await admin
      .from('config_presupuestos')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    // Si no existe, crear con defaults
    if (!config) {
      await admin.rpc('seed_config_presupuestos', { p_empresa_id: empresaId })

      const { data: nuevaConfig } = await admin
        .from('config_presupuestos')
        .select('*')
        .eq('empresa_id', empresaId)
        .single()

      config = nuevaConfig
    }

    // Obtener secuencia actual
    const { data: secuencia } = await admin
      .from('secuencias')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('entidad', 'presupuesto')
      .maybeSingle()

    return NextResponse.json({
      ...config,
      secuencia: secuencia || { prefijo: 'P', siguiente: 1, digitos: 4 },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/presupuestos/config — Actualizar configuración de presupuestos.
 * Acepta campos parciales: impuestos, monedas, condiciones_pago, unidades, etc.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de presupuestos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de presupuestos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const camposPermitidos = [
      'impuestos', 'monedas', 'moneda_predeterminada',
      'condiciones_pago', 'dias_vencimiento_predeterminado', 'validez_bloqueada',
      'condiciones_predeterminadas', 'notas_predeterminadas',
      'unidades', 'columnas_lineas_default',
      'plantillas', 'plantillas_predeterminadas',
      // Configuración PDF
      'membrete', 'pie_pagina', 'plantilla_html',
      'patron_nombre_pdf', 'datos_empresa_pdf',
    ]

    const actualizacion: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        actualizacion[campo] = body[campo]
      }
    }

    // Upsert para asegurar que existe
    const { data: config, error } = await admin
      .from('config_presupuestos')
      .upsert({ empresa_id: empresaId, ...actualizacion })
      .select('*')
      .single()

    if (error) {
      console.error('Error al actualizar config:', error)
      return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
    }

    // Si se actualizaron condiciones_pago, sincronizar labels en presupuestos existentes
    if (body.condiciones_pago && Array.isArray(body.condiciones_pago)) {
      for (const cond of body.condiciones_pago) {
        if (cond.id && cond.label) {
          await admin
            .from('presupuestos')
            .update({ condicion_pago_label: cond.label })
            .eq('empresa_id', empresaId)
            .eq('condicion_pago_id', cond.id)
        }
      }
    }

    // Si se actualizó la secuencia
    if (body.secuencia) {
      await admin
        .from('secuencias')
        .upsert({
          empresa_id: empresaId,
          entidad: 'presupuesto',
          prefijo: body.secuencia.prefijo || 'P',
          digitos: body.secuencia.digitos || 4,
          ...(body.secuencia.siguiente ? { siguiente: body.secuencia.siguiente } : {}),
          ...(body.secuencia.componentes ? { componentes: body.secuencia.componentes } : {}),
          ...(body.secuencia.reinicio ? { reinicio: body.secuencia.reinicio } : {}),
        })
    }

    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
