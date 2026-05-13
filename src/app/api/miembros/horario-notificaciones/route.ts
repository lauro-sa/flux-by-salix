import { NextResponse, type NextRequest } from 'next/server'
import { requerirAutenticacionAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * Horario laboral personal para filtrar push de notificaciones diferidas.
 * Override por usuario sobre el default de la empresa.
 *
 * GET → { miembro: HorarioNotificaciones | null, empresa: HorarioNotificaciones }
 * PATCH body: { horario: HorarioNotificaciones | null } (null = volver al de empresa)
 */

export async function GET() {
  const guard = await requerirAutenticacionAPI()
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  const admin = crearClienteAdmin()
  const [empresaRes, miembroRes] = await Promise.all([
    admin.from('empresas').select('horario_notificaciones').eq('id', empresaId).single(),
    admin
      .from('miembros')
      .select('horario_notificaciones')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    miembro: miembroRes.data?.horario_notificaciones ?? null,
    empresa: empresaRes.data?.horario_notificaciones ?? null,
  })
}

export async function PATCH(request: NextRequest) {
  const guard = await requerirAutenticacionAPI()
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  const body = await request.json().catch(() => null) as { horario?: unknown } | null
  if (!body || !('horario' in body)) {
    return NextResponse.json({ error: 'Falta campo horario' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { error } = await admin
    .from('miembros')
    .update({ horario_notificaciones: body.horario ?? null })
    .eq('empresa_id', empresaId)
    .eq('usuario_id', user.id)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
