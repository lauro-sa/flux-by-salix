'use client'

/**
 * PaginaRecorrido — Experiencia mobile-first inspirada en Spoke para iOS.
 * Layout: mapa fullscreen arriba + sheet deslizable abajo con timeline de paradas.
 * Bottom bar fija con tiempo estimado, Ajustar y botón Iniciar ruta.
 * Se usa en: /recorrido (pantalla completa, sin sidebar ni header).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Route, Loader2, Clock, MapPin, Pencil, Navigation, Sparkles, Undo2, ArrowUpDown, X, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useEmpresa } from '@/hooks/useEmpresa'
import { ProveedorMapa, MapaRecorrido, abrirRutaCompleta } from '@/componentes/mapa'
import type { PuntoMapa, RutaMapa } from '@/componentes/mapa'
import { HeaderRecorrido } from './_componentes/HeaderRecorrido'
import { ListaParadas, type Parada, type DestinoFinal } from './_componentes/ListaParadas'
import { RegistroVisita } from './_componentes/RegistroVisita'
import { ResumenDia } from './_componentes/ResumenDia'
import { ModalLlegada } from './_componentes/ModalLlegada'
import type { EstadoVisita } from './_componentes/TarjetaParada'

/** Obtiene la fecha de hoy en formato YYYY-MM-DD usando la zona horaria local del navegador */
function fechaHoyLocal(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
}

type EstadoRecorrido = 'pendiente' | 'en_curso' | 'completado'

interface DatosRecorrido {
  id: string
  estado: EstadoRecorrido
  total_visitas: number
  visitas_completadas: number
  duracion_total_min: number | null
  distancia_total_km: number | null
}

export default function PaginaRecorrido() {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const { empresa } = useEmpresa()

  // Coordenadas de la empresa como fallback si no hay geolocalización
  const coordsEmpresa = useMemo(() => {
    const dir = empresa?.direccion as { coordenadas?: { lat: number; lng: number } } | null
    if (dir?.coordenadas?.lat && dir?.coordenadas?.lng) {
      return { lat: dir.coordenadas.lat, lng: dir.coordenadas.lng }
    }
    return null
  }, [empresa?.direccion])

  const [cargando, setCargando] = useState(true)
  const [recorrido, setRecorrido] = useState<DatosRecorrido | null>(null)
  const [paradas, setParadas] = useState<Parada[]>([])
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoyLocal)

  // UI
  const [paradaSeleccionada, setParadaSeleccionada] = useState<number | null>(null)
  const [sheetExpandido, setSheetExpandido] = useState(false)
  const [paradaVistaIndice, setParadaVistaIndice] = useState(0) // índice de la parada visible en el sheet colapsado
  const [modoEdicion, setModoEdicion] = useState(false)
  const [optimizando, setOptimizando] = useState(false)
  const [paradasPreOptimizar, setParadasPreOptimizar] = useState<Parada[] | null>(null)

  // Destino final: 'origen' (volver al inicio), 'ninguno', o { lat, lng, texto }
  const [destinoFinal, setDestinoFinal] = useState<'origen' | 'ninguno' | { lat: number; lng: number; texto: string }>('ninguno')

  // Ubicación actual del usuario (para mostrar en el mapa como origen)
  const [ubicacionUsuario, setUbicacionUsuario] = useState<{ lat: number; lng: number } | null>(null)

  // Modal de llegada
  const [llegadaAbierta, setLlegadaAbierta] = useState(false)
  const [visitaLlegada, setVisitaLlegada] = useState<{ nombre: string; direccion: string; telefono: string | null; lat: number | null; lng: number | null; id: string } | null>(null)

  // BottomSheet de registro
  const [registroAbierto, setRegistroAbierto] = useState(false)
  const [visitaRegistro, setVisitaRegistro] = useState<string>('')
  const [modoRegistro, setModoRegistro] = useState<'llegada' | 'completar' | 'editar'>('llegada')
  const [checklistRegistro, setChecklistRegistro] = useState<{ texto: string; completado: boolean }[]>([])

  // Cargar recorrido del día seleccionado
  const cargarRecorrido = useCallback(async (fecha?: string) => {
    const f = fecha || fechaSeleccionada
    setCargando(true)
    try {
      const resp = await fetch(`/api/recorrido/hoy?fecha=${f}`)
      if (!resp.ok) throw new Error('Error al cargar recorrido')
      const data = await resp.json()
      setRecorrido(data.recorrido)
      setParadas(data.paradas || [])
    } catch {
      mostrar('error', 'No se pudo cargar el recorrido')
    } finally {
      setCargando(false)
    }
  }, [fechaSeleccionada, mostrar])

  // Obtener ubicación del usuario para mostrar en el mapa.
  // Fallback: dirección de la empresa si no hay permisos de geolocalización.
  useEffect(() => {
    if (!navigator.geolocation) {
      if (coordsEmpresa) setUbicacionUsuario(coordsEmpresa)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacionUsuario({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { if (coordsEmpresa) setUbicacionUsuario(coordsEmpresa) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [coordsEmpresa])

  useEffect(() => {
    cargarRecorrido(fechaSeleccionada)
  }, [fechaSeleccionada]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarFecha = useCallback((nuevaFecha: string) => {
    setFechaSeleccionada(nuevaFecha)
    setParadaSeleccionada(null)
    setModoEdicion(false)
  }, [])

  // Cálculos derivados
  const paradaActualIndice = paradas.findIndex(
    p => p.visita && p.visita.estado !== 'completada' && p.visita.estado !== 'cancelada'
  )

  // Sincronizar la vista del sheet con la parada activa
  useEffect(() => {
    if (paradaActualIndice >= 0) setParadaVistaIndice(paradaActualIndice)
  }, [paradaActualIndice])
  const completadas = paradas.filter(p => p.visita?.estado === 'completada').length
  const duracionEstimada = recorrido?.duracion_total_min || paradas.reduce(
    (sum, p) => sum + (p.duracion_viaje_min || 0) + (p.visita?.duracion_estimada_min || 15), 0
  )
  const distanciaTotal = recorrido?.distancia_total_km

  // Datos del mapa
  const rutaMapa: RutaMapa = useMemo(() => {
    const puntos: PuntoMapa[] = paradas
      .filter(p => p.visita?.direccion_lat && p.visita?.direccion_lng)
      .map(p => ({
        id: p.visita.id,
        lat: p.visita.direccion_lat!,
        lng: p.visita.direccion_lng!,
        titulo: p.visita.contacto_nombre,
        subtitulo: p.visita.direccion_texto,
        estado: p.visita.estado,
      }))
    // Destino del mapa según configuración
    let destino: { lat: number; lng: number; texto?: string } | undefined
    if (destinoFinal === 'origen' && ubicacionUsuario) {
      destino = { ...ubicacionUsuario, texto: 'Volver al inicio' }
    } else if (typeof destinoFinal === 'object') {
      destino = destinoFinal
    }

    return {
      puntos,
      origen: ubicacionUsuario ? { ...ubicacionUsuario, texto: 'Mi ubicación' } : undefined,
      destino,
    }
  }, [paradas, ubicacionUsuario, destinoFinal])

  // Reordenar paradas
  const manejarReordenar = useCallback(async (paradasReordenadas: Parada[]) => {
    setParadas(paradasReordenadas)
    try {
      const resp = await fetch('/api/recorrido/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido?.id,
          paradas: paradasReordenadas.map(p => ({ id: p.id, orden: p.orden })),
        }),
      })
      if (!resp.ok) throw new Error()
    } catch {
      mostrar('error', 'Error al reordenar')
      cargarRecorrido()
    }
  }, [recorrido?.id, mostrar, cargarRecorrido])

  // Cambiar estado de visita
  const manejarCambiarEstado = useCallback(async (visitaId: string, nuevoEstado: EstadoVisita) => {
    setParadas(prev => prev.map(p =>
      p.visita?.id === visitaId ? { ...p, visita: { ...p.visita, estado: nuevoEstado } } : p
    ))
    setParadaSeleccionada(null)
    try {
      const resp = await fetch('/api/recorrido/estado', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: visitaId, estado: nuevoEstado }),
      })
      if (!resp.ok) throw new Error()
      await cargarRecorrido()
    } catch {
      mostrar('error', 'Error al cambiar estado')
      cargarRecorrido()
    }
  }, [mostrar, cargarRecorrido])

  // Marcar llegada: cambiar estado a en_sitio + abrir modal con datos del contacto
  const manejarLlegada = useCallback((visitaId: string) => {
    const parada = paradas.find(p => p.visita?.id === visitaId)
    if (!parada) return
    const v = parada.visita
    setVisitaLlegada({
      id: visitaId,
      nombre: v.contacto_nombre,
      direccion: v.direccion_texto,
      telefono: v.contacto_telefono || null,
      lat: v.direccion_lat,
      lng: v.direccion_lng,
    })
    manejarCambiarEstado(visitaId, 'en_sitio')
    setLlegadaAbierta(true)
  }, [paradas, manejarCambiarEstado])

  // Abrir BottomSheet de registro
  const manejarRegistrar = useCallback((visitaId: string) => {
    const parada = paradas.find(p => p.visita?.id === visitaId)
    if (!parada) return
    const estado = parada.visita.estado
    setVisitaRegistro(visitaId)
    setModoRegistro(estado === 'en_camino' ? 'llegada' : 'completar')
    setChecklistRegistro(
      Array.isArray(parada.visita.checklist)
        ? (parada.visita.checklist as { texto: string; completado: boolean }[])
        : []
    )
    setRegistroAbierto(true)
  }, [paradas])

  // Abrir BottomSheet en modo editar (para agregar info, fotos, etc.)
  const manejarEditar = useCallback((visitaId: string) => {
    setVisitaRegistro(visitaId)
    setModoRegistro('editar')
    setChecklistRegistro([])
    setRegistroAbierto(true)
  }, [])

  const manejarRegistroExitoso = useCallback(() => {
    setParadaSeleccionada(null)
    cargarRecorrido()
  }, [cargarRecorrido])

  // Iniciar ruta: marca primera parada como en_camino y abre Google Maps
  const iniciarRuta = useCallback(() => {
    const primera = paradas.find(p =>
      p.visita?.estado === 'programada' && p.visita?.direccion_lat && p.visita?.direccion_lng
    )
    if (primera) {
      manejarCambiarEstado(primera.visita.id, 'en_camino')
      const puntos = paradas
        .filter(p => p.visita?.direccion_lat && p.visita?.direccion_lng && p.visita?.estado !== 'completada' && p.visita?.estado !== 'cancelada')
        .map(p => ({ lat: p.visita.direccion_lat!, lng: p.visita.direccion_lng! }))

      // Agregar destino final si está configurado
      if (destinoFinal === 'origen' && puntos.length > 0) {
        // Ruta circular: Google Maps necesita que el último punto sea el origen
        // abrirRutaCompleta usa el último como destino, así que obtenemos la ubicación actual
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            puntos.push({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            abrirRutaCompleta(puntos)
          },
          () => abrirRutaCompleta(puntos), // sin geo, abrir sin retorno
          { enableHighAccuracy: true, timeout: 5000 }
        )
      } else if (typeof destinoFinal === 'object' && puntos.length > 0) {
        puntos.push({ lat: destinoFinal.lat, lng: destinoFinal.lng })
        abrirRutaCompleta(puntos)
      } else if (puntos.length > 0) {
        abrirRutaCompleta(puntos)
      }
    }
  }, [paradas, manejarCambiarEstado, destinoFinal])

  // Invertir el orden de las paradas
  const invertirRuta = useCallback(async () => {
    const invertidas = [...paradas].reverse().map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(invertidas)
    try {
      const resp = await fetch('/api/recorrido/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido?.id,
          paradas: invertidas.map(p => ({ id: p.id, orden: p.orden })),
        }),
      })
      if (!resp.ok) throw new Error()
      mostrar('exito', 'Ruta invertida')
    } catch {
      mostrar('error', 'Error al invertir')
      cargarRecorrido()
    }
  }, [paradas, recorrido?.id, mostrar, cargarRecorrido])

  // Optimizar ruta via Google Directions API
  const optimizarRuta = useCallback(async () => {
    const paradasConCoords = paradas.filter(
      p => p.visita?.direccion_lat != null && p.visita?.direccion_lng != null
    )
    if (paradasConCoords.length < 2) {
      mostrar('info', 'Se necesitan al menos 2 paradas con coordenadas para optimizar')
      return
    }

    setOptimizando(true)
    setParadasPreOptimizar([...paradas])
    try {
      // Obtener ubicación actual como origen, o usar la primera parada
      let origen = { lat: paradasConCoords[0].visita.direccion_lat!, lng: paradasConCoords[0].visita.direccion_lng! }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        )
        origen = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch {
        // Si no hay geo, usar primera parada como origen
      }

      // Llamar a la API de optimización
      const resp = await fetch('/api/mapa/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen,
          paradas: paradasConCoords.map(p => ({
            id: p.visita.id,
            lat: p.visita.direccion_lat!,
            lng: p.visita.direccion_lng!,
          })),
        }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Error al optimizar')
      }

      const data = await resp.json()
      const paradasOptimizadas = data.paradas_ordenadas as { id: string }[]

      // Reordenar las paradas locales según el orden óptimo
      const mapaParadas = new Map(paradas.map(p => [p.visita.id, p]))
      const reordenadas = paradasOptimizadas
        .map((po, i) => {
          const original = mapaParadas.get(po.id)
          if (!original) return null
          return { ...original, orden: i + 1 }
        })
        .filter((p): p is Parada => p !== null)

      // Agregar paradas sin coordenadas al final (mantienen su posición relativa)
      const idsCon = new Set(paradasConCoords.map(p => p.visita.id))
      const sinCoords = paradas
        .filter(p => !idsCon.has(p.visita.id))
        .map((p, i) => ({ ...p, orden: reordenadas.length + i + 1 }))

      const todasReordenadas = [...reordenadas, ...sinCoords]

      // Aplicar optimistic + guardar en servidor
      setParadas(todasReordenadas)

      const respReordenar = await fetch('/api/recorrido/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido?.id,
          paradas: todasReordenadas.map(p => ({ id: p.id, orden: p.orden })),
        }),
      })
      if (!respReordenar.ok) throw new Error('Error al guardar orden')

      mostrar('exito', `Ruta optimizada · ${data.distancia_total_km} km · ${data.duracion_total_min} min`)
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'No se pudo optimizar la ruta')
      cargarRecorrido()
    } finally {
      setOptimizando(false)
    }
  }, [paradas, recorrido?.id, mostrar, cargarRecorrido])

  // Revertir optimización al orden anterior
  const revertirOptimizacion = useCallback(async () => {
    if (!paradasPreOptimizar) return
    const restauradas = paradasPreOptimizar.map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(restauradas)
    setParadasPreOptimizar(null)
    try {
      await fetch('/api/recorrido/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido?.id,
          paradas: restauradas.map(p => ({ id: p.id, orden: p.orden })),
        }),
      })
      mostrar('info', 'Orden revertido')
    } catch {
      mostrar('error', 'Error al revertir')
      cargarRecorrido()
    }
  }, [paradasPreOptimizar, recorrido?.id, mostrar, cargarRecorrido])

  // Formatear duración
  const formatearDuracion = (min: number) => {
    if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`
    return `${min} min`
  }

  // Calcular estado del recorrido
  const estadoRecorrido: EstadoRecorrido = recorrido?.estado as EstadoRecorrido ||
    (completadas >= paradas.length && paradas.length > 0 ? 'completado' : completadas > 0 ? 'en_curso' : 'pendiente')

  // Loading
  if (cargando) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-superficie-app">
        <Loader2 size={32} className="animate-spin text-texto-terciario" />
      </div>
    )
  }

  // Sin recorrido — mapa con ubicación actual + estado vacío
  if (!recorrido || paradas.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-superficie-app overflow-hidden">
        <div className="h-[45dvh] relative">
          <ProveedorMapa>
            <MapaRecorrido
              ruta={{ puntos: [], origen: ubicacionUsuario ? { ...ubicacionUsuario, texto: 'Mi ubicación' } : undefined }}
              paradaActual={-1}
              className="!rounded-none !h-full"
            />
          </ProveedorMapa>
          <HeaderRecorrido fecha={fechaSeleccionada} onCambiarFecha={cambiarFecha} completadas={0} total={0} />
        </div>

        <div className="flex-1 bg-superficie-app rounded-t-2xl -mt-3 relative z-10 flex flex-col">
          <div className="flex justify-center py-2.5">
            <div className="w-9 h-1 rounded-full bg-borde-fuerte/40" />
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <EstadoVacio
              icono={<Route size={52} strokeWidth={1} />}
              titulo={t('recorrido.sin_recorrido')}
              descripcion={t('recorrido.sin_recorrido_desc')}
            />
          </div>
        </div>
      </div>
    )
  }

  // Recorrido completado
  if (estadoRecorrido === 'completado') {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-superficie-app overflow-hidden">
        <div className="h-[35dvh] relative">
          <ProveedorMapa>
            <MapaRecorrido
              ruta={rutaMapa}
              paradaActual={-1}
              className="!rounded-none !h-full"
            />
          </ProveedorMapa>
          <HeaderRecorrido
            fecha={fechaSeleccionada}
            onCambiarFecha={cambiarFecha}
            completadas={completadas}
            total={paradas.length}
          />
        </div>
        <div className="flex-1 bg-superficie-app rounded-t-2xl -mt-3 relative z-10">
          <div className="flex justify-center py-2.5">
            <div className="w-9 h-1 rounded-full bg-borde-fuerte/40" />
          </div>
          <ResumenDia
            totalVisitas={paradas.length}
            completadas={completadas}
            duracionTotalMin={recorrido.duracion_total_min}
            distanciaTotalKm={recorrido.distancia_total_km}
          />
        </div>
      </div>
    )
  }

  // ── Recorrido activo — layout Spoke ──
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-superficie-app overflow-hidden">
      {/* ── Mapa superior — crece cuando sheet está colapsado ── */}
      <div className={`relative shrink-0 transition-all duration-300 ease-out ${sheetExpandido ? 'h-[25dvh]' : 'h-[55dvh]'}`}>
        <ProveedorMapa>
          <MapaRecorrido
            ruta={rutaMapa}
            paradaActual={paradaActualIndice}
            onClickParada={(_punto, indice) => setParadaSeleccionada(indice)}
            className="!rounded-none !h-full"
          />
        </ProveedorMapa>

        {/* Header flotante sobre el mapa */}
        <HeaderRecorrido
          fecha={fechaSeleccionada}
          onCambiarFecha={cambiarFecha}
          completadas={completadas}
          total={paradas.length}
        />
      </div>

      {/* ── Sheet inferior — colapsable estilo app nativa ── */}
      <div className="flex-1 min-h-0 bg-superficie-app rounded-t-2xl -mt-3 relative z-10 flex flex-col">
        {/* Drag handle — tocar para expandir/colapsar */}
        <button
          className="flex justify-center py-2.5 shrink-0 w-full"
          onClick={() => setSheetExpandido(!sheetExpandido)}
        >
          <div className="w-9 h-1 rounded-full bg-borde-fuerte/40" />
        </button>

        {/* Barra de progreso + info — siempre visible */}
        {paradas.length > 0 && (
          <div className="px-4 pb-2 shrink-0 space-y-1.5">
            <div className="flex gap-1">
            {paradas.map((p, i) => {
              let color = 'bg-borde-sutil'
              if (p.visita?.estado === 'completada') color = 'bg-[var(--insignia-exito)]'
              else if (p.visita?.estado === 'cancelada') color = 'bg-[var(--insignia-peligro)]'
              else if (i === paradaActualIndice) color = 'bg-[var(--insignia-info)]'
              return <div key={p.id} className={`h-1 rounded-full flex-1 transition-colors duration-300 ${color}`} />
            })}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-[var(--insignia-exito)]" />
                <span className="text-[11px] font-semibold text-[var(--insignia-exito)]">{formatearDuracion(duracionEstimada)}</span>
              </div>
              <span className="text-[11px] text-texto-terciario">{completadas}/{paradas.length} completadas</span>
            </div>
          </div>
        )}

        {!sheetExpandido ? (
          /* ── COLAPSADO: tarjeta deslizable + acciones fijas abajo ── */
          <div className="flex-1 flex flex-col min-h-0 justify-between">
            {paradas.length > 0 && (() => {
              const idx = Math.min(paradaVistaIndice, paradas.length - 1)
              const parada = paradas[idx]
              if (!parada) return null
              const v = parada.visita
              const estado = v.estado as 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'
              const tieneCoords = v.direccion_lat != null && v.direccion_lng != null
              const esActiva = idx === paradaActualIndice

              // Determinar color principal del estado
              const colorEstado = estado === 'completada' ? 'var(--insignia-exito)'
                : estado === 'cancelada' ? 'var(--insignia-peligro)'
                : estado === 'en_camino' || estado === 'en_sitio' ? 'var(--insignia-info)'
                : esActiva ? 'var(--insignia-info)' : 'var(--borde-fuerte)'

              // Swipe handler
              const manejarSwipe = (e: React.TouchEvent) => {
                const touch = e.changedTouches[0]
                const startX = (e.target as HTMLElement).dataset.startX
                if (!startX) return
                const diff = touch.clientX - Number(startX)
                if (diff > 50) setParadaVistaIndice(Math.max(0, idx - 1))
                else if (diff < -50) setParadaVistaIndice(Math.min(paradas.length - 1, idx + 1))
              }

              return (
                <>
                  {/* ── Tarjeta de parada — deslizable ── */}
                  <div
                    className="px-4 py-2"
                    onTouchStart={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.dataset.startX = String(e.touches[0].clientX)
                    }}
                    onTouchEnd={(e) => {
                      const el = e.currentTarget as HTMLElement
                      const startX = el.dataset.startX
                      if (!startX) return
                      const diff = e.changedTouches[0].clientX - Number(startX)
                      if (diff > 50) setParadaVistaIndice(Math.max(0, idx - 1))
                      else if (diff < -50) setParadaVistaIndice(Math.min(paradas.length - 1, idx + 1))
                    }}
                  >
                    <button
                      className="w-full flex items-center gap-3 text-left py-2 px-3 rounded-xl border border-borde-sutil/50 bg-white/[0.02]"
                      onClick={() => setSheetExpandido(true)}
                    >
                      <div className="flex items-center justify-center size-10 rounded-full border-2 shrink-0 text-sm font-bold"
                        style={{
                          borderColor: colorEstado,
                          backgroundColor: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? colorEstado : 'transparent',
                          color: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? 'white' : 'var(--texto-terciario)',
                        }}
                      >
                        {estado === 'completada' ? <Check size={14} /> : estado === 'cancelada' ? <X size={14} /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold text-texto-primario truncate ${estado === 'cancelada' ? 'line-through opacity-50' : ''}`}>
                          {v.contacto_nombre}
                        </div>
                        <div className="text-xs text-texto-terciario truncate">{v.direccion_texto}</div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[11px] font-medium text-texto-terciario">{idx + 1}/{paradas.length}</span>
                        {estado !== 'programada' && (
                          <span className="text-[10px] font-medium" style={{ color: colorEstado }}>
                            {estado === 'en_camino' ? 'En camino' : estado === 'en_sitio' ? 'En sitio' : estado === 'completada' ? 'Completada' : estado === 'cancelada' ? 'Cancelada' : ''}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Indicadores de posición */}
                    <div className="flex justify-center gap-1 mt-2">
                      {paradas.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setParadaVistaIndice(i)}
                          className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5' : 'size-1.5'}`}
                          style={{
                            backgroundColor: i === idx ? colorEstado
                              : paradas[i].visita?.estado === 'completada' ? 'var(--insignia-exito)'
                              : paradas[i].visita?.estado === 'cancelada' ? 'var(--insignia-peligro)'
                              : 'var(--borde-sutil)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ── Acciones fijas — siempre en la misma posición, grid 3 cols ── */}
                  <div className="px-4 pb-2">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Columna 1: Navegar (siempre) */}
                      <button
                        onClick={() => tieneCoords && abrirRutaCompleta([{ lat: v.direccion_lat!, lng: v.direccion_lng! }])}
                        disabled={!tieneCoords || estado === 'completada'}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors disabled:opacity-25"
                      >
                        <Navigation size={16} className="text-[var(--insignia-info)]" />
                        <span className="text-[10px] font-medium text-texto-secundario">Navegar</span>
                      </button>

                      {/* Columna 2: acción negativa / secundaria */}
                      {estado === 'cancelada' ? (
                        <button
                          onClick={() => manejarCambiarEstado(v.id, 'programada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <RotateCcw size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">Reactivar</span>
                        </button>
                      ) : estado === 'completada' ? (
                        <button
                          onClick={() => manejarEditar(v.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <Pencil size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">Editar</span>
                        </button>
                      ) : estado === 'en_sitio' ? (
                        <button
                          onClick={() => manejarEditar(v.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <Pencil size={16} className="text-texto-marca" />
                          <span className="text-[10px] font-medium text-texto-secundario">Info</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => manejarCambiarEstado(v.id, 'cancelada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <X size={16} className="text-[var(--insignia-peligro)]" />
                          <span className="text-[10px] font-medium text-texto-secundario">Cancelar</span>
                        </button>
                      )}

                      {/* Columna 3: acción principal */}
                      {estado === 'programada' ? (
                        <button
                          onClick={() => manejarCambiarEstado(v.id, 'en_camino')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-[var(--insignia-info)]/30 bg-[var(--insignia-info)]/10 hover:bg-[var(--insignia-info)]/20 transition-colors"
                        >
                          <Route size={16} className="text-[var(--insignia-info)]" />
                          <span className="text-[10px] font-medium text-[var(--insignia-info)]">En camino</span>
                        </button>
                      ) : estado === 'en_camino' ? (
                        <button
                          onClick={() => manejarLlegada(v.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-colors"
                        >
                          <MapPin size={16} className="text-[var(--insignia-exito)]" />
                          <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Llegué</span>
                        </button>
                      ) : estado === 'en_sitio' ? (
                        <button
                          onClick={() => manejarRegistrar(v.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-colors"
                        >
                          <Check size={16} className="text-[var(--insignia-exito)]" />
                          <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Completar</span>
                        </button>
                      ) : estado === 'completada' ? (
                        <button
                          onClick={() => manejarCambiarEstado(v.id, 'programada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <RotateCcw size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">Reabrir</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => manejarCambiarEstado(v.id, 'programada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <RotateCcw size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">Reactivar</span>
                        </button>
                      )}
                    </div>

                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          /* ── EXPANDIDO: lista completa de paradas ── */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pb-2 shrink-0">
              <h2 className="text-lg font-bold text-texto-primario">
                {t('recorrido.recorrido_del_dia')}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              <ListaParadas
                paradas={paradas}
                paradaActualIndice={paradaActualIndice}
                paradaSeleccionada={paradaSeleccionada}
                onSeleccionarParada={setParadaSeleccionada}
                onReordenar={manejarReordenar}
                onCambiarEstado={manejarCambiarEstado}
                onRegistrar={manejarRegistrar}
                onEditar={manejarEditar}
                modoEdicion={modoEdicion}
                destinoFinal={destinoFinal}
                onCambiarDestino={modoEdicion ? setDestinoFinal : undefined}
              />
            </div>
          </div>
        )}

        {/* ── Bottom bar ── */}
        <div
          className="border-t border-borde-sutil shrink-0 bg-superficie-app"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {!sheetExpandido ? (
            /* ── Colapsado: solo botón Ajustar para expandir ── */
            <div className="flex justify-center pt-3 pb-1">
              <button
                onClick={() => { setSheetExpandido(true); setModoEdicion(true) }}
                className="text-[11px] font-medium tracking-wider uppercase text-texto-terciario hover:text-texto-secundario px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] transition-colors"
              >
                Ajustar recorrido
              </button>
            </div>
          ) : modoEdicion ? (
            /* ── Expandido + edición: herramientas + iniciar ── */
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={invertirRuta}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-borde-sutil text-texto-secundario hover:bg-superficie-elevada transition-colors"
                >
                  <ArrowUpDown size={14} />
                  <span>Invertir</span>
                </button>
                <button
                  onClick={optimizarRuta}
                  disabled={optimizando}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-borde-sutil text-texto-secundario hover:bg-superficie-elevada transition-colors disabled:opacity-50"
                >
                  {optimizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Optimizar</span>
                </button>
                {paradasPreOptimizar && (
                  <button
                    onClick={revertirOptimizacion}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-[var(--insignia-advertencia)]/40 text-[var(--insignia-advertencia)] hover:bg-[var(--insignia-advertencia)]/10 transition-colors"
                  >
                    <Undo2 size={14} />
                    <span>Revertir</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setModoEdicion(false); setSheetExpandido(false) }}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--insignia-info)' }}
              >
                <span>Confirmar ruta</span>
              </button>
            </div>
          ) : (
            /* ── Expandido + vista: iniciar recorrido completo ── */
            <div className="px-4 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModoEdicion(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border border-borde-sutil text-texto-secundario hover:bg-superficie-elevada transition-colors"
                >
                  <Pencil size={14} />
                  <span>Ajustar</span>
                </button>
                <button
                  onClick={iniciarRuta}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: 'var(--insignia-info)' }}
                >
                  <Navigation size={14} />
                  <span>{t('recorrido.iniciar_recorrido')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BottomSheet de registro */}
      <RegistroVisita
        abierto={registroAbierto}
        onCerrar={() => setRegistroAbierto(false)}
        visitaId={visitaRegistro}
        modo={modoRegistro}
        checklist={checklistRegistro}
        onExito={manejarRegistroExitoso}
      />

      {/* Modal de llegada — se abre al tocar "Llegué" */}
      <ModalLlegada
        abierto={llegadaAbierta}
        onCerrar={() => setLlegadaAbierta(false)}
        contactoNombre={visitaLlegada?.nombre || ''}
        direccionTexto={visitaLlegada?.direccion || ''}
        telefono={visitaLlegada?.telefono}
        direccionLat={visitaLlegada?.lat}
        direccionLng={visitaLlegada?.lng}
        onAvisarLlegada={() => {
          // TODO: automatizar con WhatsApp API / notificación push
          mostrar('exito', `Aviso de llegada enviado a ${visitaLlegada?.nombre}`)
        }}
      />
    </div>
  )
}
