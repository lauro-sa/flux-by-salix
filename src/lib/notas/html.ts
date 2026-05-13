/**
 * Helpers de HTML para Notas Rápidas.
 *
 * Las notas se almacenan como HTML producido por Tiptap. Estos helpers
 * coordinan las conversiones entre texto plano (LLM por WhatsApp,
 * dictado por voz, búsquedas) y HTML (almacenamiento + render).
 */

import DOMPurify from 'isomorphic-dompurify'

const TAGS_PERMITIDOS = [
  'p', 'br', 'span', 'strong', 'em', 's', 'u', 'mark',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'a',
  'hr',
  'label', 'input', 'div',
]

const ATTRS_PERMITIDOS = [
  'href', 'target', 'rel',
  'class', 'style',
  'data-type', 'data-checked',
  'type', 'checked',
]

/**
 * Sanitiza el HTML de una nota antes de persistirlo o renderizarlo.
 * Permite los tags que produce Tiptap con TaskList; bloquea scripts,
 * iframes, eventos inline y URLs javascript:.
 */
export function sanitizarHtmlNota(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS_PERMITIDOS,
    ALLOWED_ATTR: ATTRS_PERMITIDOS,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
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
