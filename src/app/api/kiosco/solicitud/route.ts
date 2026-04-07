import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/solicitud — Crear solicitud de fichaje (reclamo) desde kiosco.
 * Body: { miembroId, empresaId, terminalNombre, fecha, horaEntrada, horaSalida, motivo }
 */
export async function POST(request: NextRequest) {
  try {
    const terminal = await verificarTokenKiosco(request)
    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no autorizada' }, { status: 401 })
    }

    const body = await request.json()
    const { miembroId, empresaId, terminalNombre, fecha, horaEntrada, horaSalida, motivo } = body

    if (!miembroId || !empresaId || !fecha || !horaEntrada || !horaSalida || !motivo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que no exista solicitud para ese día
    const { data: existente } = await admin
      .from('solicitudes_fichaje')
      .select('id, estado, es_apelacion')
      .eq('empresa_id', empresaId)
      .eq('solicitante_id', miembroId)
      .eq('fecha', fecha)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      // Si fue rechazada y no es apelación → permitir apelar
      if (existente.estado === 'rechazada' && !existente.es_apelacion) {
        // Crear apelación
        const { error } = await admin
          .from('solicitudes_fichaje')
          .insert({
            empresa_id: empresaId,
            solicitante_id: miembroId,
            fecha,
            hora_entrada: horaEntrada,
            hora_salida: horaSalida,
            motivo,
            terminal_nombre: terminalNombre,
            estado: 'pendiente',
            solicitud_original_id: existente.id,
            es_apelacion: true,
            motivo_apelacion: motivo,
            creado_en: new Date().toISOString(),
          })

        if (error) {
          console.error('Error al crear apelación:', error)
          return NextResponse.json({ error: 'Error al enviar apelación' }, { status: 500 })
        }

        return NextResponse.json({ ok: true, tipo: 'apelacion' })
      }

      // Si fue rechazada y ya es apelación → no se puede apelar más
      if (existente.estado === 'rechazada' && existente.es_apelacion) {
        return NextResponse.json(
          { error: 'Ya apelaste esta solicitud. Consultá con Recursos Humanos.' },
          { status: 400 },
        )
      }

      // Si está pendiente o aprobada → ya existe
      return NextResponse.json(
        { error: 'Ya existe una solicitud para ese día' },
        { status: 400 },
      )
    }

    // Crear solicitud nueva
    const { error } = await admin
      .from('solicitudes_fichaje')
      .insert({
        empresa_id: empresaId,
        solicitante_id: miembroId,
        fecha,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        motivo,
        terminal_nombre: terminalNombre,
        estado: 'pendiente',
        creado_en: new Date().toISOString(),
      })

    if (error) {
      console.error('Error al crear solicitud:', error)
      return NextResponse.json({ error: 'Error al enviar solicitud' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tipo: 'nueva' })
  } catch (error) {
    console.error('Error en /api/kiosco/solicitud:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
