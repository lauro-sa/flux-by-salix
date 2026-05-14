/**
 * Conversión HTML → PDF con Puppeteer (helper genérico).
 *
 * Antes esta función vivía privada en `src/lib/pdf/generar-pdf.ts`
 * (módulo de presupuestos). Se extrae acá para reutilizarla desde otros
 * módulos que necesiten generar PDFs sin depender del flujo específico
 * de presupuestos: recibos de nómina (PR 8), comprobantes de adelanto,
 * reportes, etc.
 *
 * Estrategia:
 *   - En producción usa `@sparticuz/chromium-min` (binario que cabe en
 *     un lambda de Vercel) + `puppeteer-core`.
 *   - En desarrollo intenta encontrar Chrome local como fallback.
 */

import { CHROMIUM_DOWNLOAD_URL } from '@/lib/constantes/api-urls'

export interface OpcionesHtmlAPdf {
  /** HTML del mini header que va en <thead> (repite en cada página vía CSS). */
  theadHtml?: string
  /** Template HTML del pie para `displayHeaderFooter` de Puppeteer. */
  footerTemplate?: string
  /** Si true, también genera y devuelve un screenshot WEBP de la primera página. */
  generarMiniatura?: boolean
}

export interface ResultadoHtmlAPdf {
  pdf: Buffer
  miniatura: Buffer | null
}

/**
 * Envuelve el contenido del <body> en una `<table>` con `<thead>` para
 * que el mini header se repita en cada página vía `display: table-header-group`.
 * Solo aplica si el llamador pasa `theadHtml`.
 */
function envolverEnTabla(html: string, theadHtml: string): string {
  const cssTabla = `<style>
    @page{size:A4;margin:10mm 13mm 28mm 13mm!important}
    body{padding:0!important;margin:0!important}
    .pie-wrapper{display:none!important}
    table.doc-wrapper{width:100%;border-collapse:collapse}
    table.doc-wrapper thead{display:table-header-group}
    table.doc-wrapper thead td,table.doc-wrapper tbody td{padding:0}
    table.doc-wrapper tr{border:none}
  </style>`

  let resultado = html.replace('</head>', `${cssTabla}\n</head>`)

  const bodyMatch = resultado.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) {
    const bodyContent = bodyMatch[1]
    const tablaHtml = `
<table class="doc-wrapper">
  <thead><tr><td>${theadHtml}</td></tr></thead>
  <tbody><tr><td>${bodyContent}</td></tr></tbody>
</table>`
    resultado = resultado.replace(bodyMatch[1], tablaHtml)
  }

  return resultado
}

/**
 * Convierte un HTML a PDF (Buffer) usando Puppeteer.
 * Opcionalmente devuelve también una miniatura WEBP de la primera página.
 */
export async function htmlAPdf(
  html: string,
  opciones: OpcionesHtmlAPdf = {},
): Promise<ResultadoHtmlAPdf> {
  let browser
  try {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteer = await import('puppeteer-core')
    browser = await puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(CHROMIUM_DOWNLOAD_URL),
      headless: true,
    })
  } catch (errChromiumMin) {
    // Fallback: buscar Chrome local (desarrollo).
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
      if (!executablePath) {
        throw new Error(`No se encontró Chrome/Chromium. Error original: ${errChromiumMin instanceof Error ? errChromiumMin.message : 'desconocido'}`)
      }
      browser = await puppeteer.default.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    } catch (err) {
      throw new Error(`No se pudo iniciar el navegador: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }

  try {
    const pagina = await browser.newPage()

    let htmlFinal = html
    if (opciones.theadHtml) {
      htmlFinal = envolverEnTabla(htmlFinal, opciones.theadHtml)
    } else {
      const cssMargen = '<style>@page{margin:0!important}body{padding:10mm 13mm 25mm 13mm!important;margin:0!important}</style>'
      htmlFinal = htmlFinal.replace('</head>', `${cssMargen}\n</head>`)
    }

    await pagina.setContent(htmlFinal, { waitUntil: 'networkidle0' })

    const usarFooter = !!opciones.footerTemplate
    const pdfBuffer = await pagina.pdf({
      format: 'A4',
      printBackground: true,
      margin: opciones.theadHtml
        ? { top: '10mm', bottom: usarFooter ? '28mm' : '10mm', left: '13mm', right: '13mm' }
        : { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: usarFooter,
      headerTemplate: '<span></span>',
      footerTemplate: opciones.footerTemplate || '<span></span>',
      preferCSSPageSize: false,
    })

    let miniaturaBuffer: Buffer | null = null
    if (opciones.generarMiniatura) {
      try {
        await pagina.setViewport({ width: 794, height: 1123 }) // A4 a 96dpi
        miniaturaBuffer = Buffer.from(await pagina.screenshot({
          type: 'webp',
          quality: 80,
          clip: { x: 0, y: 0, width: 794, height: 1123 },
        }))
      } catch { /* si falla la miniatura, no bloquear el PDF */ }
    }

    return { pdf: Buffer.from(pdfBuffer), miniatura: miniaturaBuffer }
  } finally {
    await browser.close()
  }
}
