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
            --superficie-app: #f6f6f6;
            --texto-primario: #1a1a1a;
            --texto-secundario: #666;
            --borde-sutil: #ddd;
            --boton-fondo: #1a1a1a;
            --boton-texto: #fff;
            --texto-terciario: #999;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --superficie-app: #0a0a0a;
              --texto-primario: #e5e5e5;
              --texto-secundario: #888;
              --borde-sutil: #333;
              --boton-fondo: #fff;
              --boton-texto: #111;
              --texto-terciario: #555;
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
          background: 'var(--superficie-app)',
          color: 'var(--texto-primario)',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem', userSelect: 'none' }} aria-hidden="true">
              {':\\'}
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Algo no funcionó como esperábamos
            </h1>
            <p style={{ color: 'var(--texto-secundario)', marginBottom: '2rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
              Puede ser algo temporal. Probá recargar y si sigue pasando, ya lo vamos a saber.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--borde-sutil)',
                  background: 'transparent',
                  color: 'var(--texto-primario)',
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
                  background: 'var(--boton-fondo)',
                  color: 'var(--boton-texto)',
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
              <p style={{ color: 'var(--texto-terciario)', fontSize: '0.7rem', marginTop: '2rem', fontFamily: 'monospace' }}>
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
