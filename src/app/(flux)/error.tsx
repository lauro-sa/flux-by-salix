'use client'

import { Boton } from '@/componentes/ui/Boton'

/**
 * Error boundary para la sección autenticada de Flux.
 * Captura errores en páginas individuales sin romper el layout/sidebar.
 */
export default function ErrorFlux({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-5 select-none" aria-hidden>
          {'(  >_<)'}
        </div>
        <h1 className="text-xl font-semibold text-texto-primario mb-2">
          Ups, algo se rompió
        </h1>
        <p className="text-texto-secundario mb-8 text-sm leading-relaxed">
          No fue tu culpa. Ya estamos al tanto y lo vamos a resolver.
        </p>
        <div className="flex gap-3 justify-center">
          <Boton variante="secundario" onClick={reset}>
            Reintentar
          </Boton>
          <Boton variante="primario" onClick={() => window.location.href = '/dashboard'}>
            Ir al inicio
          </Boton>
        </div>
        {error.digest && (
          <p className="text-texto-terciario text-xs mt-8 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
