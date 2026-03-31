/**
 * Genera el HTML del certificado de aceptación digital.
 * Se renderiza como una página adicional al PDF del presupuesto.
 * Incluye: firma del cliente, metadata forense (IP, dispositivo, fecha, modo).
 * Se usa en: API acciones portal (aceptar)
 */

interface DatosCertificado {
  // Documento
  numero: string
  contacto_nombre: string | null
  total_final: string
  moneda_simbolo: string
  // Empresa
  empresa_nombre: string
  empresa_logo_url: string | null
  color_marca: string
  // Firma
  firma_url: string | null
  firma_nombre: string
  firma_modo: string // 'auto' | 'dibujo' | 'subida'
  // Forense
  ip: string
  user_agent: string
  fecha_hora: string
  // Geolocalización (opcional)
  geo_latitud?: number
  geo_longitud?: number
}

export function generarHtmlCertificado(datos: DatosCertificado): string {
  const fecha = new Date(datos.fecha_hora)
  const fechaFormateada = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const modoFirma: Record<string, string> = {
    auto: 'Firma automática (texto cursivo)',
    dibujo: 'Firma manuscrita digital',
    subida: 'Firma subida como imagen',
  }

  const color = datos.color_marca || '#6366f1'

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a2e;
    background: #fff;
    padding: 40mm 20mm 20mm 20mm;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid ${color};
  }
  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .header-icon svg { width: 28px; height: 28px; fill: white; }
  .header-text h1 {
    font-size: 22px;
    font-weight: 700;
    color: ${color};
    margin-bottom: 2px;
  }
  .header-text p {
    font-size: 12px;
    color: #666;
  }
  .logo {
    margin-left: auto;
    height: 40px;
    max-width: 160px;
    object-fit: contain;
  }

  .section {
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #999;
    margin-bottom: 10px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
  }
  .info-item {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }
  .info-label {
    font-size: 10px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .info-value {
    font-size: 13px;
    font-weight: 500;
    color: #1a1a2e;
  }
  .info-value.mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: #555;
  }

  .firma-container {
    text-align: center;
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #fafafa;
  }
  .firma-img {
    max-height: 80px;
    max-width: 300px;
    margin-bottom: 8px;
  }
  .firma-nombre {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
  }
  .firma-modo {
    font-size: 10px;
    color: #999;
    margin-top: 2px;
  }

  .declaracion {
    padding: 16px 20px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    font-size: 11px;
    line-height: 1.6;
    color: #15803d;
  }

  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 9px;
    color: #999;
    text-align: center;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <!-- Cabecera -->
  <div class="header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <div class="header-text">
      <h1>Certificado de Aceptación Digital</h1>
      <p>Documento firmado electrónicamente</p>
    </div>
    ${datos.empresa_logo_url ? `<img src="${datos.empresa_logo_url}" class="logo" alt="Logo" />` : ''}
  </div>

  <!-- Datos del documento -->
  <div class="section">
    <div class="section-title">Documento</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Presupuesto Nº</span>
        <span class="info-value">${datos.numero}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Emitido por</span>
        <span class="info-value">${datos.empresa_nombre}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Cliente</span>
        <span class="info-value">${datos.contacto_nombre || 'Sin especificar'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Monto total</span>
        <span class="info-value">${datos.moneda_simbolo} ${datos.total_final}</span>
      </div>
    </div>
  </div>

  <!-- Firma -->
  <div class="section">
    <div class="section-title">Firma del cliente</div>
    <div class="firma-container">
      ${datos.firma_url ? `<img src="${datos.firma_url}" class="firma-img" alt="Firma" />` : ''}
      <div class="firma-nombre">${datos.firma_nombre}</div>
      <div class="firma-modo">${modoFirma[datos.firma_modo] || datos.firma_modo}</div>
    </div>
  </div>

  <!-- Metadata forense -->
  <div class="section">
    <div class="section-title">Datos de verificación</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Fecha y hora</span>
        <span class="info-value">${fechaFormateada}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Dirección IP</span>
        <span class="info-value mono">${datos.ip}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Dispositivo</span>
        <span class="info-value mono">${datos.user_agent.length > 80 ? datos.user_agent.substring(0, 80) + '...' : datos.user_agent}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Tipo de firma</span>
        <span class="info-value">${modoFirma[datos.firma_modo] || datos.firma_modo}</span>
      </div>
      ${datos.geo_latitud && datos.geo_longitud ? `
      <div class="info-item">
        <span class="info-label">Geolocalización</span>
        <span class="info-value mono">${datos.geo_latitud.toFixed(6)}, ${datos.geo_longitud.toFixed(6)}</span>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- Declaración legal -->
  <div class="section">
    <div class="declaracion">
      El firmante <strong>${datos.firma_nombre}</strong> declara haber revisado y aceptado el presupuesto
      <strong>${datos.numero}</strong> emitido por <strong>${datos.empresa_nombre}</strong>
      por un monto total de <strong>${datos.moneda_simbolo} ${datos.total_final}</strong>,
      aceptando los términos y condiciones incluidos en el documento.
      Esta aceptación fue registrada digitalmente el ${fechaFormateada}.
    </div>
  </div>

  <!-- Pie -->
  <div class="footer">
    Certificado generado automáticamente por Flux by Salix &middot;
    Este documento tiene validez como constancia de aceptación digital.
  </div>
</body>
</html>`
}
