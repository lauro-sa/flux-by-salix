import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'
import { formatearFechaISO } from '@/lib/formato-fecha'

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

    // 1) En paralelo: zona horaria del terminal/empresa + empleado por código.
    //    El miembro no depende de la zona, así que ambas van juntas.
    const filtroMiembro: Record<string, string> = metodo === 'pin'
      ? { kiosco_pin: codigo }
      : { kiosco_rfid: codigo } // RFID y NFC usan el mismo campo

    const [zonaRes, miembroRes] = await Promise.all([
      admin
        .from('terminales_kiosco')
        .select('zona_horaria, empresa:empresas(zona_horaria)')
        .eq('id', terminal.id)
        .single(),
      admin
        .from('miembros')
        .select('id, usuario_id, foto_kiosco_url, fecha_nacimiento, sector')
        .eq('empresa_id', empresaId)
        .match(filtroMiembro)
        .eq('activo', true)
        .single(),
    ])

    const miembro = miembroRes.data
    if (!miembro) {
      return NextResponse.json({ error: 'No reconocido' }, { status: 404 })
    }

    const zonaTerminal = zonaRes.data?.zona_horaria as string | null
    const zonaEmpresa = (zonaRes.data?.empresa as { zona_horaria?: string | null } | null)?.zona_horaria ?? null
    const zonaHoraria = zonaTerminal || zonaEmpresa || 'America/Argentina/Buenos_Aires'
    const fechaHoy = formatearFechaISO(new Date(), zonaHoraria)
    const hace30dias = new Date()
    hace30dias.setDate(hace30dias.getDate() - 30)

    // 2) En paralelo: todo lo que depende solo de miembro.id + fechaHoy.
    const [perfilRes, turnoAnteriorRes, turnoHoyRes, configAsistRes, solicitudesRes] = await Promise.all([
      admin
        .from('perfiles')
        .select('nombre, apellido, avatar_url')
        .eq('id', miembro.usuario_id)
        .single(),
      admin
        .from('asistencias')
        .select('id, fecha, hora_salida')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembro.id)
        .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
        .lt('fecha', fechaHoy)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('asistencias')
        .select('id, estado, hora_entrada, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembro.id)
        .eq('fecha', fechaHoy)
        .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
        .maybeSingle(),
      admin
        .from('config_asistencias')
        .select('descontar_almuerzo')
        .eq('empresa_id', empresaId)
        .maybeSingle(),
      admin
        .from('solicitudes_fichaje')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('solicitante_id', miembro.id)
        .gte('creado_en', hace30dias.toISOString()),
    ])

    const perfil = perfilRes.data
    const turnoAnterior = turnoAnteriorRes.data
    const turnoHoy = turnoHoyRes.data
    const descontarAlmuerzo = (configAsistRes.data?.descontar_almuerzo as boolean | null) ?? true
    const cantidadSolicitudes = solicitudesRes.count

    const nombre = perfil
      ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
      : 'Empleado'
    const fotoPerfilUrl = miembro.foto_kiosco_url || perfil?.avatar_url || null

    // 3) Fire-and-forget: cierre de turno anterior + último_ping del terminal.
    //    No bloquean la respuesta — son saneamiento y telemetría.
    if (turnoAnterior) {
      const teniaSalida = !!turnoAnterior.hora_salida
      void admin
        .from('asistencias')
        .update({
          estado: teniaSalida ? 'cerrado' : 'auto_cerrado',
          cierre_automatico: true,
          hora_salida: teniaSalida ? turnoAnterior.hora_salida : new Date().toISOString(),
          metodo_salida: teniaSalida ? 'automatico' : 'sistema',
          notas: teniaSalida
            ? 'Cierre automático — jornada de día anterior completada'
            : 'Cierre automático — turno de día anterior sin salida registrada',
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', turnoAnterior.id)
    }

    void admin
      .from('terminales_kiosco')
      .update({ ultimo_ping: new Date().toISOString() })
      .eq('id', terminal.id)

    // Calcular minutos trabajados netos hasta ahora.
    // Almuerzo se descuenta solo si descontar_almuerzo está activo.
    // Trámite particular se descuenta siempre (ausencia personal).
    // Si está en almuerzo/trámite, el corte es el inicio de esa pausa.
    let minutosTrabajados: number | null = null
    if (turnoHoy?.hora_entrada) {
      const entrada = new Date(turnoHoy.hora_entrada as string).getTime()
      let corte: number
      if (turnoHoy.estado === 'almuerzo' && turnoHoy.inicio_almuerzo && descontarAlmuerzo) {
        corte = new Date(turnoHoy.inicio_almuerzo as string).getTime()
      } else if (turnoHoy.estado === 'particular' && turnoHoy.salida_particular) {
        corte = new Date(turnoHoy.salida_particular as string).getTime()
      } else {
        corte = Date.now()
      }
      let neto = corte - entrada
      if (descontarAlmuerzo && turnoHoy.inicio_almuerzo && turnoHoy.fin_almuerzo) {
        neto -= new Date(turnoHoy.fin_almuerzo as string).getTime() - new Date(turnoHoy.inicio_almuerzo as string).getTime()
      }
      if (turnoHoy.salida_particular && turnoHoy.vuelta_particular) {
        neto -= new Date(turnoHoy.vuelta_particular as string).getTime() - new Date(turnoHoy.salida_particular as string).getTime()
      }
      minutosTrabajados = Math.max(0, Math.floor(neto / 60000))
    }

    return NextResponse.json({
      miembroId: miembro.id,
      nombre,
      sector: miembro.sector,
      fotoUrl: fotoPerfilUrl,
      fechaNacimiento: miembro.fecha_nacimiento,
      estadoTurno: turnoHoy?.estado ?? null,
      yaAlmorzo: !!(turnoHoy?.inicio_almuerzo && turnoHoy?.fin_almuerzo),
      tieneSolicitudes: (cantidadSolicitudes ?? 0) > 0,
      turnoSinCerrar: !!turnoAnterior,
      minutosTrabajados,
    })
  } catch (error) {
    console.error('Error en /api/kiosco/identificar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
