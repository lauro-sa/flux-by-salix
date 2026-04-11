'use client'

import { Map, useMap } from '@vis.gl/react-google-maps'
import { MapPin, Route, Zap, ShieldOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { MarcadorVisita } from './MarcadorVisita'
import type { PreferenciaRuta, PropiedadesMapaRecorrido } from './tipos-mapa'
import { calcularCentro } from './utilidades-mapa'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

const OPCIONES_RUTA: { valor: PreferenciaRuta; etiqueta: string; icono: typeof Zap }[] = [
  { valor: 'rapida', etiqueta: 'Más rápida', icono: Zap },
  { valor: 'evitar_autopistas', etiqueta: 'Sin autopistas', icono: Route },
  { valor: 'evitar_peajes', etiqueta: 'Sin peajes', icono: ShieldOff },
]

/**
 * Mapa para la sección Recorrido (mobile).
 * Dibuja la ruta REAL por calles usando Google Directions API (DirectionsService).
 * Incluye selector de preferencia de ruta.
 */
export function MapaRecorrido({
  ruta,
  paradaActual = 0,
  onClickParada,
  className = '',
  preferenciaInicial = 'rapida',
  onCambioPreferencia,
  onInfoRuta,
}: PropiedadesMapaRecorrido) {
  const { puntos, origen, destino } = ruta
  const [preferencia, setPreferencia] = useState<PreferenciaRuta>(preferenciaInicial)

  const cambiarPreferencia = useCallback((nueva: PreferenciaRuta) => {
    setPreferencia(nueva)
    onCambioPreferencia?.(nueva)
  }, [onCambioPreferencia])

  // Fallback sin API key
  if (!API_KEY) {
    return (
      <div className={`rounded-xl border border-borde-sutil bg-superficie-tarjeta p-4 ${className}`}>
        <p className="text-texto-secundario text-sm mb-3">
          Mapa no disponible — configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
        {puntos.map((p, i) => (
          <a
            key={p.id}
            href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-2 text-sm hover:bg-superficie-elevada rounded px-2"
          >
            <span className="flex items-center justify-center size-5 rounded bg-[#1a1a2e] border border-[#4a6cf7] text-white text-xs font-bold">
              {i + 1}
            </span>
            <MapPin size={14} />
            <span>{p.titulo}</span>
            {p.subtitulo && <span className="text-texto-terciario">{p.subtitulo}</span>}
          </a>
        ))}
      </div>
    )
  }

  const todosPuntos = origen
    ? [{ lat: origen.lat, lng: origen.lng }, ...puntos]
    : puntos
  const centroMapa = calcularCentro(todosPuntos)

  return (
    <div className={`relative overflow-hidden h-[50vh] md:h-[400px] ${className}`}>
      <Map
        mapId="RECORRIDO_MAP"
        defaultCenter={centroMapa}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI
        colorScheme="DARK"
        className="w-full h-full"
      >
        {/* Ruta real por calles usando DirectionsService */}
        <RutaReal
          puntos={puntos}
          origen={origen}
          destino={destino}
          preferencia={preferencia}
          onInfoRuta={onInfoRuta}
        />

        {/* Marcador de origen — punto azul como GPS */}
        {origen && (
          <AdvancedMarker
            position={{ lat: origen.lat, lng: origen.lng }}
            title={origen.texto || 'Punto de partida'}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute size-6 rounded-full bg-blue-500/20" />
              <div className="size-3 rounded-full bg-blue-500 border-2 border-white shadow-md" />
            </div>
          </AdvancedMarker>
        )}

        {/* Marcadores de paradas numerados */}
        {puntos.map((punto, i) => (
          <MarcadorVisita
            key={punto.id}
            punto={punto}
            orden={i + 1}
            esActual={i === paradaActual}
            esCompletada={punto.estado === 'completada'}
            onClick={onClickParada ? () => onClickParada(punto, i) : undefined}
          />
        ))}
      </Map>

      {/* Selector de preferencia de ruta — debajo del header flotante */}
      <div className="absolute left-3 flex gap-1 bg-black/70 backdrop-blur-sm rounded-lg p-1" style={{ top: 'calc(env(safe-area-inset-top, 8px) + 52px)' }}>
        {OPCIONES_RUTA.map(({ valor, etiqueta, icono: Icono }) => (
          <button
            key={valor}
            onClick={() => cambiarPreferencia(valor)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              preferencia === valor
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={etiqueta}
          >
            <Icono size={12} />
            <span className="hidden sm:inline">{etiqueta}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Dibuja la ruta REAL por calles usando DirectionsService + DirectionsRenderer.
 * Re-calcula cuando cambian los puntos o la preferencia de ruta.
 */
function RutaReal({
  puntos,
  origen,
  destino,
  preferencia,
  onInfoRuta,
}: {
  puntos: { lat: number; lng: number }[]
  origen?: { lat: number; lng: number }
  destino?: { lat: number; lng: number }
  preferencia: PreferenciaRuta
  onInfoRuta?: (info: { distancia_km: number; duracion_min: number }) => void
}) {
  const mapa = useMap()
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const serviceRef = useRef<google.maps.DirectionsService | null>(null)

  useEffect(() => {
    if (!mapa || puntos.length === 0) return

    // Inicializar servicio y renderer una sola vez
    if (!serviceRef.current) {
      serviceRef.current = new google.maps.DirectionsService()
    }

    if (!rendererRef.current) {
      rendererRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // usamos nuestros propios marcadores
        preserveViewport: false, // que ajuste el viewport a la ruta
        polylineOptions: {
          strokeColor: '#4a6cf7',
          strokeOpacity: 0.9,
          strokeWeight: 4,
        },
      })
    }

    rendererRef.current.setMap(mapa)

    // Construir request
    const puntoOrigen = origen || puntos[0]
    // Si hay destino explícito, todas las paradas son waypoints y el destino es el final.
    // Si no, la última parada es el destino.
    const puntoDestino = destino || puntos[puntos.length - 1]
    const paradasWaypoints = destino
      ? puntos // todas las paradas son waypoints, el destino es aparte
      : (origen ? puntos.slice(0, -1) : puntos.slice(1, -1)) // última parada = destino
    const waypoints = paradasWaypoints.map((p) => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      stopover: true,
    }))

    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(puntoOrigen.lat, puntoOrigen.lng),
      destination: new google.maps.LatLng(puntoDestino.lat, puntoDestino.lng),
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: preferencia === 'evitar_autopistas',
      avoidTolls: preferencia === 'evitar_peajes',
    }

    serviceRef.current.route(request, (resultado, estado) => {
      if (estado === google.maps.DirectionsStatus.OK && resultado) {
        rendererRef.current?.setDirections(resultado)

        // Calcular distancia y duración total sumando todos los legs
        if (onInfoRuta && resultado.routes[0]?.legs) {
          const legs = resultado.routes[0].legs
          const distanciaTotal = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0)
          const duracionTotal = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0)
          onInfoRuta({
            distancia_km: Math.round(distanciaTotal / 100) / 10,
            duracion_min: Math.round(duracionTotal / 60),
          })
        }
      }
    })

    return () => {
      rendererRef.current?.setMap(null)
    }
  }, [mapa, puntos, origen, destino, preferencia, onInfoRuta])

  return null
}
