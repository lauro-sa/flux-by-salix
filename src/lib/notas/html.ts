/**
 * Helpers de HTML para Notas Rápidas.
 *
 * Las notas se almacenan como HTML producido por Tiptap. Estos helpers
 * coordinan las conversiones entre texto plano (LLM por WhatsApp,
 * dictado por voz, búsquedas) y HTML (almacenamiento + render).
 *
 * NOTA: sanitización implementada con whitelist regex pura (sin jsdom /
 * DOMPurify). El HTML solo viene de Tiptap o del LLM, ambos controlados,
 * y se renderiza dentro de la app autenticada (no expone superficie XSS
 * a terceros). Razón del cambio: isomorphic-dompurify carga jsdom, que
 * en runtime serverless de Vercel falla con ERR_REQUIRE_ESM al cargar
 * html-encoding-sniffer/@exodus/bytes, y eso cascaba sobre todo el
 * pipeline de Salix IA (webhook WhatsApp 500, ver incidente 2026-05-13).
 */

const TAGS_PERMITIDOS = new Set([
  'p', 'br', 'span', 'strong', 'em', 's', 'u', 'mark',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'a',
  'hr',
  'label', 'input', 'div',
])

const ATTRS_PERMITIDOS = new Set([
  'href', 'target', 'rel',
  'class', 'style',
  'data-type', 'data-checked',
  'type', 'checked',
])

const URI_SEGURA = /^(?:https?|mailto|tel):/i

/**
 * Sanitiza el HTML de una nota antes de persistirlo o renderizarlo.
 * Permite los tags que produce Tiptap con TaskList; bloquea scripts,
 * iframes, eventos inline y URLs javascript:.
 */
export function sanitizarHtmlNota(html: string): string {
  if (!html) return ''

  // 1) Eliminar bloques peligrosos completos (script, style, iframe, etc.).
  let s = html.replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')

  // 2) Procesar cada tag de apertura/cierre por whitelist.
  //    Atributos: filtrados por whitelist + chequeo de URLs en href/src.
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, slash: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!TAGS_PERMITIDOS.has(t)) return ''
    if (slash) return `</${t}>`

    // Procesar atributos uno por uno.
    const attrsLimpios: string[] = []
    const attrRe = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(attrs)) !== null) {
      const nombre = m[1].toLowerCase()
      const valor = m[3] ?? m[4] ?? m[5] ?? ''
      if (nombre.startsWith('on')) continue // eventos inline bloqueados
      if (!ATTRS_PERMITIDOS.has(nombre)) continue
      // href: solo URI seguro o ancla relativa.
      if (nombre === 'href') {
        const trimVal = valor.trim()
        if (!URI_SEGURA.test(trimVal) && !trimVal.startsWith('#') && !trimVal.startsWith('/')) continue
      }
      // style: bloquear expresiones JS embebidas.
      if (nombre === 'style' && /(javascript:|expression\s*\(|url\s*\(\s*['"]?javascript:)/i.test(valor)) continue
      attrsLimpios.push(`${nombre}="${valor.replace(/"/g, '&quot;')}"`)
    }

    // Self-closing tags compatibles con Tiptap (input, br, hr).
    const esVoid = t === 'br' || t === 'hr' || t === 'input'
    const attrsTexto = attrsLimpios.length > 0 ? ' ' + attrsLimpios.join(' ') : ''
    return esVoid ? `<${t}${attrsTexto}>` : `<${t}${attrsTexto}>`
  })

  return s
}

/**
 * Convierte texto plano del LLM / dictado a HTML válido de Tiptap.
 * Detecta:
 *  - Líneas con `* `, `• `, `- ` → `<ul><li>`.
 *  - Líneas con 4+ guiones como separador → `<hr>`.
 *  - Doble salto separa párrafos; simple → `<br>`.
 *  - Escapa `<`, `>`, `&`, `"`, `'`.
 */
export function textoPlanoAHtml(texto: string): string {
  if (!texto) return ''
  const limpio = texto.trim()
  if (!limpio) return ''

  const escapar = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const procesarBloque = (bloque: string): string => {
    const lineas = bloque.split('\n')
    const salida: string[] = []
    const bufferLista: string[] = []
    const bufferParrafo: string[] = []

    const cerrarLista = () => {
      if (bufferLista.length === 0) return
      const items = bufferLista.map((t) => `<li>${escapar(t)}</li>`).join('')
      salida.push(`<ul>${items}</ul>`)
      bufferLista.length = 0
    }
    const cerrarParrafo = () => {
      if (bufferParrafo.length === 0) return
      salida.push(`<p>${bufferParrafo.map(escapar).join('<br>')}</p>`)
      bufferParrafo.length = 0
    }

    for (const linea of lineas) {
      const trimmed = linea.trim()
      if (/^[\s—–-]{4,}$/.test(trimmed) && /[—–-]/.test(trimmed)) {
        cerrarLista()
        cerrarParrafo()
        salida.push('<hr>')
        continue
      }
      const bullet = trimmed.match(/^(?:\*|•|-)\s+(.+)$/)
      if (bullet && !trimmed.startsWith('--')) {
        cerrarParrafo()
        bufferLista.push(bullet[1].trim())
        continue
      }
      cerrarLista()
      if (trimmed === '') continue
      bufferParrafo.push(linea)
    }
    cerrarLista()
    cerrarParrafo()

    return salida.join('')
  }

  return limpio
    .split(/\n{2,}/)
    .map(procesarBloque)
    .filter(Boolean)
    .join('')
}

/**
 * Convierte HTML de una nota a texto plano legible (previews por
 * WhatsApp / búsquedas / preview en lista lateral). Preserva el estado
 * de checklist con `[x]` / `[ ]` antes de stripear.
 */
export function htmlATextoPlano(html: string): string {
  if (!html) return ''
  let s = html

  // Checklist: capturar estado antes de stripear tags.
  s = s.replace(/<li[^>]*data-checked="true"[^>]*>/gi, '<li>[x] ')
  s = s.replace(/<li[^>]*data-checked="false"[^>]*>/gi, '<li>[ ] ')

  // Saltos de línea naturales.
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')

  // Sacar checkbox renderizado (el estado ya quedó en `[x]`/`[ ]`).
  s = s.replace(/<input[^>]*>/gi, '')

  // Strip resto.
  s = s.replace(/<[^>]+>/g, '')

  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  s = s.replace(/\n{3,}/g, '\n\n').trim()
  return s
}

/**
 * Preview de una sola línea para la lista lateral del PanelNotas.
 */
export function previewNota(html: string, maxLargo = 140): string {
  const plano = htmlATextoPlano(html).replace(/\n+/g, ' ').trim()
  if (plano.length <= maxLargo) return plano
  return plano.slice(0, maxLargo).trimEnd() + '…'
}

/**
 * Agrega un bloque de texto plano al final de un HTML existente.
 */
export function appendTextoPlanoAHtml(htmlExistente: string, textoNuevo: string): string {
  const bloqueNuevo = textoPlanoAHtml(textoNuevo)
  if (!bloqueNuevo) return htmlExistente
  if (!htmlExistente?.trim()) return bloqueNuevo
  return `${htmlExistente}${bloqueNuevo}`
}
