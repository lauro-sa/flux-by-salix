'use client'

/**
 * Error boundary global — Captura errores no manejados en toda la app.
 * Incluye su propio <html> porque reemplaza el layout raíz.
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
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#0a0a0a',
          color: '#e5e5e5',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem', userSelect: 'none' }} aria-hidden="true">
              {':\\'}
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>
              Algo no funcionó como esperábamos
            </h1>
            <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
              Puede ser algo temporal. Probá recargar y si sigue pasando, ya lo vamos a saber.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid #333',
                  background: 'transparent',
                  color: '#e5e5e5',
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
                  background: '#fff',
                  color: '#111',
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
              <p style={{ color: '#555', fontSize: '0.7rem', marginTop: '2rem', fontFamily: 'monospace' }}>
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
