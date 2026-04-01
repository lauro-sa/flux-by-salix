'use client'

/**
 * SeccionNotas — Notas y condiciones del presupuesto.
 * Estilo idéntico al editor de presupuestos: label uppercase afuera,
 * contenido dentro de tarjeta con estilos HTML preservados.
 * Se usa en: VistaPortal
 */

import DOMPurify from 'isomorphic-dompurify'
import { useTraduccion } from '@/lib/i18n'

interface Props {
  notasHtml: string | null
  condicionesHtml: string | null
}

function parsearNotas(valor: string | null): string[] {
  if (!valor || !valor.trim()) return []
  try {
    const parsed = JSON.parse(valor)
    if (Array.isArray(parsed)) return parsed.filter((h: string) => {
      const limpio = h.replace(/<[^>]*>/g, '').trim()
      return limpio.length > 0
    })
  } catch { /* no es JSON */ }
  if (!valor.includes('<')) {
    return valor.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`)
  }
  return [valor]
}

export default function SeccionNotas({ notasHtml, condicionesHtml }: Props) {
  const { t } = useTraduccion()
  const notas = parsearNotas(notasHtml)
  const condiciones = parsearNotas(condicionesHtml)

  if (notas.length === 0 && condiciones.length === 0) return null

  return (
    <div className="space-y-6">
      {/* ── Notas ── */}
      {notas.length > 0 && (
        <div>
          <h3 className="text-xs text-texto-terciario uppercase tracking-wider font-medium mb-2">
            {t('portal.notas')}
          </h3>
          <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil px-5 py-4 space-y-2">
            {notas.map((html, i) => (
              <div
                key={i}
                className="text-sm text-texto-secundario leading-relaxed portal-html"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'] }) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Términos y Condiciones ── */}
      {condiciones.length > 0 && (
        <div>
          <h3 className="text-xs text-texto-terciario uppercase tracking-wider font-medium mb-2">
            Términos y condiciones
          </h3>
          <div className="bg-superficie-tarjeta rounded-xl border border-borde-sutil px-5 py-4 space-y-2">
            {condiciones.map((html, i) => (
              <div
                key={i}
                className="text-sm text-texto-secundario leading-relaxed portal-html"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'] }) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estilos para el HTML renderizado — preserva colores inline del editor */}
      <style jsx global>{`
        .portal-html p { margin: 0.35rem 0; }
        .portal-html strong, .portal-html b { font-weight: 600; }
        .portal-html em, .portal-html i { font-style: italic; }
        .portal-html a { color: var(--marca-500); text-decoration: underline; }
        .portal-html ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.35rem 0; }
        .portal-html ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.35rem 0; }
        .portal-html li { margin: 0.25rem 0; }
        .portal-html li::marker { color: var(--texto-primario); }
      `}</style>
    </div>
  )
}
