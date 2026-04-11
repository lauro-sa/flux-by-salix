'use client'

import { Map, useMap } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { useEffect } from 'react'
import { MarcadorVisita } from './MarcadorVisita'
import type { PropiedadesMapaVisitas } from './tipos-mapa'
import { calcularCentro } from './utilidades-mapa'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

/**
 * Mapa para la sección Visitas (escritorio).
 * Muestra marcadores con color según estado, auto-fit bounds.
 */
export function MapaVisitas({
  puntos,
  onClickPunto,
  className = '',
  zoom,
  centro,
}: PropiedadesMapaVisitas) {
  // Fallback sin API key — lista de direcciones con links a Google Maps
  if (!API_KEY) {
    return (
      <div className={`rounded-xl border border-borde-sutil bg-superficie-tarjeta p-4 ${className}`}>
        <p className="text-texto-secundario text-sm mb-3">
          Mapa no disponible — configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
        {puntos.map((p) => (
          <a
            key={p.id}
            href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-2 text-sm hover:bg-superficie-elevada rounded px-2"
          >
            <MapPin size={14} />
            <span>{p.titulo}</span>
            {p.subtitulo && <span className="text-texto-terciario">{p.subtitulo}</span>}
          </a>
        ))}
      </div>
    )
  }

  const centroMapa = centro || calcularCentro(puntos)

  return (
    <div className={`rounded-xl overflow-hidden h-[200px] md:h-[400px] ${className}`}>
      <Map
        mapId="VISITAS_MAP"
        defaultCenter={centroMapa}
        defaultZoom={zoom || 12}
        gestureHandling="greedy"
        disableDefaultUI
        className="w-full h-full"
      >
        <AjustadorBounds puntos={puntos} />
        {puntos.map((punto) => (
          <MarcadorVisita
            key={punto.id}
            punto={punto}
            onClick={onClickPunto ? () => onClickPunto(punto) : undefined}
          />
        ))}
      </Map>
    </div>
  )
}

/**
 * Componente interno que ajusta el viewport para mostrar todos los puntos.
 */
function AjustadorBounds({ puntos }: { puntos: { lat: number; lng: number }[] }) {
  const mapa = useMap()

  useEffect(() => {
    if (!mapa || puntos.length < 2) return

    const bounds = new google.maps.LatLngBounds()
    puntos.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    mapa.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
  }, [mapa, puntos])

  return null
}
