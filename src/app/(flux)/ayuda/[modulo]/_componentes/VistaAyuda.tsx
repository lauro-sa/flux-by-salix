'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

interface Props {
  slug: string
  contenido: string | null
}

/**
 * Render del manual de usuario de un módulo.
 * Toma el contenido Markdown crudo y lo renderiza con styling profesional
 * usando tokens semánticos de Flux (compatible dark/light mode).
 *
 * Si `contenido` es null (MD inexistente), muestra estado vacío con
 * mensaje informativo y link de vuelta al módulo.
 */
export default function VistaAyuda({ slug, contenido }: Props) {
  const { t } = useTraduccion()

  return (
    <div className="min-h-screen bg-superficie-app">
      {/* Header sticky */}
      <header className="sticky top-0 z-10 border-b border-borde-sutil bg-superficie-app/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-2 text-texto-secundario hover:text-texto-primario transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            {t('ayuda.volver')}
          </Link>
          <div className="inline-flex items-center gap-2 text-texto-terciario text-sm">
            <BookOpen size={14} />
            <span>{t('ayuda.titulo')}</span>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        {contenido ? (
          <article>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>
              {contenido}
            </ReactMarkdown>
          </article>
        ) : (
          <EstadoVacio
            titulo={t('ayuda.sin_guia_titulo')}
            descripcion={t('ayuda.sin_guia_descripcion')}
          />
        )}
      </main>
    </div>
  )
}

/**
 * Override de cada elemento Markdown para aplicar estilos coherentes
 * con los tokens semánticos de Flux. Sin tocar globals.css.
 */
const renderers = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-3xl md:text-4xl font-bold text-texto-primario mb-4 leading-tight">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-2xl md:text-3xl font-semibold text-texto-primario mt-12 mb-4 leading-tight">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xl md:text-2xl font-semibold text-texto-primario mt-8 mb-3 leading-snug">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-lg font-semibold text-texto-primario mt-6 mb-2">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-base text-texto-secundario leading-relaxed mb-4">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 mb-4 space-y-2 text-texto-secundario">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-2 text-texto-secundario">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-texto-primario">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-texto-secundario">{children}</em>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="text-texto-marca hover:underline font-medium"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-texto-marca/40 bg-superficie-tarjeta pl-4 pr-4 py-3 my-4 rounded-r text-texto-secundario italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    // Inline code (sin className tipo language-xxx)
    if (!className) {
      return (
        <code className="bg-superficie-tarjeta text-texto-primario px-1.5 py-0.5 rounded text-sm font-mono border border-borde-sutil">
          {children}
        </code>
      )
    }
    // Code block (queda dentro de <pre>)
    return (
      <code className="block bg-superficie-tarjeta text-texto-primario p-4 rounded-lg text-sm font-mono leading-relaxed overflow-x-auto border border-borde-sutil whitespace-pre">
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-4">{children}</pre>
  ),
  hr: () => <hr className="my-12 border-borde-sutil" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-borde-sutil">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-superficie-tarjeta border-b border-borde-sutil">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-borde-sutil">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="text-left px-4 py-3 font-semibold text-texto-primario">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-3 text-texto-secundario align-top">{children}</td>
  ),
}

function EstadoVacio({
  titulo,
  descripcion,
}: {
  titulo: string
  descripcion: string
}) {
  return (
    <div className="text-center py-24">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-superficie-tarjeta border border-borde-sutil mb-6">
        <BookOpen size={28} className="text-texto-terciario" />
      </div>
      <h2 className="text-xl font-semibold text-texto-primario mb-3">
        {titulo}
      </h2>
      <p className="text-texto-secundario max-w-md mx-auto leading-relaxed">
        {descripcion}
      </p>
    </div>
  )
}
