/**
 * Genera un PDF firmado: combina el PDF original del presupuesto
 * con una página adicional de certificado de aceptación digital.
 * Se usa en: API acciones portal (aceptar)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generarHtmlCertificado } from './certificado-aceptacion'

interface DatosAceptacion {
  presupuestoId: string
  empresaId: string
  // Documento
  numero: string
  contacto_nombre: string | null
  total_final: string
  moneda: string
  // Empresa
  empresa_nombre: string
  empresa_logo_url: string | null
  color_marca: string
  // Firma
  firma_url: string | null
  firma_nombre: string
  firma_modo: string
  // Forense
  ip: string
  user_agent: string
  fecha_hora: string
}

interface ResultadoPdfFirmado {
  url: string
  storage_path: string
}

/**
 * Genera el PDF del certificado de aceptación y lo sube a Storage.
 * Se guarda como archivo separado junto al PDF original.
 */
export async function generarPdfFirmado(
  admin: SupabaseClient,
  datos: DatosAceptacion
): Promise<ResultadoPdfFirmado> {
  // 1. Obtener símbolo de moneda y zona horaria de la empresa
  const [{ data: config }, { data: empresaData }] = await Promise.all([
    admin.from('config_presupuestos').select('monedas').eq('empresa_id', datos.empresaId).single(),
    admin.from('empresas').select('zona_horaria').eq('id', datos.empresaId).single(),
  ])

  const monedas = (config?.monedas || []) as { id: string; simbolo: string }[]
  const monedaSimbolo = monedas.find(m => m.id === datos.moneda)?.simbolo || '$'

  // Derivar locale de la zona horaria de la empresa
  const zona = (empresaData?.zona_horaria as string) || ''
  const locale = zona.startsWith('America/Argentina') ? 'es-AR'
    : zona.startsWith('America') ? 'es-MX'
    : 'es'

  // 2. Generar HTML del certificado
  const html = generarHtmlCertificado({
    numero: datos.numero,
    contacto_nombre: datos.contacto_nombre,
    total_final: datos.total_final,
    moneda_simbolo: monedaSimbolo,
    empresa_nombre: datos.empresa_nombre,
    empresa_logo_url: datos.empresa_logo_url,
    color_marca: datos.color_marca,
    firma_url: datos.firma_url,
    firma_nombre: datos.firma_nombre,
    firma_modo: datos.firma_modo,
    ip: datos.ip,
    user_agent: datos.user_agent,
    fecha_hora: datos.fecha_hora,
  }, locale)

  // 3. Convertir a PDF con Puppeteer
  const pdfBuffer = await htmlCertificadoAPdf(html)

  // 4. Subir a Storage
  const storagePath = `${datos.empresaId}/certificados/${datos.presupuestoId}_firmado.pdf`

  // Eliminar anterior si existe
  await admin.storage.from('documentos-pdf').remove([storagePath]).catch(() => {})

  const { error } = await admin.storage
    .from('documentos-pdf')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: 'no-cache',
    })

  if (error) throw new Error(`Error al subir PDF firmado: ${error.message}`)

  const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)
  const url = `${urlData.publicUrl}?t=${Date.now()}`

  return { url, storage_path: storagePath }
}

// ─── Renderizar HTML del certificado a PDF ───
async function htmlCertificadoAPdf(html: string): Promise<Buffer> {
  let browser
  try {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteer = await import('puppeteer-core')
    browser = await puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
      ),
      headless: true,
    })
  } catch {
    try {
      const puppeteer = await import('puppeteer-core')
      const rutasChrome = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ]
      let executablePath = ''
      const { existsSync } = await import('fs')
      for (const ruta of rutasChrome) {
        if (existsSync(ruta)) { executablePath = ruta; break }
      }
      if (!executablePath) throw new Error('No se encontró Chrome/Chromium')
      browser = await puppeteer.default.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    } catch (err) {
      throw new Error(`No se pudo iniciar el navegador: ${err instanceof Error ? err.message : 'Error'}`)
    }
  }

  try {
    const pagina = await browser.newPage()
    await pagina.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await pagina.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
