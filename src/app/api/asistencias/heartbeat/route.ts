import { NextResponse, type NextRequest } from 'next/server'
import { requerirFichajePropioAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { formatearFechaISO } from '@/lib/formato-fecha'

/**
 * POST /api/asistencias/heartbeat — Registrar heartbeat de actividad.
 * Se llama cada 5 minutos si la pestaña está visible y el usuario interactúa.
 * Para miembros con fichaje automático:
 *   - Crea entrada automática en el primer heartbeat del día
 *   - Actualiza hora_salida tentativa con cada heartbeat (salida rolling)
 * Devuelve estado para que el cliente muestre notificaciones.
 *
 * Body: {
 *   tipo?: 'heartbeat' | 'login' | 'beforeunload' | 'visibility'
 *   metadata?: { navegador, pestana_visible, ultimo_input_hace_ms }
 *   ubicacion?: { lat, lng, direccion, barrio, ciudad }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirFichajePropioAPI()
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId, miembroId, metodoFichaje } = guard

    const body = await request.json()
    const { tipo = 'heartbeat', metadata, ubicacion } = body

    const admin = crearClienteAdmin()
    const ahora = new Date().toISOString()

    // Zona horaria de la empresa + bandera de fichaje auto en móvil del miembro
    const [empresaRes, miembroExtraRes] = await Promise.all([
      admin.from('empresas').select('zona_horaria').eq('id', empresaId).single(),
      admin.from('miembros').select('fichaje_auto_movil').eq('id', miembroId).single(),
    ])
    const zona = (empresaRes.data?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fechaHoy = formatearFechaISO(new Date(), zona) // YYYY-MM-DD

    const miembro = {
      id: miembroId,
      usuario_id: user.id,
      metodo_fichaje: metodoFichaje,
      fichaje_auto_movil: !!miembroExtraRes.data?.fichaje_auto_movil,
    }

    // Registrar heartbeat en fichajes_actividad (siempre, independiente del dispositivo)
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

    // Verificar si la empresa tiene fichaje automático habilitado
    const { data: configAsist } = await admin
      .from('config_asistencias')
      .select('fichaje_auto_habilitado')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    // Fichaje auto requiere: empresa lo habilita + miembro tiene método 'automatico'
    const esMovil = metadata?.es_movil === true
    const fichajePermitido = (configAsist?.fichaje_auto_habilitado ?? false)
      && miembro.metodo_fichaje === 'automatico'
      && (!esMovil || miembro.fichaje_auto_movil)

    if (fichajePermitido) {
      // Cerrar turno huérfano de día anterior (misma lógica que /fichar)
      const { data: turnoViejo } = await admin
        .from('asistencias')
        .select('id, fecha, hora_salida')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembro.id)
        .in('estado', ['activo', 'almuerzo', 'particular'])
        .neq('fecha', fechaHoy)
        .limit(1)
        .maybeSingle()

      if (turnoViejo) {
        const teniaSalida = !!turnoViejo.hora_salida
        await admin
          .from('asistencias')
          .update({
            estado: teniaSalida ? 'cerrado' : 'auto_cerrado',
            hora_salida: teniaSalida ? turnoViejo.hora_salida : ahora,
            metodo_salida: teniaSalida ? 'automatico' : 'sistema',
            cierre_automatico: true,
            notas: teniaSalida
              ? 'Cierre automático — jornada de día anterior completada'
              : 'Cierre automático — heartbeat detectó nueva jornada sin salida previa',
            actualizado_en: ahora,
          })
          .eq('id', turnoViejo.id)
      }

      const { data: turnoHoy } = await admin
        .from('asistencias')
        .select('id, estado, hora_entrada')
        .eq('empresa_id', empresaId)
        .eq('miembro_id', miembro.id)
        .eq('fecha', fechaHoy)
        .maybeSingle()

      if (!turnoHoy && tipo !== 'beforeunload') {
        // No hay turno hoy → crear entrada automática
        const { data: nuevoFichaje } = await admin
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
          .select('id, hora_entrada')
          .single()

        // NO crear notificación aquí — se crea en el siguiente heartbeat (~5 min)
        // para que el usuario vea "Tu entrada fue fichada a las X" después de un momento,
        // no instantáneamente al entrar.

        return NextResponse.json({
          accion: 'entrada_creada',
          hora_entrada: ahora,
          fichaje_id: nuevoFichaje?.id,
        })
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

        // Notificación diferida: si el turno se creó hace ≥3 min, pedimos crearla.
        // La dedup es atómica en crearNotificacion() vía índice único parcial en DB:
        // heartbeats simultáneos no pueden producir duplicados.
        const minutosDesdeEntrada = (Date.now() - new Date(turnoHoy.hora_entrada).getTime()) / 60000
        if (minutosDesdeEntrada >= 3 && turnoHoy.hora_entrada) {
          const horaFormateada = new Date(turnoHoy.hora_entrada).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: zona,
          })

          crearNotificacion({
            empresaId,
            usuarioId: user.id,
            tipo: 'fichaje_automatico',
            titulo: `Entrada fichada a las ${horaFormateada}`,
            cuerpo: 'Tu jornada fue registrada automáticamente al detectar actividad.',
            icono: 'clock',
            color: 'var(--insignia-exito)',
            url: '/asistencias',
            referenciaTipo: 'asistencia',
            referenciaId: turnoHoy.id,
          }).catch(() => {})
        }

        return NextResponse.json({
          accion: 'salida_actualizada',
          hora_entrada: turnoHoy.hora_entrada,
        })
      }

      // Si el turno fue auto-cerrado pero el usuario sigue activo hoy → reabrir
      if (turnoHoy && tipo !== 'beforeunload' && turnoHoy.estado === 'auto_cerrado') {
        await admin
          .from('asistencias')
          .update({
            estado: 'activo',
            hora_salida: ahora,
            cierre_automatico: false,
            notas: null,
            actualizado_en: ahora,
          })
          .eq('id', turnoHoy.id)

        return NextResponse.json({
          accion: 'turno_reabierto',
          hora_entrada: turnoHoy.hora_entrada,
        })
      }

      // Si está en almuerzo o trámite y recibimos un heartbeat activo (no beforeunload),
      // el usuario volvió a usar la compu → retorno automático
      if (turnoHoy && tipo !== 'beforeunload' && (turnoHoy.estado === 'almuerzo' || turnoHoy.estado === 'particular')) {
        const camposRetorno: Record<string, unknown> = {
          estado: 'activo',
          hora_salida: ahora,
          actualizado_en: ahora,
        }
        if (turnoHoy.estado === 'almuerzo') {
          camposRetorno.fin_almuerzo = ahora
        } else {
          camposRetorno.vuelta_particular = ahora
        }

        await admin
          .from('asistencias')
          .update(camposRetorno)
          .eq('id', turnoHoy.id)

        return NextResponse.json({
          accion: 'retorno_automatico',
          retorno_de: turnoHoy.estado,
          hora_entrada: turnoHoy.hora_entrada,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
