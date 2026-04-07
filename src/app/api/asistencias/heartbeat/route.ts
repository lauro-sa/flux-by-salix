import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/asistencias/heartbeat — Registrar heartbeat de actividad.
 * Se llama cada 5 minutos si la pestaña está visible.
 * Para miembros con fichaje automático, también actualiza hora_salida tentativa.
 *
 * Body: {
 *   tipo?: 'heartbeat' | 'login' | 'beforeunload' | 'visibility'
 *   metadata?: { navegador, so, dispositivo, pestana_visible }
 *   ubicacion?: { lat, lng, direccion, barrio, ciudad }
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
    const { tipo = 'heartbeat', metadata, ubicacion } = body

    const admin = crearClienteAdmin()
    const ahora = new Date().toISOString()
    const fechaHoy = new Date().toISOString().split('T')[0]

    // Obtener miembro
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, metodo_fichaje')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) return NextResponse.json({ error: 'No sos miembro' }, { status: 403 })

    // Registrar heartbeat en fichajes_actividad
    await admin
      .from('fichajes_actividad')
      .insert({
        empresa_id: empresaId,
        miembro_id: miembro.id,
        fecha: fechaHoy,
        timestamp: ahora,
        tipo,
        metadata: metadata || null,
      })

    // Si tiene fichaje automático, manejar entrada/salida tentativa
    if (miembro.metodo_fichaje === 'automatico') {
      const { data: turnoHoy } = await admin
        .from('asistencias')
        .select('id, estado')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembro.id)
        .eq('fecha', fechaHoy)
        .maybeSingle()

      if (!turnoHoy && tipo !== 'beforeunload') {
        // No hay turno hoy → crear entrada automática
        await admin
          .from('asistencias')
          .insert({
            empresa_id: empresaId,
            miembro_id: miembro.id,
            fecha: fechaHoy,
            hora_entrada: ahora,
            hora_salida: ahora, // salida tentativa = ahora (se actualiza en cada heartbeat)
            estado: 'activo',
            tipo: 'flexible',
            metodo_registro: 'automatico',
            ubicacion_entrada: ubicacion || null,
            creado_por: miembro.id,
          })

        return NextResponse.json({ accion: 'entrada_automatica', mensaje: 'Fichaje automático registrado' })
      }

      if (turnoHoy && turnoHoy.estado === 'activo') {
        // Actualizar hora_salida tentativa con el último heartbeat
        await admin
          .from('asistencias')
          .update({
            hora_salida: ahora,
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
