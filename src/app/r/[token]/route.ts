// ──────────────────────────────────────────────────────────────────
// /r/[token] — Short link público para recibos de nómina (WhatsApp).
// ──────────────────────────────────────────────────────────────────
//
// Esta ruta es PÚBLICA (sin auth). El token se generó al enviar el
// recibo por WhatsApp y se guardó en `recibo_enlaces_publicos`.
//
// Flujo:
//   1. Lookup token (admin client, bypass RLS).
//   2. Si no existe o expiró → 404 a /not-found.
//   3. Generar signed URL fresco (5 min de vigencia) del PDF en Storage.
//      Si el PDF no existe en Storage (fue limpiado), lo regeneramos
//      con Puppeteer como fallback.
//   4. Incrementar contador de accesos (fire-and-forget).
//   5. Redirect 302 al signed URL.

import { type NextRequest, NextResponse } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { generarPdfRecibo } from '@/lib/nominas/generar-pdf-recibo'

const BUCKET = 'comprobantes-pago'
// Signed URLs cortos: el empleado abre el link → redirect inmediato
// al PDF. 5 minutos es más que suficiente y minimiza el riesgo de
// que el URL se filtre.
const EXPIRACION_PDF_SEGUNDOS = 60 * 5

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Validación básica del formato — evitar queries innecesarias por
  // bots o URLs malformadas.
  if (!token || token.length < 6 || token.length > 32) {
    return NextResponse.redirect(new URL('/not-found', _request.url), 302)
  }

  const admin = crearClienteAdmin()

  // 1) Lookup
  const { data: enlace } = await admin
    .from('recibo_enlaces_publicos')
    .select('id, pago_id, empresa_id, expira_en, accesos_count')
    .eq('token', token)
    .maybeSingle()

  if (!enlace) {
    return NextResponse.redirect(new URL('/not-found', _request.url), 302)
  }

  // 2) Vigencia
  if (enlace.expira_en && enlace.expira_en < new Date().toISOString()) {
    return NextResponse.redirect(new URL('/not-found', _request.url), 302)
  }

  // 3) Buscar el path del PDF en pagos_nomina.
  const { data: pago } = await admin
    .from('pagos_nomina')
    .select('comprobante_path')
    .eq('id', enlace.pago_id)
    .eq('empresa_id', enlace.empresa_id)
    .maybeSingle()

  let signedUrl: string | null = null

  if (pago?.comprobante_path) {
    // 3a) Camino rápido: generar signed URL del archivo existente.
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(pago.comprobante_path, EXPIRACION_PDF_SEGUNDOS)
    signedUrl = signed?.signedUrl ?? null
  }

  if (!signedUrl) {
    // 3b) Fallback: el archivo no existe en Storage (fue limpiado o
    // nunca se generó). Regeneramos con Puppeteer — costoso pero
    // garantiza que el empleado siempre vea su recibo.
    try {
      const { url } = await generarPdfRecibo(
        admin,
        enlace.pago_id,
        enlace.empresa_id,
        { expiracionSegundos: EXPIRACION_PDF_SEGUNDOS },
      )
      signedUrl = url
    } catch (err) {
      console.error('[/r/token] error al regenerar PDF:', err)
      return NextResponse.redirect(new URL('/not-found', _request.url), 302)
    }
  }

  // 4) Auditoría (fire-and-forget — no bloquea el redirect).
  // Increment no es atómico (SELECT+UPDATE), pero si se pierde algún
  // click por race condition no es crítico — sirve para saber si el
  // empleado abrió el recibo, no para cobrar.
  const nuevosAccesos = (enlace.accesos_count ?? 0) + 1
  admin
    .from('recibo_enlaces_publicos')
    .update({
      accesos_count: nuevosAccesos,
      ultimo_acceso_en: new Date().toISOString(),
    })
    .eq('id', enlace.id)
    .then(() => undefined, (err) => console.error('[/r/token] auditoría:', err))

  // 5) Redirect al PDF.
  return NextResponse.redirect(signedUrl, 302)
}
