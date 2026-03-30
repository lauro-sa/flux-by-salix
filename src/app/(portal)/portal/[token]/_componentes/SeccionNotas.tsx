'use client'

/**
 * SeccionNotas — Notas y condiciones del presupuesto (HTML renderizado).
 * Se usa en: VistaPortal
 */

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
    <div className="space-y-4">
      {notas.length > 0 && (
        <div>
          <h3 className="text-xs text-texto-terciario uppercase tracking-wider font-medium mb-2">
            {t('portal.notas')}
          </h3>
          <div className="space-y-1">
            {notas.map((html, i) => (
              <div
                key={i}
                className="text-sm text-texto-secundario leading-relaxed [&_p]:my-0.5 [&_strong]:text-texto-primario [&_a]:text-marca-500 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ))}
          </div>
        </div>
      )}

      {condiciones.length > 0 && (
        <div>
          <h3 className="text-xs text-texto-terciario uppercase tracking-wider font-medium mb-2">
            {t('portal.condiciones')}
          </h3>
          <div className="space-y-1">
            {condiciones.map((html, i) => (
              <div
                key={i}
                className="text-sm text-texto-secundario leading-relaxed [&_p]:my-0.5 [&_strong]:text-texto-primario [&_a]:text-marca-500 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
