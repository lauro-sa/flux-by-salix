import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

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

    const body = await request.json()
    const admin = crearClienteAdmin()

    const camposPermitidos = [
      'impuestos', 'monedas', 'moneda_predeterminada',
      'condiciones_pago', 'dias_vencimiento_predeterminado',
      'condiciones_predeterminadas', 'notas_predeterminadas',
      'unidades', 'columnas_lineas_default',
      'plantillas', 'plantillas_predeterminadas',
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
        })
    }

    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
