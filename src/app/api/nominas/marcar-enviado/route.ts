/**
 * POST /api/nominas/marcar-enviado
 *
 * Transiciona uno o N empleados de 'liquidado' a 'enviado'. Lo dispara:
 *   - El operador manualmente desde el botón "Marcar enviado" cuando
 *     envía el recibo por un canal NO trackeado (impreso, mano).
 *   - Automáticamente desde /api/nominas/enviar-whatsapp y /api/nominas/enviar
 *     después de un envío exitoso (origen='sistema' en el audit).
 *
 * Body: { periodo_inicio, periodo_fin, miembros_ids: string[], origen?: 'manual'|'sistema' }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { transicionarLiquidacionEmpleado } from '@/lib/nominas/transicion-liquidacion'

interface Payload {
  periodo_inicio: string
  periodo_fin: string
  miembros_ids: string[]
}

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'enviar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Payload
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { periodo_inicio, periodo_fin, miembros_ids } = body
  if (!periodo_inicio || !periodo_fin || !Array.isArray(miembros_ids) || miembros_ids.length === 0) {
    return NextResponse.json({ error: 'periodo_inicio, periodo_fin y miembros_ids[] requeridos' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('nombre, apellido').eq('id', user.id).single()
  const nombreActor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Sistema'

  const resultados = await Promise.all(miembros_ids.map(async miembroId => {
    const r = await transicionarLiquidacionEmpleado(admin, {
      empresaId,
      miembroId,
      periodoInicio: periodo_inicio,
      periodoFin: periodo_fin,
      hastaClave: 'enviado',
      usuario: { id: user.id, nombre: nombreActor },
    })
    return r.ok
      ? { miembro_id: miembroId, ok: true }
      : { miembro_id: miembroId, ok: false, code: r.code, mensaje: r.mensaje }
  }))

  return NextResponse.json({ resultados })
}
