'use client'

import { Map, useMap } from '@vis.gl/react-google-maps'
import { MapPin, Zap, Route, ShieldOff, Settings2, Plus, Minus, Maximize2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { MarcadorVisita } from './MarcadorVisita'
import type { PuntoMapa, PreferenciaRuta, PropiedadesMapaRecorrido } from './tipos-mapa'
import { calcularCentro } from './utilidades-mapa'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

const OPCIONES_RUTA: { valor: PreferenciaRuta; etiqueta: string; icono: typeof Zap }[] = [
  { valor: 'rapida', etiqueta: 'Más rápida', icono: Zap },
  { valor: 'evitar_autopistas', etiqueta: 'Sin autopistas', icono: Route },
  { valor: 'evitar_peajes', etiqueta: 'Sin peajes', icono: ShieldOff },
]

/**
 * Mapa para la sección Recorrido (mobile).
 * Dibuja la ruta REAL por calles usando Google Directions API.
 * Selector de preferencia de ruta colapsable para no ocupar espacio en mobile.
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
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [enfocado, setEnfocado] = useState(false) // true cuando zoom en una parada específica

  const cambiarPreferencia = useCallback((nueva: PreferenciaRuta) => {
    setPreferencia(nueva)
    onCambioPreferencia?.(nueva)
    setSelectorAbierto(false)
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

  // Centro del mapa: solo paradas (NO incluir origen GPS que puede estar en otro país/continente)
  // Si no hay paradas, usar origen GPS o fallback Buenos Aires
  const centroMapa = calcularCentro(
    puntos.length > 0
      ? puntos
      : origen
        ? [{ lat: origen.lat, lng: origen.lng }]
        : [{ lat: -34.6037, lng: -58.3816 }]
  )

  // Si no hay paradas, usar center controlado para que se actualice cuando llega la ubicación
  const sinParadas = puntos.length === 0

  return (
    <div className={`relative overflow-hidden h-full ${className}`}>
      <Map
        mapId="RECORRIDO_MAP"
        {...(sinParadas
          ? { center: centroMapa, zoom: 14 }
          : { defaultCenter: centroMapa, defaultZoom: 13 }
        )}
        gestureHandling="greedy"
        disableDefaultUI
        colorScheme="DARK"
        className="w-full h-full"
      >
        {/* FitBounds automático — ajusta zoom para mostrar todas las paradas */}
        {puntos.length > 0 && <AjustadorBounds puntos={puntos} />}

        {/* Ruta real por calles */}
        {puntos.length > 0 && (
          <RutaReal
            puntos={puntos}
            origen={origen}
            destino={destino}
            preferencia={preferencia}
            onInfoRuta={onInfoRuta}
          />
        )}

        {/* Marcador de origen — punto azul GPS */}
        {origen && (
          <AdvancedMarker
            position={{ lat: origen.lat, lng: origen.lng }}
            title={origen.texto || 'Punto de partida'}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute size-8 rounded-full bg-blue-500/20 animate-pulse" />
              <div className="size-3.5 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
            </div>
          </AdvancedMarker>
        )}

        {/* Marcadores de paradas — tocar hace zoom a ese punto */}
        {puntos.map((punto, i) => (
          <MarcadorParadaConZoom
            key={punto.id}
            punto={punto}
            orden={i + 1}
            esActual={i === paradaActual}
            esCompletada={punto.estado === 'completada'}
            onClick={() => {
              onClickParada?.(punto, i)
              setEnfocado(true)
            }}
          />
        ))}
      </Map>

      {/* Overlay invisible para cerrar el selector al tocar afuera */}
      {selectorAbierto && (
        <div className="absolute inset-0 z-10" onClick={() => setSelectorAbierto(false)} />
      )}

      {/* Botones de zoom + ver todo — esquina derecha, subidos */}
      <BotonesZoom enfocado={enfocado} onVerTodo={() => setEnfocado(false)} puntos={puntos} />

      {/* Opciones de ruta — esquina izquierda, subido */}
      {puntos.length > 0 && (
        <div className="absolute bottom-14 left-3 z-20">
          {selectorAbierto ? (
            <div className="flex flex-col gap-1 bg-black/80 backdrop-blur-md rounded-xl p-1.5 border border-white/10">
              {OPCIONES_RUTA.map(({ valor, etiqueta, icono: Icono }) => (
                <button
                  key={valor}
                  onClick={() => cambiarPreferencia(valor)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    preferencia === valor
                      ? 'bg-blue-600 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icono size={13} />
                  <span>{etiqueta}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setSelectorAbierto(true)}
              className="flex items-center justify-center size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors"
              title="Opciones de ruta"
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Dibuja la ruta REAL por calles usando DirectionsService + DirectionsRenderer.
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

    if (!serviceRef.current) {
      serviceRef.current = new google.maps.DirectionsService()
    }

    if (!rendererRef.current) {
      rendererRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: '#4a6cf7',
          strokeOpacity: 0.9,
          strokeWeight: 4,
        },
      })
    }

    rendererRef.current.setMap(mapa)

    // Si el origen GPS está muy lejos de las paradas (>500km), ignorarlo
    // (ej: simulador en San Francisco, paradas en Buenos Aires)
    const origenCercano = (() => {
      if (!origen || puntos.length === 0) return null
      const dLat = Math.abs(origen.lat - puntos[0].lat)
      const dLng = Math.abs(origen.lng - puntos[0].lng)
      return (dLat + dLng) < 5 ? origen : null // ~500km umbral
    })()

    const puntoOrigen = origenCercano || puntos[0]
    const puntoDestino = destino || puntos[puntos.length - 1]
    const paradasWaypoints = destino
      ? puntos
      : (origenCercano ? puntos.slice(0, -1) : puntos.slice(1, -1))
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

/**
 * AjustadorBounds — Ajusta el zoom del mapa para que entren todas las paradas.
 */
function AjustadorBounds({ puntos }: { puntos: { lat: number; lng: number }[] }) {
  const mapa = useMap()
  const ajustadoRef = useRef(false)

  useEffect(() => {
    if (!mapa || puntos.length === 0) return
    // Solo ajustar una vez al cargar (no en cada re-render)
    if (ajustadoRef.current) return
    ajustadoRef.current = true

    const bounds = new google.maps.LatLngBounds()
    puntos.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    mapa.fitBounds(bounds, { top: 60, right: 30, bottom: 30, left: 30 })
  }, [mapa, puntos])

  return null
}

/**
 * MarcadorParadaConZoom — Marcador que al tocarlo hace zoom al punto.
 */
function MarcadorParadaConZoom({ punto, orden, esActual, esCompletada, onClick }: {
  punto: PuntoMapa
  orden: number
  esActual: boolean
  esCompletada: boolean
  onClick?: () => void
}) {
  const mapa = useMap()

  const manejarClick = () => {
    if (mapa) {
      mapa.panTo({ lat: punto.lat, lng: punto.lng })
      mapa.setZoom(17)
    }
    onClick?.()
  }

  return (
    <MarcadorVisita
      punto={punto}
      orden={orden}
      esActual={esActual}
      esCompletada={esCompletada}
      onClick={manejarClick}
    />
  )
}

/**
 * BotonesZoom — Botones + / - y "ver todo" para zoom del mapa.
 */
function BotonesZoom({ enfocado, onVerTodo, puntos }: { enfocado: boolean; onVerTodo: () => void; puntos: { lat: number; lng: number }[] }) {
  const mapa = useMap()

  const hacerZoom = (delta: number) => {
    if (!mapa) return
    const zoomActual = mapa.getZoom() || 13
    mapa.setZoom(zoomActual + delta)
  }

  const verTodo = () => {
    if (!mapa || puntos.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    puntos.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    mapa.fitBounds(bounds, { top: 60, right: 30, bottom: 30, left: 30 })
    onVerTodo()
  }

  return (
    <div className="absolute bottom-14 right-3 z-20 flex flex-col gap-1.5">
      {enfocado && (
        <button
          onClick={verTodo}
          className="flex items-center justify-center size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white active:bg-white/20 transition-colors"
          title="Ver todo el recorrido"
        >
          <Maximize2 size={16} />
        </button>
      )}
      <button
        onClick={() => hacerZoom(1)}
        className="flex items-center justify-center size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white active:bg-white/20 transition-colors"
      >
        <Plus size={18} />
      </button>
      <button
        onClick={() => hacerZoom(-1)}
        className="flex items-center justify-center size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white active:bg-white/20 transition-colors"
      >
        <Minus size={18} />
      </button>
    </div>
  )
}
