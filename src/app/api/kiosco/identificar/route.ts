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

    // Zona horaria: primero la del terminal, si no la de la empresa
    const { data: terminalData } = await admin
      .from('terminales_kiosco')
      .select('zona_horaria')
      .eq('id', terminal.id)
      .single()

    let zonaHoraria = terminalData?.zona_horaria as string | null
    if (!zonaHoraria) {
      const { data: empresa } = await admin
        .from('empresas')
        .select('zona_horaria')
        .eq('id', empresaId)
        .single()
      zonaHoraria = (empresa?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    }
    const fechaHoy = formatearFechaISO(new Date(), zonaHoraria)

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

    // Obtener nombre y foto del perfil
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', miembro.usuario_id)
      .single()

    const nombre = perfil
      ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
      : 'Empleado'
    const fotoPerfilUrl = miembro.foto_kiosco_url || perfil?.avatar_url || null

    // Cerrar turno de día anterior si quedó abierto
    const { data: turnoAnterior } = await admin
      .from('asistencias')
      .select('id, fecha, hora_salida')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
      .lt('fecha', fechaHoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (turnoAnterior) {
      const teniaSalida = !!turnoAnterior.hora_salida
      await admin
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

    // Buscar turno de hoy
    const { data: turnoHoy } = await admin
      .from('asistencias')
      .select('id, estado, hora_entrada, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .eq('fecha', fechaHoy)
      .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
      .maybeSingle()

    // Calcular minutos trabajados netos hasta ahora
    // El almuerzo se descuenta solo si config_asistencias.descontar_almuerzo está activo
    // El trámite particular siempre se descuenta (es ausencia personal)
    // Si está en almuerzo/trámite, el corte es el inicio de esa pausa
    let minutosTrabajados: number | null = null
    if (turnoHoy?.hora_entrada) {
      const { data: configAsist } = await admin
        .from('config_asistencias')
        .select('descontar_almuerzo')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      const descontarAlmuerzo = (configAsist?.descontar_almuerzo as boolean | null) ?? true

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
