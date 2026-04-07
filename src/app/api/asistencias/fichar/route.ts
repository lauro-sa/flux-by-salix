import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

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
    const fechaHoy = new Date().toISOString().split('T')[0]

    // Obtener miembro actual
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, turno_id, metodo_fichaje')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) return NextResponse.json({ error: 'No sos miembro de esta empresa' }, { status: 403 })

    // Buscar turno abierto de hoy
    const { data: turnoHoy } = await admin
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .eq('fecha', fechaHoy)
      .maybeSingle()

    // Cerrar turno huérfano de día anterior si existe
    const { data: turnoViejo } = await admin
      .from('asistencias')
      .select('id, fecha')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .in('estado', ['activo', 'almuerzo', 'particular'])
      .neq('fecha', fechaHoy)
      .limit(1)
      .maybeSingle()

    if (turnoViejo) {
      await admin
        .from('asistencias')
        .update({
          estado: 'auto_cerrado',
          hora_salida: ahora,
          cierre_automatico: true,
          notas: 'Cierre automático — nueva entrada detectada',
          actualizado_en: ahora,
        })
        .eq('id', turnoViejo.id)
    }

    // Resolver turno laboral del miembro (miembro → sector → default)
    let turnoLaboralId: string | null = miembro.turno_id
    if (!turnoLaboralId) {
      // Buscar sector primario del miembro
      const { data: memSector } = await admin
        .from('miembros_sectores')
        .select('sector:sectores(turno_id)')
        .eq('miembro_id', miembro.id)
        .eq('es_primario', true)
        .maybeSingle()

      const sector = memSector?.sector as unknown as { turno_id: string | null } | null
      turnoLaboralId = sector?.turno_id || null

      if (!turnoLaboralId) {
        // Usar default de la empresa
        const { data: turnoDefault } = await admin
          .from('turnos_laborales')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('es_default', true)
          .maybeSingle()
        turnoLaboralId = turnoDefault?.id || null
      }
    }

    // Calcular puntualidad si es entrada
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
        const hoy = diasSemana[new Date().getDay()]
        const dias = turnoLaboral.dias as Record<string, { activo: boolean; desde: string; hasta: string }>
        const diaConfig = dias[hoy]

        if (diaConfig?.activo && diaConfig.desde) {
          const [hEsperada, mEsperada] = diaConfig.desde.split(':').map(Number)
          const ahoraDate = new Date()
          const minutosActual = ahoraDate.getHours() * 60 + ahoraDate.getMinutes()
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
    const fechaHoy = new Date().toISOString().split('T')[0]

    const { data: miembro } = await admin
      .from('miembros')
      .select('id, metodo_fichaje')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) return NextResponse.json({ error: 'No sos miembro' }, { status: 403 })

    const { data: turnoHoy } = await admin
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('miembro_id', miembro.id)
      .eq('fecha', fechaHoy)
      .maybeSingle()

    // Obtener config de la empresa para saber si fichaje auto está habilitado
    const { data: config } = await admin
      .from('config_asistencias')
      .select('fichaje_auto_habilitado, descontar_almuerzo, duracion_almuerzo_min')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    return NextResponse.json({
      turno: turnoHoy,
      metodo_fichaje: miembro.metodo_fichaje,
      config: config || { fichaje_auto_habilitado: false, descontar_almuerzo: true, duracion_almuerzo_min: 60 },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
