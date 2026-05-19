'use client'

/**
 * EsqueletoBrillo — Placeholder de carga con un brillo que barre suave
 * de izquierda a derecha (~1.8s loop). Se usa para anticipar líneas o
 * cards de contenido que están viniendo del backend.
 *
 * A diferencia de un skeleton plano (que solo cambia de opacity),
 * el brillo sutil comunica que algo está pasando "en vivo" en vez
 * de "esta pantalla está congelada esperando datos".
 *
 * Props:
 *  - lineas: cuántos renglones simular (default 3). Último renglón sale
 *    más corto para imitar el final de un párrafo.
 *  - variante: 'parrafo' (líneas apiladas) | 'tarjeta' (un bloque sólido
 *    con padding). Default 'parrafo'.
 *  - retraso: ms para retrasar el inicio del brillo (útil cuando hay
 *    varios skeletons apilados y queremos desfasarlos).
 *  - className: clases extra del wrapper.
 *
 * NOTA: el brillo está implementado con un pseudo-elemento ::after
 * pero como JSX no soporta pseudo-elementos, usamos un div absoluto
 * adentro con la animación. Es equivalente y compatible con SSR.
 */

interface PropsEsqueletoBrillo {
  lineas?: number
  variante?: 'parrafo' | 'tarjeta'
  retraso?: number
  className?: string
}

export function EsqueletoBrillo({
  lineas = 3,
  variante = 'parrafo',
  retraso = 0,
  className = '',
}: PropsEsqueletoBrillo) {
  if (variante === 'tarjeta') {
    return (
      <div
        className={`relative overflow-hidden rounded-card border border-borde-sutil bg-superficie-app/50 p-4 ${className}`}
        aria-busy="true"
      >
        <BrilloBarrido retraso={retraso} />
        <div className="space-y-2">
          {Array.from({ length: lineas }).map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-superficie-hover"
              style={{ width: i === lineas - 1 ? '55%' : '100%' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden space-y-2 ${className}`}
      aria-busy="true"
    >
      <BrilloBarrido retraso={retraso} />
      {Array.from({ length: lineas }).map((_, i) => (
        <div
          key={i}
          className="h-2 rounded-full bg-superficie-hover"
          style={{ width: i === lineas - 1 ? '55%' : '100%' }}
        />
      ))}
    </div>
  )
}

// Capa absoluta con el brillo barriendo. Se reusa entre las dos variantes.
function BrilloBarrido({ retraso }: { retraso: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(91, 91, 214, 0.08) 50%, transparent 100%)',
        animation: 'flux-brillo-barrido 1.8s ease-in-out infinite',
        animationDelay: `${retraso}ms`,
        transform: 'translateX(-100%)',
      }}
    />
  )
}
