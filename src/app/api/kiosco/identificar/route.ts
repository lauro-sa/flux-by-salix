import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/identificar — Buscar empleado por código RFID/NFC/PIN.
 * Body: { codigo, metodo: 'rfid'|'nfc'|'pin', empresaId, terminalId }
 *
 * Retorna datos del empleado + estado del turno actual.
 */
export async function POST(request: NextRequest) {
  try {
    const terminal = await verificarTokenKiosco(request)
    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no autorizada' }, { status: 401 })
    }

    const body = await request.json()
    const { codigo, metodo, empresaId } = body

    if (!codigo || !metodo || !empresaId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const fechaHoy = new Date().toISOString().split('T')[0]

    // Buscar empleado según método
    let filtro: Record<string, string>
    if (metodo === 'pin') {
      filtro = { kiosco_pin: codigo }
    } else {
      // RFID y NFC usan el mismo campo
      filtro = { kiosco_rfid: codigo }
    }

    const { data: miembro } = await admin
      .from('miembros')
      .select(`
        id, usuario_id, activo,
        kiosco_rfid, kiosco_pin, foto_kiosco_url,
        fecha_nacimiento, turno_id, sector,
        puesto_nombre
      `)
      .eq('empresa_id', empresaId)
      .match(filtro)
      .eq('activo', true)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'No reconocido' }, { status: 404 })
    }

    // Obtener nombre del perfil
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre_completo')
      .eq('id', miembro.usuario_id)
      .single()

    const nombre = perfil?.nombre_completo || 'Empleado'

    // Cerrar turno de día anterior si quedó abierto
    const { data: turnoAnterior } = await admin
      .from('asistencias')
      .select('id, fecha')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
      .lt('fecha', fechaHoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (turnoAnterior) {
      await admin
        .from('asistencias')
        .update({
          estado: 'auto_cerrado',
          cierre_automatico: true,
          hora_salida: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', turnoAnterior.id)
    }

    // Buscar turno de hoy
    const { data: turnoHoy } = await admin
      .from('asistencias')
      .select('id, estado, inicio_almuerzo, fin_almuerzo')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .eq('fecha', fechaHoy)
      .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
      .maybeSingle()

    // Buscar solicitudes pendientes/resueltas del último mes
    const hace30dias = new Date()
    hace30dias.setDate(hace30dias.getDate() - 30)

    const { count: cantidadSolicitudes } = await admin
      .from('solicitudes_fichaje')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('solicitante_id', miembro.id)
      .gte('creado_en', hace30dias.toISOString())

    // Actualizar último ping del terminal
    await admin
      .from('terminales_kiosco')
      .update({ ultimo_ping: new Date().toISOString() })
      .eq('id', terminal.id)

    return NextResponse.json({
      miembroId: miembro.id,
      nombre,
      sector: miembro.sector,
      fotoUrl: miembro.foto_kiosco_url,
      fechaNacimiento: miembro.fecha_nacimiento,
      estadoTurno: turnoHoy?.estado ?? null,
      yaAlmorzo: !!(turnoHoy?.inicio_almuerzo && turnoHoy?.fin_almuerzo),
      tieneSolicitudes: (cantidadSolicitudes ?? 0) > 0,
      turnoSinCerrar: !!turnoAnterior,
    })
  } catch (error) {
    console.error('Error en /api/kiosco/identificar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
