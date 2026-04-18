import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * POST /api/invitaciones/crear — Generar invitación para unirse a la empresa.
 * Solo propietario o administrador pueden invitar.
 * Genera un token único con expiración de 7 días.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el usuario tiene permiso para invitar
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'No tenés permiso para invitar' }, { status: 403 })
    }

    const { correo, rol } = await request.json()

    if (!correo || !rol) {
      return NextResponse.json({ error: 'Correo y rol son obligatorios' }, { status: 400 })
    }

    // Verificar que no exista ya un miembro con ese correo en esta empresa
    const { data: usuarioExistente } = await admin.auth.admin.listUsers()
    const usuarioConCorreo = usuarioExistente.users.find(u => u.email === correo)

    if (usuarioConCorreo) {
      const { data: miembroExistente } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', usuarioConCorreo.id)
        .eq('empresa_id', empresaId)
        .single()

      if (miembroExistente) {
        return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 409 })
      }
    }

    // Generar token y fecha de expiración (48 horas)
    const token = crypto.randomUUID()
    const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Obtener slug de la empresa para el link
    const { data: empresa } = await admin
      .from('empresas')
      .select('slug')
      .eq('id', empresaId)
      .single()

    const { data: invitacion, error } = await admin
      .from('invitaciones')
      .insert({
        token,
        empresa_id: empresaId,
        rol,
        correo,
        creado_por: user.id,
        expira_en: expiraEn,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 })
    }

    // Construir link de invitación
    const dominio = process.env.NEXT_PUBLIC_APP_DOMAIN || 'fluxsalix.com'
    const link = empresa?.slug
      ? `https://${empresa.slug}.${dominio}/invitacion?token=${token}`
      : `${request.nextUrl.origin}/invitacion?token=${token}`

    // ── Envío automático del correo de invitación (best effort) ──
    // Si la empresa tiene un canal de correo conectado (Gmail OAuth/IMAP),
    // disparamos el envío. Si falla o no hay canal, devolvemos el link para
    // que el admin lo comparta manualmente.
    let correoEnviado = false
    try {
      const { data: canal } = await admin
        .from('canales_correo')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .eq('estado_conexion', 'conectado')
        .order('es_principal', { ascending: false })
        .order('creado_en', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (canal?.id) {
        // Nombre de la empresa para la plantilla
        const { data: empresaInfo } = await admin
          .from('empresas')
          .select('nombre')
          .eq('id', empresaId)
          .single()
        const nombreEmpresa = empresaInfo?.nombre || 'la empresa'

        const asunto = `Te invitaron a ${nombreEmpresa} en Flux`
        const html = construirHtmlInvitacion({
          nombreEmpresa,
          link,
          rol,
          correoDestino: correo,
        })

        // Llamada server-to-server: el endpoint interno soporta headers
        // x-programado-por / x-empresa-id para saltar la verificación de
        // sesión (las cookies del navegador no viajan en fetch interno).
        const baseUrl = request.nextUrl.origin
        const res = await fetch(`${baseUrl}/api/inbox/correo/enviar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-programado-por': user.id,
            'x-empresa-id': empresaId,
          },
          body: JSON.stringify({
            canal_id: canal.id,
            correo_para: [correo],
            correo_asunto: asunto,
            html,
            texto: `Te invitaron a unirte a ${nombreEmpresa} en Flux. Aceptá la invitación acá: ${link}`,
            tipo: 'nuevo',
          }),
        })
        correoEnviado = res.ok
      }
    } catch {
      // No bloquear la creación de invitación si el envío falla
      correoEnviado = false
    }

    return NextResponse.json({ invitacion, link, correo_enviado: correoEnviado })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * HTML simple para el correo de invitación. Usa tabla inline-styles para
 * compatibilidad con Gmail/Outlook. Responsive y funciona en dark mode.
 */
function construirHtmlInvitacion({
  nombreEmpresa,
  link,
  rol,
  correoDestino,
}: {
  nombreEmpresa: string
  link: string
  rol: string
  correoDestino: string
}): string {
  const etiquetaRol = ({
    propietario: 'Propietario', administrador: 'Administrador', gestor: 'Gestor',
    vendedor: 'Vendedor', supervisor: 'Supervisor', empleado: 'Empleado', invitado: 'Invitado',
  } as Record<string, string>)[rol] || rol

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Invitación a Flux</p>
              <h1 style="margin:8px 0 0;font-size:22px;color:#0f172a;line-height:1.3;">Te invitaron a ${nombreEmpresa}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.55;">
                Creamos una cuenta para <strong>${correoDestino}</strong> con el rol <strong>${etiquetaRol}</strong>.
                Aceptá la invitación para acceder al sistema.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#0f172a" style="background:#0f172a;border-radius:8px;">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                      Aceptar invitación
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
                O copiá este enlace en tu navegador:<br>
                <span style="word-break:break-all;color:#475569;">${link}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Esta invitación expira en 48 horas. Si no esperabas este correo, podés ignorarlo.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">Enviado desde Flux by Salix</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
