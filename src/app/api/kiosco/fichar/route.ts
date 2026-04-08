import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/fichar — Registrar acción de fichaje desde terminal kiosco.
 * Body: { miembroId, accion, empresaId, terminalId, terminalNombre }
 *
 * Reutiliza la lógica del fichar principal pero con auth de terminal.
 */
export async function POST(request: NextRequest) {
  try {
    const terminal = await verificarTokenKiosco(request)
    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no autorizada' }, { status: 401 })
    }

    const body = await request.json()
    const { miembroId, accion, empresaId, terminalId, terminalNombre } = body

    if (!miembroId || !accion || !empresaId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date().toISOString()

    // Obtener zona horaria de la empresa
    const { data: empresaData } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', empresaId)
      .single()
    const zonaHoraria = empresaData?.zona_horaria || 'America/Argentina/Buenos_Aires'
    const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: zonaHoraria })

    // Obtener datos del miembro para resolución de turno
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, turno_id, sector')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }

    // Buscar turno abierto de hoy
    const { data: turnoHoy } = await admin
      .from('asistencias')
      .select('id, estado, hora_entrada, inicio_almuerzo, fin_almuerzo')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembroId)
      .eq('fecha', fechaHoy)
      .not('estado', 'in', '("cerrado","auto_cerrado","ausente")')
      .maybeSingle()

    let asistenciaId: string | null = null
    let horasTrabajadas: string | null = null
    let jornadaCompleta = false

    // Resolver turno laboral del miembro
    let turnoId = miembro.turno_id
    let puntualidadMin: number | null = null
    let tipoRegistro = 'normal'

    if (!turnoId) {
      // Buscar turno del sector primario
      const { data: miembroSector } = await admin
        .from('miembros_sectores')
        .select('sector_id')
        .eq('miembro_id', miembroId)
        .eq('es_primario', true)
        .maybeSingle()

      if (miembroSector) {
        const { data: sectorData } = await admin
          .from('sectores')
          .select('turno_id')
          .eq('id', miembroSector.sector_id)
          .single()
        turnoId = sectorData?.turno_id || null
      }
    }

    if (!turnoId) {
      // Turno default de la empresa
      const { data: turnoDefault } = await admin
        .from('turnos_laborales')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('es_default', true)
        .maybeSingle()
      turnoId = turnoDefault?.id || null
    }

    // Calcular puntualidad si es entrada
    if (accion === 'entrada' && turnoId) {
      const { data: turnoLaboral } = await admin
        .from('turnos_laborales')
        .select('flexible, tolerancia_min, dias')
        .eq('id', turnoId)
        .single()

      if (turnoLaboral && !turnoLaboral.flexible && turnoLaboral.dias) {
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        const hoy = new Date()
        const diaKey = diasSemana[hoy.getDay()]
        const diaConfig = (turnoLaboral.dias as Record<string, { activo: boolean; desde: string; hasta: string }>)[diaKey]

        if (diaConfig?.activo && diaConfig.desde) {
          const [horaEsperada, minEsperado] = diaConfig.desde.split(':').map(Number)
          const minutosEsperado = horaEsperada * 60 + minEsperado
          const minutosActual = hoy.getHours() * 60 + hoy.getMinutes()
          puntualidadMin = minutosActual - minutosEsperado

          const tolerancia = turnoLaboral.tolerancia_min ?? 10
          if (puntualidadMin > tolerancia) {
            tipoRegistro = 'tardanza'
          }
        }
      }
    }

    switch (accion) {
      case 'entrada': {
        if (turnoHoy) {
          return NextResponse.json({ error: 'Ya tenés un turno abierto' }, { status: 400 })
        }

        const { data: nuevo } = await admin
          .from('asistencias')
          .insert({
            empresa_id: empresaId,
            miembro_id: miembroId,
            fecha: fechaHoy,
            hora_entrada: ahora,
            estado: 'activo',
            tipo: tipoRegistro,
            puntualidad_min: puntualidadMin,
            metodo_registro: 'rfid', // Se actualiza con el método real en identificar
            terminal_id: terminalId,
            terminal_nombre: terminalNombre,
            turno_id: turnoId,
            creado_en: ahora,
            actualizado_en: ahora,
          })
          .select('id')
          .single()

        asistenciaId = nuevo?.id || null
        break
      }

      case 'salida': {
        if (!turnoHoy) {
          return NextResponse.json({ error: 'No tenés turno abierto' }, { status: 400 })
        }

        // Calcular horas trabajadas
        if (turnoHoy.hora_entrada) {
          const entrada = new Date(turnoHoy.hora_entrada)
          const salida = new Date()
          let diffMs = salida.getTime() - entrada.getTime()

          // Descontar almuerzo si aplica
          if (turnoHoy.inicio_almuerzo && turnoHoy.fin_almuerzo) {
            const inicioAlm = new Date(turnoHoy.inicio_almuerzo)
            const finAlm = new Date(turnoHoy.fin_almuerzo)
            diffMs -= finAlm.getTime() - inicioAlm.getTime()
          }

          const horas = Math.floor(diffMs / 3600000)
          const minutos = Math.floor((diffMs % 3600000) / 60000)
          horasTrabajadas = `${horas}h ${minutos}min`

          // Verificar jornada completa (8h o más = completa)
          jornadaCompleta = diffMs >= 8 * 3600000
        }

        await admin
          .from('asistencias')
          .update({
            hora_salida: ahora,
            estado: 'cerrado',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)

        asistenciaId = turnoHoy.id
        break
      }

      case 'almuerzo': {
        if (!turnoHoy) {
          return NextResponse.json({ error: 'No tenés turno abierto' }, { status: 400 })
        }
        await admin
          .from('asistencias')
          .update({
            inicio_almuerzo: ahora,
            estado: 'almuerzo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
        asistenciaId = turnoHoy.id
        break
      }

      case 'volver_almuerzo': {
        if (!turnoHoy) {
          return NextResponse.json({ error: 'No tenés turno abierto' }, { status: 400 })
        }
        await admin
          .from('asistencias')
          .update({
            fin_almuerzo: ahora,
            estado: 'activo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
        asistenciaId = turnoHoy.id
        break
      }

      case 'particular': {
        if (!turnoHoy) {
          return NextResponse.json({ error: 'No tenés turno abierto' }, { status: 400 })
        }
        await admin
          .from('asistencias')
          .update({
            salida_particular: ahora,
            estado: 'particular',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
        asistenciaId = turnoHoy.id
        break
      }

      case 'volver_particular': {
        if (!turnoHoy) {
          return NextResponse.json({ error: 'No tenés turno abierto' }, { status: 400 })
        }
        await admin
          .from('asistencias')
          .update({
            vuelta_particular: ahora,
            estado: 'activo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
        asistenciaId = turnoHoy.id
        break
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      asistenciaId,
      horasTrabajadas,
      jornadaCompleta,
    })
  } catch (error) {
    console.error('Error en /api/kiosco/fichar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
