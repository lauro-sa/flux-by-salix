import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacionesBatch } from '@/lib/notificaciones'

/**
 * GET /api/cron/cumpleanios — Cron diario de cumpleaños.
 * Ejecutado por Vercel Cron cada día a las 9:00 AM.
 *
 * Busca perfiles con fecha_nacimiento = hoy (mes y día) y crea notificaciones
 * para todos los miembros activos de la misma empresa.
 *
 * Requiere columna `fecha_nacimiento` (date) en la tabla `perfiles`.
 * Si la columna no existe, retorna sin error para no romper el cron.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date()
    const mes = String(ahora.getMonth() + 1).padStart(2, '0')
    const dia = String(ahora.getDate()).padStart(2, '0')

    // Buscar perfiles cuyo cumpleaños es hoy (match mes-día)
    // Usamos RPC o raw filter porque Supabase no soporta EXTRACT directamente
    const { data: cumpleañeros, error: errCumple } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, fecha_nacimiento')
      .not('fecha_nacimiento', 'is', null)

    // Si la columna no existe, la query falla — retornar sin error
    if (errCumple) {
      console.warn('[CUMPLEAÑOS] Error consultando (columna fecha_nacimiento puede no existir):', errCumple.message)
      return NextResponse.json({ mensaje: 'Columna fecha_nacimiento no disponible', timestamp: ahora.toISOString() })
    }

    // Filtrar por mes-día en JS (más robusto que depender del formato de la BD)
    const cumpleHoy = (cumpleañeros || []).filter((p) => {
      if (!p.fecha_nacimiento) return false
      const partes = String(p.fecha_nacimiento).split('-')
      if (partes.length < 3) return false
      return partes[1] === mes && partes[2] === dia
    })

    if (cumpleHoy.length === 0) {
      return NextResponse.json({ cumpleanios: 0, timestamp: ahora.toISOString() })
    }

    const notificaciones: Parameters<typeof crearNotificacionesBatch>[0] = []

    for (const persona of cumpleHoy) {
      const nombreCompleto = `${persona.nombre} ${persona.apellido || ''}`.trim()

      // Buscar empresas donde esta persona es miembro activo
      const { data: membresias } = await admin
        .from('miembros')
        .select('empresa_id')
        .eq('usuario_id', persona.id)
        .eq('activo', true)

      for (const membresia of membresias || []) {
        // Buscar todos los miembros activos de la empresa
        const { data: companeros } = await admin
          .from('miembros')
          .select('usuario_id')
          .eq('empresa_id', membresia.empresa_id)
          .eq('activo', true)

        for (const comp of companeros || []) {
          const esMismo = comp.usuario_id === persona.id
          notificaciones.push({
            empresaId: membresia.empresa_id,
            usuarioId: comp.usuario_id,
            tipo: esMismo ? 'cumpleanios_propio' : 'cumpleanios_colega',
            titulo: esMismo
              ? '🎂 ¡Feliz cumpleaños!'
              : `🎂 Hoy cumple años ${nombreCompleto}`,
            cuerpo: esMismo
              ? '¡Todo el equipo te desea un excelente día!'
              : '¡No olvides saludarlo!',
            icono: 'PartyPopper',
            color: 'var(--insignia-rosa-texto)',
            referenciaTipo: 'cumpleanios',
            referenciaId: persona.id,
          })
        }
      }
    }

    if (notificaciones.length > 0) {
      await crearNotificacionesBatch(notificaciones)
    }

    return NextResponse.json({
      cumpleanios: cumpleHoy.length,
      notificaciones_creadas: notificaciones.length,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron cumpleaños:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
