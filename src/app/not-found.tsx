import Link from 'next/link'

/**
 * Página 404 — Se muestra cuando la ruta no existe.
 */
export default function NoEncontrado() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-superficie-app px-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-5 select-none" aria-hidden>
          {'( o_O)?'}
        </div>
        <h1 className="text-xl font-semibold text-texto-primario mb-2">
          Esa página no existe
        </h1>
        <p className="text-texto-secundario mb-8 text-sm leading-relaxed">
          Puede que el link esté roto o que la página haya sido movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-colors"
          style={{ background: 'var(--marca-500)' }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
