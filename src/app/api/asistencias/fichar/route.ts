import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { formatearFechaISO } from '@/lib/formato-fecha'

/**
 * POST /api/asistencias/fichar — Registrar acción de fichaje.
 * Body: {
 *   accion: 'entrada' | 'salida' | 'almuerzo' | 'volver_almuerzo' | 'particular' | 'volver_particular'
 *   ubicacion?: { lat: number, lng: number, direccion?: string, barrio?: string, ciudad?: string }
 *   metodo?: 'manual' | 'automatico'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { accion, ubicacion, metodo = 'manual' } = body

    const admin = crearClienteAdmin()
    const ahora = new Date().toISOString()

    // Paso 1: empresa + miembro en paralelo
    const [empresaRes, miembroRes] = await Promise.all([
      admin.from('empresas').select('zona_horaria').eq('id', empresaId).single(),
      admin.from('miembros').select('id, turno_id, metodo_fichaje').eq('usuario_id', user.id).eq('empresa_id', empresaId).single(),
    ])

    const zona = (empresaRes.data?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fechaHoy = formatearFechaISO(new Date(), zona)
    const miembro = miembroRes.data

    if (!miembro) return NextResponse.json({ error: 'No sos miembro de esta empresa' }, { status: 403 })

    // Paso 2: turnoHoy + turnoViejo + sector + turnoDefault — todo en paralelo
    const [turnoHoyRes, turnoViejoRes, memSectorRes, turnoDefaultRes] = await Promise.all([
      admin.from('asistencias').select('*').eq('empresa_id', empresaId).eq('miembro_id', miembro.id).eq('fecha', fechaHoy).maybeSingle(),
      admin.from('asistencias').select('id, fecha, hora_salida').eq('empresa_id', empresaId).eq('miembro_id', miembro.id).in('estado', ['activo', 'almuerzo', 'particular']).neq('fecha', fechaHoy).limit(1).maybeSingle(),
      !miembro.turno_id
        ? admin.from('miembros_sectores').select('sector:sectores(turno_id)').eq('miembro_id', miembro.id).eq('es_primario', true).maybeSingle()
        : Promise.resolve({ data: null }),
      !miembro.turno_id
        ? admin.from('turnos_laborales').select('id').eq('empresa_id', empresaId).eq('es_default', true).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const turnoHoy = turnoHoyRes.data

    // Cerrar turno huérfano de día anterior (fire-and-forget)
    const turnoViejo = turnoViejoRes.data
    if (turnoViejo) {
      const teniaSalida = !!turnoViejo.hora_salida
      admin.from('asistencias').update({
        estado: teniaSalida ? 'cerrado' : 'auto_cerrado',
        hora_salida: teniaSalida ? turnoViejo.hora_salida : ahora,
        metodo_salida: teniaSalida ? 'automatico' : 'sistema',
        cierre_automatico: true,
        notas: teniaSalida
          ? 'Cierre automático — jornada completada (nueva entrada detectada)'
          : 'Cierre automático — nueva entrada detectada sin salida previa',
        actualizado_en: ahora,
      }).eq('id', turnoViejo.id).then(() => {})
    }

    // Resolver turno laboral: miembro → sector → default
    let turnoLaboralId: string | null = miembro.turno_id
    if (!turnoLaboralId) {
      const sector = memSectorRes.data?.sector as unknown as { turno_id: string | null } | null
      turnoLaboralId = sector?.turno_id || turnoDefaultRes.data?.id || null
    }

    // Calcular puntualidad si es entrada (usar hora local de la empresa, no UTC)
    let puntualidadMin: number | null = null
    let tipo = 'normal'
    if (accion === 'entrada' && turnoLaboralId) {
      const { data: turnoLaboral } = await admin
        .from('turnos_laborales')
        .select('dias, tolerancia_min, flexible')
        .eq('id', turnoLaboralId)
        .single()

      if (turnoLaboral && !turnoLaboral.flexible) {
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        const ahoraLocal = new Date(new Date().toLocaleString('en-US', { timeZone: zona }))
        const hoy = diasSemana[ahoraLocal.getDay()]
        const dias = turnoLaboral.dias as Record<string, { activo: boolean; desde: string; hasta: string }>
        const diaConfig = dias[hoy]

        if (diaConfig?.activo && diaConfig.desde) {
          const [hEsperada, mEsperada] = diaConfig.desde.split(':').map(Number)
          const minutosActual = ahoraLocal.getHours() * 60 + ahoraLocal.getMinutes()
          const minutosEsperado = hEsperada * 60 + mEsperada
          puntualidadMin = minutosActual - minutosEsperado

          if (puntualidadMin > (turnoLaboral.tolerancia_min || 10)) {
            tipo = 'tardanza'
          }
        }
      }

      if (turnoLaboral?.flexible) {
        tipo = 'flexible'
      }
    }

    // Ejecutar acción
    switch (accion) {
      case 'entrada': {
        if (turnoHoy) {
          return NextResponse.json({ error: 'Ya fichaste entrada hoy', turno: turnoHoy }, { status: 400 })
        }

        const { data: nuevo, error } = await admin
          .from('asistencias')
          .insert({
            empresa_id: empresaId,
            miembro_id: miembro.id,
            fecha: fechaHoy,
            hora_entrada: ahora,
            estado: 'activo',
            tipo,
            puntualidad_min: puntualidadMin,
            metodo_registro: metodo,
            turno_id: turnoLaboralId,
            ubicacion_entrada: ubicacion || null,
            creado_por: miembro.id,
          })
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'entrada', registro: nuevo })
      }

      case 'salida': {
        if (!turnoHoy) return NextResponse.json({ error: 'No hay turno abierto hoy' }, { status: 400 })

        const { data: actualizado, error } = await admin
          .from('asistencias')
          .update({
            hora_salida: ahora,
            estado: 'cerrado',
            metodo_salida: metodo,
            ubicacion_salida: ubicacion || null,
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'salida', registro: actualizado })
      }

      case 'almuerzo': {
        if (!turnoHoy || turnoHoy.estado !== 'activo') {
          return NextResponse.json({ error: 'No estás en turno activo' }, { status: 400 })
        }

        const { data: actualizado, error } = await admin
          .from('asistencias')
          .update({
            inicio_almuerzo: ahora,
            estado: 'almuerzo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'almuerzo', registro: actualizado })
      }

      case 'volver_almuerzo': {
        if (!turnoHoy || turnoHoy.estado !== 'almuerzo') {
          return NextResponse.json({ error: 'No estás en almuerzo' }, { status: 400 })
        }

        const { data: actualizado, error } = await admin
          .from('asistencias')
          .update({
            fin_almuerzo: ahora,
            estado: 'activo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'volver_almuerzo', registro: actualizado })
      }

      case 'particular': {
        if (!turnoHoy || turnoHoy.estado !== 'activo') {
          return NextResponse.json({ error: 'No estás en turno activo' }, { status: 400 })
        }

        const { data: actualizado, error } = await admin
          .from('asistencias')
          .update({
            salida_particular: ahora,
            estado: 'particular',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'particular', registro: actualizado })
      }

      case 'volver_particular': {
        if (!turnoHoy || turnoHoy.estado !== 'particular') {
          return NextResponse.json({ error: 'No estás en trámite' }, { status: 400 })
        }

        const { data: actualizado, error } = await admin
          .from('asistencias')
          .update({
            vuelta_particular: ahora,
            estado: 'activo',
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accion: 'volver_particular', registro: actualizado })
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * GET /api/asistencias/fichar — Obtener turno actual del usuario.
 * Devuelve el registro de asistencia de hoy (si existe).
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Paso 1: empresa + miembro en paralelo (ambos independientes)
    const [empresaGetRes, miembroRes] = await Promise.all([
      admin.from('empresas').select('zona_horaria').eq('id', empresaId).single(),
      admin.from('miembros').select('id, turno_id, metodo_fichaje').eq('usuario_id', user.id).eq('empresa_id', empresaId).single(),
    ])

    const zonaGet = (empresaGetRes.data?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fechaHoy = formatearFechaISO(new Date(), zonaGet)
    const miembro = miembroRes.data

    if (!miembro) return NextResponse.json({ error: 'No sos miembro' }, { status: 403 })

    // Paso 2: turnoHoy + config + turnoViejo + sector + horarioEmpresa + turnoDefault — todo en paralelo
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    const diaSemanaIdx = new Date().getDay()
    const diaHoy = diasSemana[diaSemanaIdx]

    const [turnoHoyRes, configRes, turnoViejoRes, memSectorRes, horarioEmpresaRes, turnoDefaultRes, turnoMiembroRes] = await Promise.all([
      admin.from('asistencias').select('*').eq('empresa_id', empresaId).eq('miembro_id', miembro.id).eq('fecha', fechaHoy).maybeSingle(),
      admin.from('config_asistencias').select('fichaje_auto_habilitado, descontar_almuerzo, duracion_almuerzo_min').eq('empresa_id', empresaId).maybeSingle(),
      admin.from('asistencias').select('id, hora_salida, hora_entrada').eq('empresa_id', empresaId).eq('miembro_id', miembro.id).in('estado', ['activo', 'almuerzo', 'particular']).neq('fecha', fechaHoy).limit(1).maybeSingle(),
      // Sector primario (para resolver turno laboral si miembro no tiene uno directo)
      !miembro.turno_id
        ? admin.from('miembros_sectores').select('sector:sectores(turno_id)').eq('miembro_id', miembro.id).eq('es_primario', true).maybeSingle()
        : Promise.resolve({ data: null }),
      // Horario empresa (fallback 2)
      admin.from('horarios').select('hora_inicio, hora_fin, activo').eq('empresa_id', empresaId).is('sector_id', null).eq('dia_semana', diaSemanaIdx === 0 ? 6 : diaSemanaIdx - 1).maybeSingle(),
      // Turno default empresa (fallback 3)
      admin.from('turnos_laborales').select('id, dias').eq('empresa_id', empresaId).eq('es_default', true).maybeSingle(),
      // Turno laboral del miembro (si tiene turno_id directo)
      miembro.turno_id
        ? admin.from('turnos_laborales').select('dias').eq('id', miembro.turno_id).single()
        : Promise.resolve({ data: null }),
    ])

    // Cerrar turno huérfano de día anterior (fire-and-forget, no bloquea respuesta)
    const turnoViejo = turnoViejoRes.data
    if (turnoViejo) {
      const ahora = new Date().toISOString()
      const teniaSalida = !!turnoViejo.hora_salida
      const horaSalida = turnoViejo.hora_salida || turnoViejo.hora_entrada
      admin.from('asistencias').update({
        hora_salida: horaSalida,
        estado: teniaSalida ? 'cerrado' : 'auto_cerrado',
        metodo_salida: teniaSalida ? 'automatico' : 'sistema',
        cierre_automatico: true,
        notas: teniaSalida
          ? 'Cierre automático — jornada de día anterior completada'
          : 'Cierre automático — turno de día anterior sin salida registrada',
        actualizado_en: ahora,
      }).eq('id', turnoViejo.id).then(() => {})
    }

    // Resolver horario del día: miembro → sector → horarios empresa → turno default
    let horarioHoy: { desde: string; hasta: string } | null = null

    // 1) Turno directo del miembro
    if (miembro.turno_id && turnoMiembroRes.data) {
      const dias = turnoMiembroRes.data.dias as Record<string, { activo: boolean; desde: string; hasta: string }>
      const diaConfig = dias[diaHoy]
      if (diaConfig?.activo) horarioHoy = { desde: diaConfig.desde, hasta: diaConfig.hasta }
    }

    // 2) Turno del sector primario
    if (!horarioHoy && !miembro.turno_id) {
      const sector = memSectorRes.data?.sector as unknown as { turno_id: string | null } | null
      if (sector?.turno_id) {
        // Necesitamos una query extra solo si el sector tiene turno
        const { data: turnoSector } = await admin.from('turnos_laborales').select('dias').eq('id', sector.turno_id).single()
        if (turnoSector) {
          const dias = turnoSector.dias as Record<string, { activo: boolean; desde: string; hasta: string }>
          const diaConfig = dias[diaHoy]
          if (diaConfig?.activo) horarioHoy = { desde: diaConfig.desde, hasta: diaConfig.hasta }
        }
      }
    }

    // 3) Horario de empresa
    if (!horarioHoy && horarioEmpresaRes.data?.activo) {
      horarioHoy = { desde: horarioEmpresaRes.data.hora_inicio, hasta: horarioEmpresaRes.data.hora_fin }
    }

    // 4) Turno default
    if (!horarioHoy && turnoDefaultRes.data) {
      const dias = turnoDefaultRes.data.dias as Record<string, { activo: boolean; desde: string; hasta: string }>
      const diaConfig = dias[diaHoy]
      if (diaConfig?.activo) horarioHoy = { desde: diaConfig.desde, hasta: diaConfig.hasta }
    }

    return NextResponse.json({
      turno: turnoHoyRes.data,
      metodo_fichaje: miembro.metodo_fichaje,
      config: configRes.data || { fichaje_auto_habilitado: false, descontar_almuerzo: true, duracion_almuerzo_min: 60 },
      horario_hoy: horarioHoy, // { desde: '09:00', hasta: '18:00' } o null
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
