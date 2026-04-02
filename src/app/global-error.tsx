'use client'

/**
 * Error boundary global — Captura errores no manejados en toda la app.
 * Incluye su propio <html> porque reemplaza el layout raíz.
 * Usa tokens CSS inline porque no puede depender de globals.css.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <head>
        <style>{`
          :root {
            --eg-fondo: #f6f6f6;
            --eg-texto: #1a1a1a;
            --eg-texto-secundario: #666;
            --eg-borde: #ddd;
            --eg-boton-fondo: #1a1a1a;
            --eg-boton-texto: #fff;
            --eg-ref: #999;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --eg-fondo: #0a0a0a;
              --eg-texto: #e5e5e5;
              --eg-texto-secundario: #888;
              --eg-borde: #333;
              --eg-boton-fondo: #fff;
              --eg-boton-texto: #111;
              --eg-ref: #555;
            }
          }
        `}</style>
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'var(--eg-fondo)',
          color: 'var(--eg-texto)',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem', userSelect: 'none' }} aria-hidden="true">
              {':\\'}
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Algo no funcionó como esperábamos
            </h1>
            <p style={{ color: 'var(--eg-texto-secundario)', marginBottom: '2rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
              Puede ser algo temporal. Probá recargar y si sigue pasando, ya lo vamos a saber.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--eg-borde)',
                  background: 'transparent',
                  color: 'var(--eg-texto)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Reintentar
              </button>
              <a
                href="/dashboard"
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'var(--eg-boton-fondo)',
                  color: 'var(--eg-boton-texto)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Ir al inicio
              </a>
            </div>
            {error.digest && (
              <p style={{ color: 'var(--eg-ref)', fontSize: '0.7rem', marginTop: '2rem', fontFamily: 'monospace' }}>
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
