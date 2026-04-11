// Tipos para componentes de mapa — usados por Visitas (escritorio) y Recorrido (mobile)

export interface PuntoMapa {
  id: string
  lat: number
  lng: number
  titulo: string
  subtitulo?: string
  estado?: 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'
}

export interface RutaMapa {
  puntos: PuntoMapa[]
  origen?: { lat: number; lng: number; texto?: string }
  /** Destino final de la ruta. Si es igual al origen, la ruta es circular. */
  destino?: { lat: number; lng: number; texto?: string }
}

export type ModoNavegacion = 'completa' | 'siguiente'

// Preferencia de ruta para Directions API y navegación externa
export type PreferenciaRuta = 'rapida' | 'evitar_autopistas' | 'evitar_peajes'

export interface PropiedadesMapaVisitas {
  puntos: PuntoMapa[]
  onClickPunto?: (punto: PuntoMapa) => void
  className?: string
  zoom?: number
  centro?: { lat: number; lng: number }
}

export interface PropiedadesMapaRecorrido {
  ruta: RutaMapa
  paradaActual?: number
  onClickParada?: (punto: PuntoMapa, indice: number) => void
  className?: string
  /** Preferencia de ruta inicial */
  preferenciaInicial?: PreferenciaRuta
  /** Callback cuando cambia la preferencia de ruta */
  onCambioPreferencia?: (preferencia: PreferenciaRuta) => void
  /** Info de ruta calculada (distancia, duración) */
  onInfoRuta?: (info: { distancia_km: number; duracion_min: number }) => void
  /** Forzar zoom a la parada actual desde afuera (ej: al abrir registro) */
  enfocarParada?: boolean
}
