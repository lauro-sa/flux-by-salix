import type { ReactNode } from 'react'

interface PropiedadesTarjetaMetrica {
  titulo: string
  valor: string | number
  icono?: ReactNode
  color?: string
}

function TarjetaMetrica({ titulo, valor, icono, color }: PropiedadesTarjetaMetrica) {
  return (
    <div className="p-3 rounded-card text-center" style={{ background: 'var(--superficie-hover)' }}>
      {icono && <div className="flex justify-center mb-1" style={color ? { color } : undefined}>{icono}</div>}
      <p className="text-lg font-bold text-texto-primario">{valor}</p>
      <p className="text-xxs text-texto-terciario">{titulo}</p>
    </div>
  )
}

export { TarjetaMetrica, type PropiedadesTarjetaMetrica }
