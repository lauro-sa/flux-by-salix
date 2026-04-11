'use client'

/**
 * Página de prueba — bloques de colores para verificar fullscreen.
 * El primer bloque usa margin negativo para extenderse detrás del status bar.
 */
export default function PruebaPantalla() {
  const bloques = [
    { color: '#ff0000', texto: '1 - ROJO (arriba de todo)' },
    { color: '#ff6600', texto: '2 - NARANJA' },
    { color: '#ffcc00', texto: '3 - AMARILLO' },
    { color: '#33cc33', texto: '4 - VERDE' },
    { color: '#0099ff', texto: '5 - AZUL' },
    { color: '#6633cc', texto: '6 - VIOLETA' },
    { color: '#cc0066', texto: '7 - ROSA' },
    { color: '#00cccc', texto: '8 - CYAN' },
    { color: '#ff3366', texto: '9 - CORAL' },
    { color: '#0000ff', texto: '10 - AZUL OSCURO (abajo de todo)' },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {bloques.map((b, i) => (
        <div
          key={i}
          style={{
            minHeight: '120px',
            background: b.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            borderBottom: '2px solid rgba(0,0,0,0.3)',
            // Primer bloque: extender detrás del status bar
            ...(i === 0 ? {
              marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
              paddingTop: 'env(safe-area-inset-top, 0px)',
            } : {}),
          }}
        >
          {b.texto}
        </div>
      ))}
    </div>
  )
}
