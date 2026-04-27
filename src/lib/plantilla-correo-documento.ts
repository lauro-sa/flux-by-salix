/**
 * plantilla-correo-documento.ts — Construye el HTML del correo para envío de documentos.
 * Replica el sistema anterior: CTA portal (opcional) + contenido del editor + pie de empresa.
 * Se usa en: EditorPresupuesto.tsx (handleEnviarCorreo).
 */

// ─── Tipos ───

interface DatosCtaPortal {
  /** URL completa del portal (ej: https://flux.salixweb.com/portal/presupuestos/abc123) */
  urlPortal: string
  /** Color de marca de la empresa (hex, ej: #4D2D42) */
  colorMarca: string
  /** Título del documento (ej: "Presupuesto PRES-0023") */
  tituloDocumento: string
  /** Nombre completo del contacto destinatario */
  nombreContacto: string
  /** Etiqueta del tipo de documento para el botón (ej: "Presupuesto") */
  etiquetaTipo: string
}

interface DatosPieEmpresa {
  nombre: string
  telefono?: string | null
  correo?: string | null
  sitioWeb?: string | null
}

// ─── Bloque CTA del portal ───

function construirCtaPortal({
  urlPortal,
  colorMarca,
  tituloDocumento,
  nombreContacto,
  etiquetaTipo,
}: DatosCtaPortal): string {
  const color = colorMarca || '#4D2D42'

  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr>
    <td style="padding-right:16px;vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td bgcolor="${color}" style="background:${color};background-color:${color};border-radius:6px;mso-padding-alt:10px 20px;">
            <a href="${urlPortal}" target="_blank" rel="noopener noreferrer" x-apple-data-detectors="false"
               style="display:inline-block;padding:10px 20px;background:${color} !important;background-color:${color} !important;color:#ffffff !important;text-decoration:none !important;border-radius:6px;font-size:13px;font-weight:600;white-space:nowrap;mso-line-height-rule:exactly;-webkit-text-size-adjust:none;">
              Ver ${etiquetaTipo}
            </a>
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;line-height:1.3;">${tituloDocumento}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#64748b;line-height:1.3;">${nombreContacto}</p>
    </td>
  </tr>
</table>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0 16px;">`
}

// ─── Pie de empresa ───

function construirPieEmpresa(datos: DatosPieEmpresa): string {
  const partes: string[] = []
  if (datos.telefono) partes.push(datos.telefono)
  if (datos.correo) partes.push(datos.correo)
  if (datos.sitioWeb) partes.push(datos.sitioWeb)
  const lineaContacto = partes.join(' · ')

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr>
    <td style="padding:20px 0 0;border-top:1px solid #e2e8f0;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#374151;">${datos.nombre}</p>
      ${lineaContacto ? `<p style="margin:0;font-size:12px;color:#94a3b8;">${lineaContacto}</p>` : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 0 8px;">
      <p style="margin:0;font-size:11px;color:#b0b8c4;">
        Con tecnología de <a href="https://www.salixweb.com" style="color:#6b7fa3;text-decoration:none;font-weight:600;">Flux</a>
        · <span style="font-style:italic;">Tu negocio, simplificado</span>
      </p>
    </td>
  </tr>
</table>`
}

// ─── Wrapper principal con dark mode ───

function envolverHtmlCorreo(cuerpoHtml: string): string {
  // No forzamos colores con `@media (prefers-color-scheme: dark)`: los clientes
  // de correo modernos (Gmail, Outlook, Apple Mail) hacen inversión automática
  // ("smart invert") cuando el destinatario está en dark mode. Forzar colores
  // con !important además rompe el visor del propio Inbox cuando el SO está en
  // dark. La plantilla queda con colores claros (texto oscuro sobre claro) y
  // cada cliente decide cómo presentarla.
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<style>:root{color-scheme:light;}</style></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div class="email-body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:680px;margin:0 auto;padding:16px;background:#ffffff;">
${cuerpoHtml}
</div></body></html>`
}

// ─── Función pública: arma el HTML completo del correo de documento ───

export interface OpcionesCorreoDocumento {
  /** HTML del cuerpo escrito por el usuario en el editor */
  htmlCuerpo: string
  /** Si incluir el bloque CTA del portal */
  incluirPortal: boolean
  /** Datos para el CTA (requerido si incluirPortal es true) */
  portal?: {
    url: string
    etiquetaTipo: string
    tituloDocumento: string
    nombreContacto: string
  }
  /** Color de marca de la empresa (hex) */
  colorMarca?: string | null
  /** Datos de la empresa para el pie */
  empresa: DatosPieEmpresa
}

export function construirHtmlCorreoDocumento(opciones: OpcionesCorreoDocumento): string {
  const partes: string[] = []

  // 1. CTA portal (opcional — solo si el checkbox está tildado)
  if (opciones.incluirPortal && opciones.portal) {
    partes.push(construirCtaPortal({
      urlPortal: opciones.portal.url,
      colorMarca: opciones.colorMarca || '#4D2D42',
      tituloDocumento: opciones.portal.tituloDocumento,
      nombreContacto: opciones.portal.nombreContacto,
      etiquetaTipo: opciones.portal.etiquetaTipo,
    }))
  }

  // 2. Cuerpo del editor
  partes.push(opciones.htmlCuerpo)

  // 3. Pie de empresa
  partes.push(construirPieEmpresa(opciones.empresa))

  // 4. Envolver todo en el wrapper con dark mode
  return envolverHtmlCorreo(partes.join('\n'))
}
