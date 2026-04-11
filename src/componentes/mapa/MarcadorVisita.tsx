'use client'

import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { Check } from 'lucide-react'
import type { PuntoMapa } from './tipos-mapa'

interface PropiedadesMarcadorVisita {
  punto: PuntoMapa
  orden?: number
  esActual?: boolean
  esCompletada?: boolean
  onClick?: () => void
}

/**
 * Marcador custom estilo "pin cuadrado oscuro" con número.
 * Inspirado en apps de rutas de reparto (marcadores numerados con cola triangular).
 */
export function MarcadorVisita({
  punto,
  orden,
  esActual = false,
  esCompletada = false,
  onClick,
}: PropiedadesMarcadorVisita) {
  const tamaño = esActual ? 36 : 28
  const fontSize = esActual ? 14 : 12

  // Colores según estado
  const estaCompletada = esCompletada || punto.estado === 'completada'
  const estaCancelada = punto.estado === 'cancelada'

  let bgColor = '#1a1a2e' // oscuro por defecto (como la referencia)
  let borderColor = '#4a6cf7' // azul
  if (estaCompletada) {
    bgColor = '#047857'
    borderColor = '#059669'
  } else if (estaCancelada) {
    bgColor = '#991b1b'
    borderColor = '#dc2626'
  } else if (esActual) {
    bgColor = '#4a6cf7'
    borderColor = '#6d8afb'
  }

  return (
    <AdvancedMarker
      position={{ lat: punto.lat, lng: punto.lng }}
      onClick={onClick}
      title={punto.titulo}
    >
      <div className="flex flex-col items-center" style={{ cursor: onClick ? 'pointer' : 'default' }}>
        {/* Pin cuadrado con número */}
        <div
          className="flex items-center justify-center font-bold text-white shadow-lg"
          style={{
            width: tamaño,
            height: tamaño,
            backgroundColor: bgColor,
            borderColor,
            borderWidth: 2,
            borderStyle: 'solid',
            borderRadius: 6,
            fontSize,
            ...(esActual ? { animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : {}),
          }}
        >
          {estaCompletada ? (
            <Check size={esActual ? 18 : 14} strokeWidth={3} />
          ) : orden !== undefined ? (
            orden
          ) : (
            <div
              className="rounded-full bg-white"
              style={{ width: tamaño * 0.3, height: tamaño * 0.3 }}
            />
          )}
        </div>
        {/* Cola triangular del pin */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${bgColor}`,
            marginTop: -1,
          }}
        />
      </div>
    </AdvancedMarker>
  )
}
