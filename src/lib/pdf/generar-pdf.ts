/**
 * Generador de PDF para presupuestos (servidor).
 * Usa el renderizado compartido de renderizar-html.ts,
 * convierte a PDF con Puppeteer, y sube a Supabase Storage.
 * Se usa en: /api/presupuestos/[id]/pdf
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  renderizarHtml,
  generarNombreArchivo,
  type DatosPresupuestoPdf,
  type DatosEmpresa,
  type ConfigPdf,
} from './renderizar-html'
import type { LineaPresupuesto, CuotaPago } from '@/tipos/presupuesto'

// Re-exportar para que la API route siga importando desde aquí
export { renderizarHtml, generarNombreArchivo }

interface ResultadoPdf {
  url: string
  storage_path: string
  nombre_archivo: string
  tamano: number
}

// ─── Conversión HTML a PDF con Puppeteer ───

interface OpcionesPdf {
  /** HTML del mini header que va en <thead> (repite en cada página via CSS) */
  theadHtml?: string
  /** Template HTML del footer para Puppeteer displayHeaderFooter (siempre al fondo) */
  footerTemplate?: string
}

/**
 * Envuelve el contenido del <body> en una <table> con <thead>/<tfoot> para repetición.
 * - <thead> repite el mini header en cada página (display: table-header-group)
 * - <tfoot> repite el pie visual en cada página (display: table-footer-group)
 * - Oculta .pie-wrapper del body (el pie ahora va en tfoot)
 */
function envolverEnTabla(html: string, theadHtml: string): string {
  const cssTabla = `<style>
    @page{size:A4;margin:10mm 13mm 14mm 13mm!important}
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

async function htmlAPdf(html: string, opciones?: OpcionesPdf): Promise<{ pdf: Buffer; miniatura: Buffer | null }> {
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
  } catch (errChromiumMin) {
    // Fallback: buscar Chrome local (desarrollo)
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

    // Si hay thead (mini header), envolver el body en tabla para que repita en cada página.
    // Si hay footerTemplate, usar displayHeaderFooter de Puppeteer para el pie + paginación.
    let htmlFinal = html
    if (opciones?.theadHtml) {
      htmlFinal = envolverEnTabla(htmlFinal, opciones.theadHtml)
    } else {
      // Sin thead: usar approach original con body padding
      const cssMargen = '<style>@page{margin:0!important}body{padding:10mm 13mm 25mm 13mm!important;margin:0!important}</style>'
      htmlFinal = htmlFinal.replace('</head>', `${cssMargen}\n</head>`)
    }

    await pagina.setContent(htmlFinal, { waitUntil: 'networkidle0' })

    const usarFooter = !!opciones?.footerTemplate
    const pdfBuffer = await pagina.pdf({
      format: 'A4',
      printBackground: true,
      // Con thead: Puppeteer pone márgenes por página (contenido + footer no se pisan)
      // Sin thead: approach original (margin 0, body padding)
      margin: opciones?.theadHtml
        ? { top: '10mm', bottom: usarFooter ? '28mm' : '10mm', left: '13mm', right: '13mm' }
        : { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: usarFooter,
      headerTemplate: '<span></span>',
      footerTemplate: opciones?.footerTemplate || '<span></span>',
      preferCSSPageSize: false,
    })

    // Generar miniatura (screenshot de la primera página)
    let miniaturaBuffer: Buffer | null = null
    try {
      await pagina.setViewport({ width: 794, height: 1123 }) // A4 a 96dpi
      miniaturaBuffer = Buffer.from(await pagina.screenshot({
        type: 'webp',
        quality: 80,
        clip: { x: 0, y: 0, width: 794, height: 1123 },
      }))
    } catch { /* si falla la miniatura, no bloquear el PDF */ }

    return { pdf: Buffer.from(pdfBuffer), miniatura: miniaturaBuffer }
  } finally {
    await browser.close()
  }
}

// ─── Subida a Supabase Storage ───

async function subirAStorage(
  admin: SupabaseClient,
  empresaId: string,
  presupuestoId: string,
  pdfBuffer: Buffer,
  congelado: boolean,
): Promise<{ url: string; storagePath: string }> {
  const carpeta = congelado ? 'congelados' : 'presupuestos'
  const timestamp = congelado ? `_${Date.now()}` : ''
  const storagePath = `${empresaId}/${carpeta}/${presupuestoId}${timestamp}.pdf`

  if (!congelado) {
    await admin.storage.from('documentos-pdf').remove([storagePath]).catch(() => {})
  }

  const { error } = await admin.storage
    .from('documentos-pdf')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: !congelado,
      cacheControl: 'no-cache, no-store, must-revalidate',
    })

  if (error) throw new Error(`Error al subir PDF a Storage: ${error.message}`)

  const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)
  // Agregar timestamp para romper caché del navegador/CDN
  const urlConCacheBuster = `${urlData.publicUrl}?t=${Date.now()}`
  return { url: urlConCacheBuster, storagePath }
}

// ─── Función principal ───

export async function generarPdfPresupuesto(
  admin: SupabaseClient,
  presupuestoId: string,
  empresaId: string,
  opciones: { congelado?: boolean; forzar?: boolean } = {}
): Promise<ResultadoPdf> {
  const { congelado = false, forzar = false } = opciones

  // 1. Obtener presupuesto
  const { data: presupuesto, error: errPres } = await admin
    .from('presupuestos').select('*')
    .eq('id', presupuestoId).eq('empresa_id', empresaId).single()

  if (errPres || !presupuesto) throw new Error('Presupuesto no encontrado')

  // 2. Verificar si necesita regeneración
  if (!congelado && !forzar && presupuesto.pdf_url && presupuesto.pdf_generado_en) {
    const pdfGeneradoEn = new Date(presupuesto.pdf_generado_en).getTime()
    const actualizadoEn = new Date(presupuesto.actualizado_en).getTime()
    if (pdfGeneradoEn >= actualizadoEn) {
      // Agregar cache buster a la URL existente
      const urlBase = presupuesto.pdf_url.split('?')[0]
      const urlFresca = `${urlBase}?t=${Date.now()}`
      return { url: urlFresca, storage_path: presupuesto.pdf_storage_path || '', nombre_archivo: '', tamano: 0 }
    }
  }

  // 3. Obtener líneas, cuotas, config y empresa
  const [{ data: lineas }, { data: cuotas }, { data: config }, { data: empresa }] = await Promise.all([
    admin.from('lineas_presupuesto').select('*').eq('presupuesto_id', presupuestoId).order('orden'),
    admin.from('presupuesto_cuotas').select('*').eq('presupuesto_id', presupuestoId).order('numero'),
    admin.from('config_presupuestos').select('*').eq('empresa_id', empresaId).single(),
    admin.from('empresas').select('*').eq('id', empresaId).single(),
  ])

  if (!empresa) throw new Error('Empresa no encontrada')

  // 4. Logo — elegir cuadrado o apaisado según config
  const tipoLogo = config?.membrete?.tipo_logo || 'cuadrado'
  let logoUrl = empresa.logo_url || ''
  try {
    const rutaLogo = `${empresaId}/${tipoLogo}.png`
    const { data: logoData } = admin.storage.from('logos').getPublicUrl(rutaLogo)
    if (logoData?.publicUrl) logoUrl = logoData.publicUrl
  } catch { /* usar URL original */ }

  // 5. Renderizar HTML
  const obtenerSimbolo = (monedaId: string) => {
    const m = (config?.monedas || []).find((m: { id: string; simbolo: string }) => m.id === monedaId)
    return m?.simbolo || '$'
  }

  const datosPresupuesto: DatosPresupuestoPdf = {
    numero: presupuesto.numero, estado: presupuesto.estado,
    fecha_emision: presupuesto.fecha_emision, fecha_emision_original: presupuesto.fecha_emision_original || null, fecha_vencimiento: presupuesto.fecha_vencimiento,
    moneda: presupuesto.moneda, moneda_simbolo: obtenerSimbolo(presupuesto.moneda),
    referencia: presupuesto.referencia, condicion_pago_label: presupuesto.condicion_pago_label,
    nota_plan_pago: presupuesto.nota_plan_pago,
    contacto_nombre: presupuesto.contacto_nombre, contacto_apellido: presupuesto.contacto_apellido,
    contacto_identificacion: presupuesto.contacto_identificacion, contacto_condicion_iva: presupuesto.contacto_condicion_iva,
    contacto_direccion: presupuesto.contacto_direccion, contacto_correo: presupuesto.contacto_correo,
    contacto_telefono: presupuesto.contacto_telefono,
    atencion_nombre: presupuesto.atencion_nombre, atencion_cargo: presupuesto.atencion_cargo,
    atencion_correo: presupuesto.atencion_correo,
    subtotal_neto: presupuesto.subtotal_neto, total_impuestos: presupuesto.total_impuestos,
    descuento_global: presupuesto.descuento_global, descuento_global_monto: presupuesto.descuento_global_monto,
    total_final: presupuesto.total_final,
    notas_html: presupuesto.notas_html, condiciones_html: presupuesto.condiciones_html,
    lineas: (lineas || []) as unknown as LineaPresupuesto[],
    cuotas: (cuotas || []) as unknown as CuotaPago[],
    columnas_lineas: presupuesto.columnas_lineas || undefined,
  }

  const datosEmpresa: DatosEmpresa = {
    nombre: empresa.nombre, logo_url: logoUrl,
    datos_fiscales: empresa.datos_fiscales, pais: empresa.pais, paises: empresa.paises || [],
    color_marca: empresa.color_marca || null,
    direccion: empresa.ubicacion || '', telefono: empresa.telefono || '',
    correo: empresa.correo || '', pagina_web: empresa.pagina_web || '',
  }

  const configPdf: ConfigPdf = {
    membrete: config?.membrete || null, pie_pagina: config?.pie_pagina || null,
    plantilla_html: config?.plantilla_html || null, patron_nombre_pdf: config?.patron_nombre_pdf || null,
    datos_empresa_pdf: config?.datos_empresa_pdf || null, monedas: config?.monedas || [],
  }

  const html = renderizarHtml(datosPresupuesto, datosEmpresa, configPdf)

  // 5b. Mini header para <thead> (repite en cada página via CSS table-header-group)
  const theadHtml = `<div style="display:flex;justify-content:space-between;align-items:center;padding:2mm 0 2mm;border-bottom:0.5px solid #e5e7eb;margin-bottom:4mm;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:7pt;color:#9ca3af;">
  <div style="display:flex;align-items:center;">
    ${logoUrl ? `<img src="${logoUrl}" style="max-height:14px;object-fit:contain;" />` : ''}
  </div>
  <span>${presupuesto.numero}</span>
</div>`

  // 5c. Footer completo para Puppeteer (siempre al fondo de cada página).
  // Incluye el pie visual (QR, textos, imágenes) + paginación dinámica.
  // Las imágenes se convierten a base64 porque Puppeteer footerTemplate no carga URLs.
  const pie = config?.pie_pagina
  const pieTam = pie?.tamano_texto || 10
  const paginaHtml = '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>'

  // Convertir URL de imagen a base64 para el footerTemplate de Puppeteer
  async function urlABase64(url: string): Promise<string> {
    try {
      const res = await fetch(url)
      if (!res.ok) return ''
      const buf = Buffer.from(await res.arrayBuffer())
      const tipo = res.headers.get('content-type') || 'image/png'
      return `data:${tipo};base64,${buf.toString('base64')}`
    } catch { return '' }
  }

  // Renderizar columna del pie con imágenes en base64
  async function renderColPie(col?: { tipo?: string; texto?: string; tamano_texto?: number; imagen_url?: string; texto_imagen?: string; posicion_texto?: string; alineacion_texto?: string }): Promise<string> {
    if (!col || col.tipo === 'vacio') return ''
    if (col.tipo === 'texto') {
      const tam = col.tamano_texto || pieTam
      return col.texto ? `<span style="font-size:${tam}px">${col.texto}</span>` : ''
    }
    if (col.tipo === 'numeracion') return paginaHtml
    if (col.tipo === 'imagen') {
      let imgTag = ''
      if (col.imagen_url) {
        const b64 = await urlABase64(col.imagen_url)
        imgTag = b64 ? `<img src="${b64}" style="max-height:35px;object-fit:contain;">` : ''
      }
      const txt = col.texto_imagen ? `<span style="font-size:0.85em">${col.texto_imagen}</span>` : ''
      if (!txt) return imgTag
      const esArriba = col.posicion_texto === 'arriba'
      const alin = col.alineacion_texto === 'derecha' ? 'flex-end' : col.alineacion_texto === 'centro' ? 'center' : 'flex-start'
      return `<div style="display:inline-flex;flex-direction:column;align-items:${alin};gap:2px">${esArriba ? txt + imgTag : imgTag + txt}</div>`
    }
    return ''
  }

  // Renderizar las 3 columnas del pie en paralelo
  const [pieIzq, pieCen, pieDer] = await Promise.all([
    renderColPie(pie?.columnas?.izquierda),
    renderColPie(pie?.columnas?.centro),
    renderColPie(pie?.columnas?.derecha),
  ])

  const tieneContenidoPie = !!(pieIzq || pieCen || pieDer)
  const colorLinea = pie?.color_linea === 'marca'
    ? (() => { const h = (empresa.color_marca || '#3b82f6').replace('#',''); return `rgb(${parseInt(h.substring(0,2),16)},${parseInt(h.substring(2,4),16)},${parseInt(h.substring(4,6),16)})` })()
    : '#d1d5db'

  const footerTemplate = `<div style="width:100%;padding:0 13mm;font-family:Helvetica,Arial,sans-serif;font-size:${pieTam}px;color:#9ca3af;">
  ${tieneContenidoPie && (pie?.linea_superior !== false) ? `<div style="border-top:${pie?.grosor_linea || 1}px solid ${colorLinea};margin-bottom:4px"></div>` : ''}
  ${tieneContenidoPie ? `<div style="display:flex;justify-content:space-between;align-items:center">
    <div>${pieIzq}</div>
    <div style="text-align:center">${pieCen}</div>
    <div style="text-align:right">${pieDer}</div>
  </div>` : `<div style="text-align:right;font-size:8px">${paginaHtml}</div>`}
</div>`

  // 6. Convertir y subir
  const { pdf: pdfBuffer, miniatura: miniaturaBuffer } = await htmlAPdf(html, { theadHtml, footerTemplate })
  const nombreArchivo = generarNombreArchivo(config?.patron_nombre_pdf, {
    numero: presupuesto.numero, contacto_nombre: presupuesto.contacto_nombre,
    contacto_apellido: presupuesto.contacto_apellido, fecha_emision: presupuesto.fecha_emision,
    referencia: presupuesto.referencia,
  })

  const { url, storagePath } = await subirAStorage(admin, empresaId, presupuestoId, pdfBuffer, congelado)

  // 6b. Subir miniatura
  let miniaturaUrl: string | null = null
  if (miniaturaBuffer && !congelado) {
    const miniaturaPath = `${empresaId}/miniaturas/${presupuestoId}.webp`
    await admin.storage.from('documentos-pdf').remove([miniaturaPath]).catch(() => {})
    const { error: errMini } = await admin.storage
      .from('documentos-pdf')
      .upload(miniaturaPath, miniaturaBuffer, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: 'no-cache, no-store, must-revalidate',
      })
    if (!errMini) {
      const { data: miniUrl } = admin.storage.from('documentos-pdf').getPublicUrl(miniaturaPath)
      miniaturaUrl = `${miniUrl.publicUrl}?t=${Date.now()}`
    }
  }

  // 7. Actualizar presupuesto si no es congelado
  if (!congelado) {
    if (presupuesto.pdf_storage_path && presupuesto.pdf_storage_path !== storagePath) {
      await admin.storage.from('documentos-pdf').remove([presupuesto.pdf_storage_path]).catch(() => {})
    }
    const actualizacion: Record<string, unknown> = {
      pdf_url: url, pdf_storage_path: storagePath, pdf_generado_en: new Date().toISOString(),
    }
    if (miniaturaUrl) actualizacion.pdf_miniatura_url = miniaturaUrl
    await admin.from('presupuestos').update(actualizacion).eq('id', presupuestoId)
  }

  return { url, storage_path: storagePath, nombre_archivo: nombreArchivo, tamano: pdfBuffer.length }
}
