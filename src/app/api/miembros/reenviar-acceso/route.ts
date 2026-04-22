import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverCorreoNotif, etiquetaCanal } from '@/lib/miembros/canal-notif'

/**
 * POST /api/miembros/reenviar-acceso — Reenvía un correo de acceso a un
 * miembro que YA tiene cuenta Flux (estado "activo").
 *
 * A diferencia de `/api/invitaciones/crear`, este endpoint no crea una
 * invitación nueva: solo envía un correo con el link al login para que el
 * empleado entre. Útil cuando el usuario cambió de dispositivo, perdió el
 * link o necesita un recordatorio.
 *
 * Respeta `miembros.canal_notif_correo`: si el canal elegido está vacío, no
 * envía y devuelve 400 con un mensaje claro.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { miembro_id } = await request.json()
    if (!miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })

    // Cargar miembro destino
    const { data: miembro } = await admin
      .from('miembros')
      .select('usuario_id, activo, canal_notif_correo')
      .eq('id', miembro_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    if (!miembro.activo) return NextResponse.json({ error: 'El miembro no está activo' }, { status: 400 })
    if (!miembro.usuario_id) return NextResponse.json({ error: 'El miembro aún no tiene cuenta — usá "Enviar invitación"' }, { status: 400 })

    // Resolver correo según canal
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, correo, correo_empresa')
      .eq('id', miembro.usuario_id)
      .single()

    const canal = (miembro.canal_notif_correo as 'empresa' | 'personal') || 'empresa'
    const destino = resolverCorreoNotif({
      correo: perfil?.correo,
      correo_empresa: perfil?.correo_empresa,
      canal_notif_correo: canal,
    })

    if (!destino) {
      return NextResponse.json(
        { error: `No hay ${etiquetaCanal('correo', canal)} cargado para este empleado. Cargalo en su ficha o cambiá el canal de notificaciones.` },
        { status: 400 },
      )
    }

    // Nombre empresa + link de login
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre, slug')
      .eq('id', empresaId)
      .single()

    const dominio = process.env.NEXT_PUBLIC_APP_DOMAIN || 'salixweb.com'
    const linkLogin = empresa?.slug
      ? `https://${empresa.slug}.${dominio}/login`
      : `${request.nextUrl.origin}/login`
    const nombreEmpresa = empresa?.nombre || 'la empresa'
    const nombreDest = perfil?.nombre || ''

    // Buscar canal de correo conectado
    const { data: canalCorreo } = await admin
      .from('canales_correo')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .eq('estado_conexion', 'conectado')
      .order('es_principal', { ascending: false })
      .order('creado_en', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!canalCorreo?.id) {
      return NextResponse.json(
        { error: 'La empresa no tiene un canal de correo conectado para enviar el mensaje.' },
        { status: 400 },
      )
    }

    const asunto = `Recordatorio de acceso a ${nombreEmpresa} en Flux`
    const html = construirHtmlRecordatorio({ nombreEmpresa, nombreDest, linkLogin, correoDestino: destino })

    const res = await fetch(`${request.nextUrl.origin}/api/inbox/correo/enviar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-programado-por': user.id,
        'x-empresa-id': empresaId,
      },
      body: JSON.stringify({
        canal_id: canalCorreo.id,
        correo_para: [destino],
        correo_asunto: asunto,
        html,
        texto: `Hola ${nombreDest}, entrá a Flux desde: ${linkLogin}`,
        tipo: 'nuevo',
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'No se pudo enviar el correo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, correo: destino, canal })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

function construirHtmlRecordatorio({
  nombreEmpresa, nombreDest, linkLogin, correoDestino,
}: {
  nombreEmpresa: string
  nombreDest: string
  linkLogin: string
  correoDestino: string
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Recordatorio de acceso</p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#0f172a;line-height:1.3;">Entrá a ${nombreEmpresa} en Flux</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.55;">
            ${nombreDest ? `Hola <strong>${nombreDest}</strong>, ` : ''}tu cuenta está activa en <strong>${nombreEmpresa}</strong>. Entrá con <strong>${correoDestino}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="#0f172a" style="background:#0f172a;border-radius:8px;">
              <a href="${linkLogin}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Entrar a Flux</a>
            </td>
          </tr></table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
            O copiá este enlace:<br>
            <span style="word-break:break-all;color:#475569;">${linkLogin}</span>
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">Enviado desde Flux by Salix</p>
    </td></tr>
  </table>
</body>
</html>`
}
