'use client'

import DOMPurify from 'isomorphic-dompurify'

interface Props {
  /** HTML crudo a renderizar de forma segura */
  html: string
  /** Clase CSS del contenedor */
  className?: string
  /** Elemento wrapper (default: div) */
  como?: 'div' | 'span' | 'p' | 'article'
  /** Configuración extra de DOMPurify */
  opciones?: Record<string, unknown>
}

/**
 * Componente que renderiza HTML sanitizado con DOMPurify.
 * Reemplaza uso directo de dangerouslySetInnerHTML en toda la app.
 * Se usa en: previews de correo, plantillas WhatsApp, notas del portal, recibos de nómina.
 */
export default function HtmlSeguro({ html, className, como: Wrapper = 'div', opciones }: Props) {
  const htmlLimpio = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target', 'rel', 'style'],
    ...opciones,
  })

  return (
    <Wrapper
      className={className}
      dangerouslySetInnerHTML={{ __html: htmlLimpio }}
    />
  )
}
