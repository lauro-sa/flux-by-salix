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
    const idsCumpleaneros = cumpleHoy.map(p => p.id)

    // Una sola query: traer TODAS las membresías de todos los cumpleañeros
    const { data: membresiasCumple } = await admin
      .from('miembros')
      .select('usuario_id, empresa_id')
      .in('usuario_id', idsCumpleaneros)
      .eq('activo', true)

    if (!membresiasCumple || membresiasCumple.length === 0) {
      return NextResponse.json({ cumpleanios: cumpleHoy.length, notificaciones_creadas: 0, timestamp: ahora.toISOString() })
    }

    // Empresas únicas donde hay al menos un cumpleañero
    const empresasIds = [...new Set(membresiasCumple.map(m => m.empresa_id))]

    // Una sola query: traer todos los miembros activos de esas empresas
    const { data: todosLosmiembros } = await admin
      .from('miembros')
      .select('usuario_id, empresa_id')
      .in('empresa_id', empresasIds)
      .eq('activo', true)

    // Indexar miembros por empresa para acceso O(1)
    const miembrosPorEmpresa = new Map<string, string[]>()
    for (const m of todosLosmiembros || []) {
      const lista = miembrosPorEmpresa.get(m.empresa_id) || []
      lista.push(m.usuario_id)
      miembrosPorEmpresa.set(m.empresa_id, lista)
    }

    // Indexar empresas por cumpleañero
    const empresasPorCumple = new Map<string, string[]>()
    for (const m of membresiasCumple) {
      const lista = empresasPorCumple.get(m.usuario_id) || []
      lista.push(m.empresa_id)
      empresasPorCumple.set(m.usuario_id, lista)
    }

    for (const persona of cumpleHoy) {
      const nombreCompleto = `${persona.nombre} ${persona.apellido || ''}`.trim()
      const empresas = empresasPorCumple.get(persona.id) || []

      for (const empresaId of empresas) {
        const companeros = miembrosPorEmpresa.get(empresaId) || []

        for (const usuarioId of companeros) {
          const esMismo = usuarioId === persona.id
          notificaciones.push({
            empresaId,
            usuarioId,
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

    // Cumpleaños de empleados sin cuenta Flux (kiosco): fecha_nacimiento vive en
    // miembros, nombre en el contacto equipo. Solo notifica a los compañeros con
    // cuenta — el propio empleado de kiosco no tiene app para recibirla.
    const { data: miembrosSinCuentaCumple } = await admin
      .from('miembros')
      .select('id, empresa_id, fecha_nacimiento')
      .is('usuario_id', null)
      .eq('activo', true)
      .not('fecha_nacimiento', 'is', null)

    const miembrosCumpleHoy = (miembrosSinCuentaCumple || []).filter((m) => {
      if (!m.fecha_nacimiento) return false
      const partes = String(m.fecha_nacimiento).split('-')
      if (partes.length < 3) return false
      return partes[1] === mes && partes[2] === dia
    })

    if (miembrosCumpleHoy.length > 0) {
      const ids = miembrosCumpleHoy.map(m => m.id)
      const { data: contactosEq } = await admin
        .from('contactos')
        .select('miembro_id, nombre, apellido')
        .in('miembro_id', ids)
        .eq('en_papelera', false)
      const contactoEqMap = new Map<string, string>()
      for (const c of (contactosEq || [])) {
        if (!c.miembro_id) continue
        contactoEqMap.set(c.miembro_id, `${c.nombre || ''} ${c.apellido || ''}`.trim())
      }

      for (const m of miembrosCumpleHoy) {
        const nombreCompleto = contactoEqMap.get(m.id) || 'Un compañero'
        const companeros = miembrosPorEmpresa.get(m.empresa_id) || []
        for (const usuarioId of companeros) {
          notificaciones.push({
            empresaId: m.empresa_id,
            usuarioId,
            tipo: 'cumpleanios_colega',
            titulo: `🎂 Hoy cumple años ${nombreCompleto}`,
            cuerpo: '¡No olvides saludarlo!',
            icono: 'PartyPopper',
            color: 'var(--insignia-rosa-texto)',
            referenciaTipo: 'cumpleanios',
            referenciaId: m.id,
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
