import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias/config — Obtener configuración de asistencias + turnos laborales.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [configRes, turnosRes, terminalesRes, sectoresRes, horariosRes] = await Promise.all([
      admin.from('config_asistencias').select('*').eq('empresa_id', empresaId).maybeSingle(),
      admin.from('turnos_laborales').select('*').eq('empresa_id', empresaId).order('creado_en'),
      admin.from('terminales_kiosco').select('*').eq('empresa_id', empresaId).order('creado_en'),
      admin.from('sectores').select('id, nombre, turno_id, activo').eq('empresa_id', empresaId).eq('activo', true).order('orden'),
      // Horarios generales de la empresa (sector_id IS NULL) para mostrar como predeterminado
      admin.from('horarios').select('*').eq('empresa_id', empresaId).is('sector_id', null).order('dia_semana'),
    ])

    // Si no existe config, devolver defaults
    const config = configRes.data || {
      kiosco_habilitado: false,
      kiosco_metodo_lectura: 'rfid_hid',
      kiosco_pin_admin: null,
      kiosco_capturar_foto: false,
      kiosco_modo_empresa: 'logo_y_nombre',
      auto_checkout_habilitado: true,
      auto_checkout_max_horas: 12,
      descontar_almuerzo: true,
      duracion_almuerzo_min: 60,
      horas_minimas_diarias: 0,
      horas_maximas_diarias: 0,
      fichaje_auto_habilitado: false,
      fichaje_auto_notif_min: 10,
      fichaje_auto_umbral_salida: 30,
    }

    return NextResponse.json({
      config,
      turnos: turnosRes.data || [],
      terminales: terminalesRes.data || [],
      sectores: sectoresRes.data || [],
      horarios_empresa: horariosRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/asistencias/config — Actualizar configuración de asistencias.
 * Body: campos parciales de config_asistencias
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Caso especial: asignar turno a sector
    if (body._asignar_sector) {
      const { sector_id, turno_id } = body._asignar_sector
      const { error: errSector } = await admin
        .from('sectores')
        .update({ turno_id })
        .eq('id', sector_id)
        .eq('empresa_id', empresaId)
      if (errSector) return NextResponse.json({ error: errSector.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // Upsert: crear si no existe, actualizar si existe
    const { data, error } = await admin
      .from('config_asistencias')
      .upsert(
        { empresa_id: empresaId, ...body, actualizado_en: new Date().toISOString() },
        { onConflict: 'empresa_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
