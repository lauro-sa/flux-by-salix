'use client'

/**
 * PaginaRecorrido — Experiencia mobile-first inspirada en Spoke para iOS.
 * Layout: mapa fullscreen arriba + sheet deslizable abajo con timeline de paradas.
 * Bottom bar fija con tiempo estimado, Ajustar y botón Iniciar ruta.
 * Se usa en: /recorrido (pantalla completa, sin sidebar ni header).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Route, Loader2, Clock, MapPin, Pencil, Navigation, Sparkles, Undo2, ArrowUpDown, X, Check, RotateCcw, Phone, Plus, Coffee, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Cargador } from '@/componentes/ui/Cargador'
import { useEmpresa } from '@/hooks/useEmpresa'
import { ProveedorMapa, MapaRecorrido, abrirRutaCompleta } from '@/componentes/mapa'
import type { PuntoMapa, RutaMapa } from '@/componentes/mapa'
import { FormParadaRecorrido, type PayloadParadaGenerica } from '@/componentes/entidad/FormParadaRecorrido'
import { HeaderRecorrido } from './_componentes/HeaderRecorrido'
import { ListaParadas, type Parada, type DestinoFinal } from './_componentes/ListaParadas'
import { RegistroVisita } from './_componentes/RegistroVisita'
import { RegistroParada } from './_componentes/RegistroParada'
import { ResumenDia } from './_componentes/ResumenDia'
import { ModalLlegada } from './_componentes/ModalLlegada'
import { ModalAvisoEnCamino } from './_componentes/ModalAvisoEnCamino'
import { ModalAvisoLlegada } from './_componentes/ModalAvisoLlegada'
import type { EstadoVisita } from './_componentes/TarjetaParada'
import { calcularHorariosRecorrido, formatearHora, type ParadaHorario } from '@/lib/recorrido-horarios'

/** Obtiene la fecha de hoy en formato YYYY-MM-DD usando la zona horaria local del navegador */
function fechaHoyLocal(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
}

type EstadoRecorrido = 'pendiente' | 'en_curso' | 'completado'

interface ConfigRecorrido {
  puede_reordenar?: boolean
  puede_cambiar_duracion?: boolean
  puede_agregar_paradas?: boolean
  puede_quitar_paradas?: boolean
  puede_cancelar?: boolean
}

interface DatosRecorrido {
  id: string
  estado: EstadoRecorrido
  total_visitas: number
  visitas_completadas: number
  total_paradas: number
  paradas_completadas: number
  duracion_total_min: number | null
  distancia_total_km: number | null
  config?: ConfigRecorrido | null
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

  // Modal de aviso "en camino"
  const [avisoCaminoAbierto, setAvisoCaminoAbierto] = useState(false)
  const [visitaAvisoCamino, setVisitaAvisoCamino] = useState<{ id: string; nombre: string; direccion: string } | null>(null)

  // Modal de aviso "ya llegué" — análogo al de en camino pero sin ETA
  const [avisoLlegadaAbierto, setAvisoLlegadaAbierto] = useState(false)
  const [visitaAvisoLlegada, setVisitaAvisoLlegada] = useState<{ id: string; nombre: string; direccion: string } | null>(null)

  // Config de visitas — necesitamos saber si los avisos por WhatsApp están activos para
  // decidir si abrir los modales de envío al cambiar de estado durante el recorrido.
  const { data: configVisitas } = useQuery<{ enviar_avisos_whatsapp?: boolean } | null>({
    queryKey: ['config-visitas'],
    queryFn: async () => {
      const res = await fetch('/api/visitas/config')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60_000,
  })
  const avisosWAActivos = configVisitas?.enviar_avisos_whatsapp === true

  // BottomSheet de registro
  const [registroAbierto, setRegistroAbierto] = useState(false)
  const [visitaRegistro, setVisitaRegistro] = useState<string>('')
  const [modoRegistro, setModoRegistro] = useState<'llegada' | 'completar' | 'editar'>('llegada')
  const [checklistRegistro, setChecklistRegistro] = useState<{ texto: string; completado: boolean }[]>([])
  const [registroContacto, setRegistroContacto] = useState<{ nombre: string; direccion: string; orden: number } | null>(null)

  // Form inline para agregar parada genérica (logística, café, combustible, etc.)
  const [formParadaAbierto, setFormParadaAbierto] = useState(false)
  const [agregandoParada, setAgregandoParada] = useState(false)

  // BottomSheet para editar la nota libre de una parada genérica
  const [notaParadaAbierta, setNotaParadaAbierta] = useState<{ id: string; titulo: string; notas: string | null } | null>(null)

  // Cargar recorrido del día seleccionado.
  // IMPORTANTE: no volvemos a poner `cargando=true` en refetches.
  // El estado arranca en `true` y se apaga después de la primera carga —
  // los refetches post-acción (cambiar estado, realtime, etc.) no deben
  // remontar el árbol, porque desmontaban el BottomSheet de RegistroVisita
  // y hacían perder el estado (factibilidad, notas, fotos pre-subida).
  const cargarRecorrido = useCallback(async (fecha?: string) => {
    const f = fecha || fechaSeleccionada
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

  // Tracking de la ubicación del usuario — siempre como punto azul, sin
  // rotación de heading (el cono confunde al usuario, queremos un dot estable).
  useEffect(() => {
    if (!navigator.geolocation) {
      if (coordsEmpresa) setUbicacionUsuario(coordsEmpresa)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUbicacionUsuario({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { if (coordsEmpresa) setUbicacionUsuario(coordsEmpresa) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [coordsEmpresa])

  useEffect(() => {
    cargarRecorrido(fechaSeleccionada)
  }, [fechaSeleccionada]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: recargar cuando el coordinador cambia visitas o paradas del recorrido.
  useEffect(() => {
    const supabase = crearClienteNavegador()
    const recargar = () => {
      fetch(`/api/recorrido/hoy?fecha=${fechaSeleccionada}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setRecorrido(data.recorrido)
            setParadas(data.paradas || [])
          }
        })
        .catch(() => {})
    }
    const canal = supabase
      .channel('recorrido-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitas' }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recorrido_paradas' }, recargar)
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [fechaSeleccionada])

  const cambiarFecha = useCallback((nuevaFecha: string) => {
    setFechaSeleccionada(nuevaFecha)
    setParadaSeleccionada(null)
    setModoEdicion(false)
  }, [])

  // Estado efectivo por parada (visita real o parada genérica)
  const estadoDe = useCallback((p: Parada): string =>
    p.tipo === 'parada' ? (p.estado || 'programada') : (p.visita?.estado || 'programada'),
  [])

  // Cálculos derivados — prioriza la parada activa (en_camino/en_sitio) sobre programadas
  const paradaActualIndice = (() => {
    const enCurso = paradas.findIndex(p => {
      const e = estadoDe(p)
      return e === 'en_camino' || e === 'en_sitio'
    })
    if (enCurso >= 0) return enCurso
    return paradas.findIndex(p => {
      const e = estadoDe(p)
      return e !== 'completada' && e !== 'cancelada'
    })
  })()

  const hayVisitaEnSitio = paradas.some(p => estadoDe(p) === 'en_sitio')
  const recorridoIniciado = paradas.some(p => ['en_camino', 'en_sitio', 'completada'].includes(estadoDe(p)))

  // Sincronizar la vista del sheet con la parada activa
  useEffect(() => {
    if (paradaActualIndice >= 0) setParadaVistaIndice(paradaActualIndice)
  }, [paradaActualIndice])

  // Si hay visita en_sitio y el registro no está abierto, auto-abrir.
  // Solo aplica a visitas reales — las paradas genéricas no tienen registro con fotos.
  useEffect(() => {
    if (hayVisitaEnSitio && !registroAbierto && !llegadaAbierta) {
      const paradaEnSitio = paradas.find(p => p.tipo === 'visita' && p.visita?.estado === 'en_sitio')
      if (paradaEnSitio?.visita) {
        manejarRegistrar(paradaEnSitio.visita.id)
      }
    }
  // Solo al cambiar hayVisitaEnSitio, no en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayVisitaEnSitio])
  // Permisos del recorrido. Política: si no hay config explícita, usamos los defaults
  // del sistema (reordenar y cambiar duración: true; agregar/quitar/cancelar: false).
  // Si el campo está seteado en false a propósito, lo respetamos.
  const cfg = recorrido?.config
  const puedeReordenar = cfg?.puede_reordenar !== false
  const puedeAgregarParadas = cfg?.puede_agregar_paradas === true
  const puedeQuitarParadas = cfg?.puede_quitar_paradas === true

  const completadas = paradas.filter(p => estadoDe(p) === 'completada').length
  const duracionEstimada = recorrido?.duracion_total_min || paradas.reduce(
    (sum, p) => sum + (p.duracion_viaje_min || 0) + (p.tipo === 'visita' ? (p.visita?.duracion_estimada_min || 15) : 10),
    0,
  )

  // Paradas REABIERTAS: estaban completadas (tienen fecha_completada) pero ahora
  // están en otro estado (típicamente 'programada'). Pasa cuando el visitador
  // toca "Reabrir" sin querer; le ofrecemos un botón para volver a marcarlas
  // como completadas y deshacer el cambio.
  const paradasReabiertas = paradas.filter(p => {
    const fechaCompl = p.tipo === 'visita' ? p.visita?.fecha_completada : p.fecha_completada
    return !!fechaCompl && estadoDe(p) !== 'completada' && estadoDe(p) !== 'cancelada'
  })

  // Volver a marcar las paradas reabiertas como completadas (deshace la reapertura)
  const cancelarReapertura = useCallback(async () => {
    if (paradasReabiertas.length === 0) return
    try {
      const resultados = await Promise.all(
        paradasReabiertas.map(p =>
          fetch('/api/recorrido/estado', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parada_id: p.id, estado: 'completada' }),
          })
        )
      )
      if (resultados.some(r => !r.ok)) throw new Error()
      mostrar('exito', paradasReabiertas.length === 1
        ? 'Visita marcada como completada de nuevo'
        : `${paradasReabiertas.length} visitas marcadas como completadas`)
      await cargarRecorrido()
    } catch {
      mostrar('error', 'No se pudo cancelar la reapertura')
    }
  }, [paradasReabiertas, mostrar, cargarRecorrido])

  // Horarios estimados — se recalculan en cada render; el resultado es barato
  // (O(n) sobre paradas) y hace falta que se actualice cuando cambian datos o el usuario
  // navega con las flechas. Mapeamos cada parada al shape que espera el helper, pasando
  // lat/lng para fallback Haversine cuando distancia_km/duracion_viaje_min vienen en null.
  const horarios = useMemo(() => {
    const paradasParaHelper: ParadaHorario[] = paradas.map((p): ParadaHorario => {
      if (p.tipo === 'parada') {
        return {
          tipo: 'parada',
          estado: p.estado,
          fecha_inicio: p.fecha_inicio,
          fecha_llegada: p.fecha_llegada,
          fecha_completada: p.fecha_completada,
          distancia_km: p.distancia_km,
          duracion_viaje_min: p.duracion_viaje_min,
          lat: p.direccion_lat,
          lng: p.direccion_lng,
        }
      }
      return {
        tipo: 'visita',
        estado: p.visita?.estado,
        fecha_inicio: p.visita?.fecha_inicio,
        fecha_llegada: p.visita?.fecha_llegada,
        fecha_completada: p.visita?.fecha_completada,
        distancia_km: p.distancia_km,
        duracion_viaje_min: p.duracion_viaje_min,
        duracion_estimada_min: p.visita?.duracion_estimada_min,
        lat: p.visita?.direccion_lat,
        lng: p.visita?.direccion_lng,
      }
    })
    // Punto de partida: ubicación actual del usuario (GPS) o, si falla, las
    // coords de la empresa. Se usa sólo para el tramo origen → primera parada.
    const origenParaTramo = ubicacionUsuario || coordsEmpresa
    return calcularHorariosRecorrido(paradasParaHelper, new Date(), origenParaTramo)
  }, [paradas, ubicacionUsuario, coordsEmpresa])

  // Datos del mapa — visitas + paradas genéricas con coordenadas
  const rutaMapa: RutaMapa = useMemo(() => {
    const puntos: PuntoMapa[] = paradas.flatMap((p): PuntoMapa[] => {
      if (p.tipo === 'parada') {
        if (p.direccion_lat == null || p.direccion_lng == null) return []
        return [{
          id: p.id,
          lat: p.direccion_lat,
          lng: p.direccion_lng,
          titulo: p.titulo || 'Parada',
          subtitulo: p.direccion_texto || undefined,
          estado: (p.estado || 'programada') as EstadoVisita,
        }]
      }
      if (!p.visita?.direccion_lat || !p.visita?.direccion_lng) return []
      return [{
        id: p.visita.id,
        lat: p.visita.direccion_lat,
        lng: p.visita.direccion_lng,
        titulo: p.visita.contacto_nombre,
        subtitulo: p.visita.direccion_texto,
        estado: p.visita.estado,
      }]
    })
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

  // Cambiar estado de parada (visita o genérica) — identifica por parada_id (universal)
  const manejarCambiarEstado = useCallback(async (paradaId: string, nuevoEstado: EstadoVisita) => {
    setParadas(prev => prev.map(p => {
      if (p.id !== paradaId) return p
      if (p.tipo === 'parada') return { ...p, estado: nuevoEstado }
      return p.visita ? { ...p, visita: { ...p.visita, estado: nuevoEstado } } : p
    }))
    setParadaSeleccionada(null)
    try {
      const resp = await fetch('/api/recorrido/estado', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parada_id: paradaId, estado: nuevoEstado }),
      })
      if (!resp.ok) throw new Error()
      await cargarRecorrido()
    } catch {
      mostrar('error', 'Error al cambiar estado')
      cargarRecorrido()
    }
  }, [mostrar, cargarRecorrido])

  // Marcar "en camino": cambia estado + abre modal de aviso (solo tipo visita).
  // Si los avisos por WhatsApp están desactivados en config, NO abrimos el modal —
  // simplemente cambiamos el estado para no estorbar al visitador.
  const iniciarEnCamino = useCallback((paradaId: string) => {
    const parada = paradas.find(p => p.id === paradaId)
    if (!parada) return
    // Para paradas genéricas no hay aviso al contacto — solo cambiar estado
    if (parada.tipo !== 'visita' || !parada.visita) {
      manejarCambiarEstado(paradaId, 'en_camino')
      return
    }
    const v = parada.visita
    manejarCambiarEstado(paradaId, 'en_camino')
    if (!avisosWAActivos) return
    setVisitaAvisoCamino({
      id: v.id,
      nombre: v.recibe_nombre || v.contacto_nombre,
      direccion: v.direccion_texto,
    })
    setAvisoCaminoAbierto(true)
  }, [paradas, manejarCambiarEstado, avisosWAActivos])

  // Marcar llegada (solo visitas): cambia a en_sitio + abre modal con datos de quien recibe
  const manejarLlegada = useCallback((paradaId: string) => {
    const parada = paradas.find(p => p.id === paradaId)
    if (!parada) return
    if (parada.tipo !== 'visita' || !parada.visita) {
      // Paradas genéricas: saltear directamente a completada
      manejarCambiarEstado(paradaId, 'completada')
      return
    }
    const v = parada.visita
    const nombreRecibe = v.recibe_nombre || v.contacto_nombre
    const telefonoRecibe = v.recibe_telefono || v.contacto_telefono || null
    setVisitaLlegada({
      id: v.id,
      nombre: nombreRecibe,
      direccion: v.direccion_texto,
      telefono: telefonoRecibe,
      lat: v.direccion_lat,
      lng: v.direccion_lng,
    })
    manejarCambiarEstado(paradaId, 'en_sitio')
    setLlegadaAbierta(true)
  }, [paradas, manejarCambiarEstado])

  // Abrir BottomSheet de registro (solo tipo visita)
  const manejarRegistrar = useCallback((visitaId: string) => {
    const parada = paradas.find(p => p.tipo === 'visita' && p.visita?.id === visitaId)
    if (!parada || !parada.visita) return
    const v = parada.visita
    setVisitaRegistro(visitaId)
    setModoRegistro(v.estado === 'en_camino' ? 'llegada' : 'completar')
    const ordenParada = paradas.findIndex(p => p.id === parada.id) + 1
    setRegistroContacto({ nombre: v.contacto_nombre, direccion: v.direccion_texto, orden: ordenParada })
    setParadaVistaIndice(ordenParada - 1) // sincroniza el mapa con la parada del registro
    setChecklistRegistro(
      Array.isArray(v.checklist)
        ? (v.checklist as { texto: string; completado: boolean }[])
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

  // Navegación a una parada por índice — lee `paradas[i]` al ejecutar
  // (no del closure de un render anterior) para garantizar que abre Maps
  // con la dirección de la parada que el usuario está viendo en la tarjeta.
  const navegarAParadaPorIndice = useCallback((i: number) => {
    const p = paradas[i]
    if (!p) return
    const esGenerica = p.tipo === 'parada'
    const lat = esGenerica ? p.direccion_lat : p.visita?.direccion_lat
    const lng = esGenerica ? p.direccion_lng : p.visita?.direccion_lng
    if (lat == null || lng == null) return
    abrirRutaCompleta([{ lat, lng }])
  }, [paradas])

  // Reabrir la visita que está abierta en RegistroVisita — cambia estado a
  // 'programada'. Se usa desde el footer del editor (accionPeligro).
  const reabrirVisitaActual = useCallback(() => {
    if (!visitaRegistro) return
    const parada = paradas.find(p => p.tipo === 'visita' && p.visita?.id === visitaRegistro)
    if (parada) manejarCambiarEstado(parada.id, 'programada')
  }, [visitaRegistro, paradas, manejarCambiarEstado])

  // Agregar parada genérica (logística: café, combustible, depósito, etc.)
  const agregarParadaGenerica = useCallback(async (payload: PayloadParadaGenerica) => {
    if (!recorrido) return
    setAgregandoParada(true)
    try {
      const res = await fetch('/api/recorrido/agregar-parada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrido_id: recorrido.id, ...payload }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al agregar parada')
      }
      mostrar('exito', 'Parada agregada')
      setFormParadaAbierto(false)
      await cargarRecorrido()
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'Error al agregar parada')
    } finally {
      setAgregandoParada(false)
    }
  }, [recorrido, mostrar, cargarRecorrido])

  // Eliminar una parada genérica del recorrido (no aplica a visitas — esas van por quitar vía /visitas).
  const manejarQuitarParada = useCallback(async (paradaId: string) => {
    if (!recorrido) return
    // Optimistic
    setParadas(prev => prev.filter(p => p.id !== paradaId).map((p, i) => ({ ...p, orden: i + 1 })))
    try {
      const res = await fetch('/api/recorrido/quitar-parada', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrido_id: recorrido.id, parada_id: paradaId }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Parada eliminada')
    } catch {
      mostrar('error', 'Error al eliminar parada')
      cargarRecorrido()
    }
  }, [recorrido, mostrar, cargarRecorrido])

  // Iniciar ruta: marca primera parada pendiente como en_camino y abre Google Maps.
  // Considera tanto visitas como paradas genéricas con coordenadas.
  const iniciarRuta = useCallback(() => {
    const coordsDe = (p: Parada) => p.tipo === 'parada'
      ? (p.direccion_lat != null && p.direccion_lng != null ? { lat: p.direccion_lat, lng: p.direccion_lng } : null)
      : (p.visita?.direccion_lat != null && p.visita?.direccion_lng != null ? { lat: p.visita.direccion_lat, lng: p.visita.direccion_lng } : null)

    const primera = paradas.find(p => estadoDe(p) === 'programada' && coordsDe(p))
    if (primera) {
      iniciarEnCamino(primera.id)
      const puntos = paradas
        .filter(p => {
          const e = estadoDe(p)
          return coordsDe(p) && e !== 'completada' && e !== 'cancelada'
        })
        .map(p => coordsDe(p)!)

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
  }, [paradas, iniciarEnCamino, destinoFinal, estadoDe])

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

  // Optimizar ruta via Google Directions API.
  // Identifica cada parada por `parada.id` (id universal) para soportar visitas y paradas genéricas.
  const optimizarRuta = useCallback(async () => {
    const coordsDeParada = (p: Parada): { lat: number; lng: number } | null => {
      if (p.tipo === 'parada') {
        if (p.direccion_lat == null || p.direccion_lng == null) return null
        return { lat: p.direccion_lat, lng: p.direccion_lng }
      }
      if (p.visita?.direccion_lat == null || p.visita?.direccion_lng == null) return null
      return { lat: p.visita.direccion_lat, lng: p.visita.direccion_lng }
    }

    const paradasConCoords = paradas
      .map(p => ({ parada: p, coords: coordsDeParada(p) }))
      .filter((x): x is { parada: Parada; coords: { lat: number; lng: number } } => x.coords !== null)

    if (paradasConCoords.length < 2) {
      mostrar('info', 'Se necesitan al menos 2 paradas con coordenadas para optimizar')
      return
    }

    setOptimizando(true)
    setParadasPreOptimizar([...paradas])
    try {
      // Obtener ubicación actual como origen, o usar la primera parada
      let origen = paradasConCoords[0].coords
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        )
        origen = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch {
        // Si no hay geo, usar primera parada como origen
      }

      const resp = await fetch('/api/mapa/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen,
          paradas: paradasConCoords.map(({ parada, coords }) => ({
            id: parada.id,
            lat: coords.lat,
            lng: coords.lng,
          })),
        }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Error al optimizar')
      }

      const data = await resp.json()
      const paradasOptimizadas = data.paradas_ordenadas as { id: string }[]

      const mapaParadas = new Map(paradas.map(p => [p.id, p]))
      const reordenadas = paradasOptimizadas
        .map((po, i) => {
          const original = mapaParadas.get(po.id)
          if (!original) return null
          return { ...original, orden: i + 1 }
        })
        .filter((p): p is Parada => p !== null)

      const idsCon = new Set(paradasConCoords.map(x => x.parada.id))
      const sinCoords = paradas
        .filter(p => !idsCon.has(p.id))
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

  // Calcular estado del recorrido — completado cuando todas son completadas o canceladas
  const canceladasTotal = paradas.filter(p => estadoDe(p) === 'cancelada').length
  const finalizadas = completadas + canceladasTotal
  const estadoRecorrido: EstadoRecorrido = recorrido?.estado as EstadoRecorrido ||
    (finalizadas >= paradas.length && paradas.length > 0 ? 'completado' : completadas > 0 ? 'en_curso' : 'pendiente')

  // Loading
  if (cargando) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-superficie-app">
        <Cargador tamano="pagina" />
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

        <div className="flex-1 bg-superficie-app rounded-t-2xl relative z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] flex flex-col">
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
    const canceladasCount = paradas.filter(p => estadoDe(p) === 'cancelada').length

    // Reactivar: reabre TODAS las paradas completadas (visitas y genéricas) a programada
    const reactivarRecorrido = async () => {
      const paradasCompletadas = paradas.filter(p => estadoDe(p) === 'completada')
      if (paradasCompletadas.length === 0) return
      try {
        const resultados = await Promise.all(
          paradasCompletadas.map(p =>
            fetch('/api/recorrido/estado', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parada_id: p.id, estado: 'programada' }),
            })
          )
        )
        if (resultados.some(r => !r.ok)) throw new Error()
        mostrar('exito', 'Recorrido reabierto — podés editar y volver a completar')
        await cargarRecorrido()
      } catch {
        mostrar('error', 'Error al reactivar el recorrido')
      }
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-superficie-app overflow-hidden">
        {/* Mapa compacto — solo puntos de destino, sin ubicación del usuario */}
        <div className="h-[18dvh] relative shrink-0">
          <ProveedorMapa>
            <MapaRecorrido
              ruta={{ ...rutaMapa, origen: undefined }}
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
        {/* Resumen — ocupa la mayor parte de la pantalla */}
        <div className="flex-1 min-h-0 bg-superficie-app rounded-t-2xl relative z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden -mt-3">
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-9 h-1 rounded-full bg-borde-fuerte/40" />
          </div>
          <ResumenDia
            // Los contadores muestran TODAS las paradas (visitas + genéricas)
            // porque el recorrido completo vale lo mismo para el visitador.
            // ResumenDia distingue internamente el tipo al renderizar tarjetas.
            totalVisitas={paradas.length}
            completadas={completadas}
            canceladas={canceladasCount}
            duracionTotalMin={recorrido.duracion_total_min}
            distanciaTotalKm={recorrido.distancia_total_km}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paradas={paradas as any}
            fechaRecorrido={fechaSeleccionada}
            onEditarVisita={(visitaId) => {
              setVisitaRegistro(visitaId)
              setModoRegistro('editar')
              setChecklistRegistro([])
              setRegistroAbierto(true)
            }}
            onEditarNotaParada={(p) => setNotaParadaAbierta({
              id: p.id,
              titulo: p.titulo || 'Parada',
              notas: p.notas || null,
            })}
            onReactivar={reactivarRecorrido}
          />
        </div>

        {/* BottomSheet de edición — reutiliza RegistroVisita */}
        <RegistroVisita
          abierto={registroAbierto}
          onCerrar={() => setRegistroAbierto(false)}
          visitaId={visitaRegistro}
          modo="editar"
          onExito={() => { setRegistroAbierto(false); cargarRecorrido() }}
          onReabrir={reabrirVisitaActual}
        />
      </div>
    )
  }

  // ── Recorrido activo — layout Spoke ──
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-superficie-app overflow-hidden">
      {/* ── Mapa superior — crece cuando sheet está colapsado ── */}
      <div className={`relative shrink-0 transition-all duration-300 ease-out ${formParadaAbierto ? 'h-[12dvh]' : (modoEdicion && sheetExpandido) ? 'h-[15dvh]' : sheetExpandido ? 'h-[25dvh]' : 'h-[55dvh]'}`}>
        <ProveedorMapa>
          <MapaRecorrido
            ruta={rutaMapa}
            paradaActual={paradaVistaIndice}
            onClickParada={(_punto, indice) => { setParadaSeleccionada(indice); setParadaVistaIndice(indice) }}
            className="!rounded-none !h-full"
            enfocarParada={registroAbierto}
          />
        </ProveedorMapa>

        {/* Header flotante sobre el mapa */}
        <HeaderRecorrido
          fecha={fechaSeleccionada}
          onCambiarFecha={cambiarFecha}
          completadas={completadas}
          total={paradas.length}
        />

        {/* Tarjeta flotante del contacto — arriba del mapa, debajo del header fecha */}
        {registroAbierto && registroContacto && (
          <div className="absolute top-11 left-3 right-3 z-10">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              <div className="flex items-center justify-center size-6 rounded-full bg-[var(--insignia-info)] text-white text-[10px] font-bold shrink-0">
                {registroContacto.orden}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{registroContacto.nombre}</p>
                <p className="text-[10px] text-white/50 truncate">{registroContacto.direccion}</p>
              </div>
              <span className="text-[10px] text-white/40 shrink-0">parada {registroContacto.orden}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Sheet inferior — colapsable estilo app nativa ── */}
      <div className="flex-1 min-h-0 bg-superficie-app rounded-t-2xl relative z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] flex flex-col">
        {/* Drag handle — tocar para expandir/colapsar */}
        <button
          className="flex justify-center py-2.5 shrink-0 w-full"
          onClick={() => {
            // Si colapsamos el sheet estando en modo edición, también salimos
            // de la edición — no tiene sentido seguir "editando" con la lista
            // oculta (deja el mapa chico sin contenido editable visible).
            if (sheetExpandido && modoEdicion) setModoEdicion(false)
            setSheetExpandido(!sheetExpandido)
          }}
        >
          <div className="w-9 h-1 rounded-full bg-borde-fuerte/40" />
        </button>

        {/* Banner de paradas reabiertas — solo cuando se reabrió alguna visita
            ya completada y aún no se volvió a completar. Permite deshacer la
            acción rápido sin que el visitador quede atrapado en un estado raro. */}
        {paradasReabiertas.length > 0 && (
          <div
            className="mx-4 mb-2 mt-1 px-3 py-2.5 rounded-card border-l-2 flex items-start gap-2"
            style={{
              background: 'var(--insignia-advertencia-fondo)',
              borderLeftColor: 'var(--insignia-advertencia)',
            }}
          >
            <RotateCcw size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--insignia-advertencia-texto)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--insignia-advertencia-texto)' }}>
                {paradasReabiertas.length === 1 ? 'Visita reabierta' : `${paradasReabiertas.length} visitas reabiertas`}
              </p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--insignia-advertencia-texto)', opacity: 0.85 }}>
                Si lo hiciste sin querer, podés volver a marcarlas como completadas.
              </p>
            </div>
            <button
              onClick={cancelarReapertura}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-card bg-white/10 hover:bg-white/15 transition-colors"
              style={{ color: 'var(--insignia-advertencia-texto)' }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Barra de progreso + info — siempre visible */}
        {paradas.length > 0 && (
          <div className="px-4 pb-2 shrink-0 space-y-1.5">
            <div className="flex gap-1 items-center h-2">
            {paradas.map((p, i) => {
              const e = estadoDe(p)
              // Paradas antes de la actual, sin completar ni cancelar, son "saltadas" — color apagado.
              const esSaltada = paradaActualIndice >= 0 && i < paradaActualIndice && e !== 'completada' && e !== 'cancelada'
              const enVista = i === paradaVistaIndice
              let color = 'bg-borde-sutil'
              if (e === 'completada') color = 'bg-[var(--insignia-exito)]'
              else if (e === 'cancelada') color = 'bg-[var(--insignia-peligro)]'
              else if (i === paradaActualIndice) color = 'bg-[var(--insignia-info)]'
              else if (esSaltada) color = 'bg-borde-fuerte/60'
              // La parada "en vista" (la que el usuario está viendo en la tarjeta)
              // se destaca con mayor altura — preserva el color de estado y mantiene
              // la barra alineada porque el contenedor usa items-center.
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setParadaVistaIndice(i)}
                  aria-label={`Ir a parada ${i + 1}`}
                  className={`rounded-full flex-1 transition-all duration-300 ${color} ${enVista ? 'h-2 brightness-110' : 'h-1 opacity-80'}`}
                />
              )
            })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={11} className="text-[var(--insignia-exito)]" />
                  <span className="text-[11px] font-semibold text-[var(--insignia-exito)]">{formatearDuracion(duracionEstimada)}</span>
                </div>
                {/* Fin estimado + distancia total — cálculo basado en timestamps reales
                    si el recorrido ya arrancó, o proyección desde "ahora" si está pendiente. */}
                {horarios.horaFin && (
                  <span className="text-[11px] text-texto-terciario truncate">
                    · fin ~{formatearHora(horarios.horaFin)}
                    {horarios.kmTotal > 0 && ` · ${horarios.kmTotal.toFixed(1)} km`}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-texto-terciario shrink-0">{completadas}/{paradas.length} completadas</span>
            </div>
          </div>
        )}

        {!sheetExpandido ? (
          /* ── COLAPSADO: tarjeta + acciones ── */
          <div className="flex-1 flex flex-col min-h-0">
            {paradas.length > 0 && (() => {
              const idx = Math.min(paradaVistaIndice, paradas.length - 1)
              const parada = paradas[idx]
              if (!parada) return null
              const esGenerica = parada.tipo === 'parada'
              const v = parada.visita
              // Datos normalizados (visita o parada genérica)
              const titulo = esGenerica
                ? (parada.titulo || 'Parada')
                : (v?.contacto_nombre || 'Sin contacto')
              const direccionTexto = esGenerica
                ? (parada.direccion_texto || parada.motivo || '')
                : (v?.direccion_texto || '')
              const lat = esGenerica ? parada.direccion_lat : v?.direccion_lat
              const lng = esGenerica ? parada.direccion_lng : v?.direccion_lng
              const estado = (esGenerica ? (parada.estado || 'programada') : (v?.estado || 'programada')) as 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'
              const tieneCoords = lat != null && lng != null
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

              const puedeAnterior = idx > 0
              const puedeSiguiente = idx < paradas.length - 1

              return (
                <>
                  {/* ── 1. Tarjeta de parada — flechas laterales + swipe ── */}
                  <div
                    className="px-2 pt-1 flex items-center gap-1"
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
                    {/* Flecha anterior — navegación explícita entre paradas.
                        size-11 (44px) es el mínimo de touch target recomendado en móvil. */}
                    <button
                      type="button"
                      onClick={() => setParadaVistaIndice(Math.max(0, idx - 1))}
                      disabled={!puedeAnterior}
                      aria-label="Parada anterior"
                      className="shrink-0 size-11 flex items-center justify-center rounded-full text-texto-secundario hover:bg-white/[0.06] active:scale-[0.92] transition-all disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronLeft size={24} />
                    </button>

                    <button
                      className="flex-1 min-w-0 flex items-center gap-3 text-left py-3.5 px-3.5 rounded-modal border border-borde-sutil/50 bg-white/[0.04] active:bg-white/[0.07] transition-colors"
                      onClick={() => setSheetExpandido(true)}
                    >
                      {/* Avatar de estado — size-12 (48px) queda bien en móvil, íconos legibles */}
                      <div className="flex items-center justify-center size-12 rounded-full border-2 shrink-0 text-base font-bold"
                        style={{
                          borderColor: colorEstado,
                          backgroundColor: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? colorEstado : 'transparent',
                          color: ['completada', 'en_camino', 'en_sitio', 'cancelada'].includes(estado) ? 'white' : 'var(--texto-terciario)',
                        }}
                      >
                        {estado === 'completada' ? <Check size={18} strokeWidth={2.5} /> : estado === 'cancelada' ? <X size={18} strokeWidth={2.5} /> : esGenerica ? <Coffee size={18} /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className={`text-[15px] font-semibold text-texto-primario truncate ${estado === 'cancelada' ? 'line-through opacity-50' : ''}`}>
                            {titulo}
                          </div>
                          {esGenerica && (
                            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] text-texto-secundario">
                              parada
                            </span>
                          )}
                        </div>
                        {/* Dirección: contraste mejor (secundario vs terciario) y hasta 2 líneas para no truncar info útil */}
                        <div className="text-[13px] text-texto-secundario line-clamp-2 leading-snug mt-1">{direccionTexto}</div>
                        {/* Llegada estimada + duración dentro de la parada.
                            Solo se muestra si la parada NO está completada/cancelada —
                            ahí ya no aporta (son datos del pasado). */}
                        {horarios.porParada[idx]?.llegada && estado !== 'completada' && estado !== 'cancelada' && (
                          <div className="text-[11px] text-texto-terciario mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={10} />
                              {horarios.porParada[idx].esReal ? '' : '~'}
                              {formatearHora(horarios.porParada[idx].llegada)}
                            </span>
                            {!esGenerica && v?.duracion_estimada_min && (
                              <span>· {v.duracion_estimada_min} min en sitio</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {/* Posición en el recorrido — texto distinto al "X/Y completadas" de arriba para no confundir */}
                        <span className="text-[11px] font-medium text-texto-secundario whitespace-nowrap">
                          {idx + 1} <span className="text-texto-terciario font-normal">de {paradas.length}</span>
                        </span>
                        {estado !== 'programada' && (
                          <span className="text-xs font-medium whitespace-nowrap" style={{ color: colorEstado }}>
                            {estado === 'en_camino' ? 'En camino' : estado === 'en_sitio' ? 'En sitio' : estado === 'completada' ? 'Completada' : estado === 'cancelada' ? 'Cancelada' : ''}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Flecha siguiente */}
                    <button
                      type="button"
                      onClick={() => setParadaVistaIndice(Math.min(paradas.length - 1, idx + 1))}
                      disabled={!puedeSiguiente}
                      aria-label="Parada siguiente"
                      className="shrink-0 size-11 flex items-center justify-center rounded-full text-texto-secundario hover:bg-white/[0.06] active:scale-[0.92] transition-all disabled:opacity-20 disabled:pointer-events-none"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  {/* ── 2. Acciones — debajo de la tarjeta ── */}
                  <div className="px-4 py-3 mt-auto">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Columna 1: Navegar (siempre) */}
                      <button
                        onClick={() => navegarAParadaPorIndice(paradaVistaIndice)}
                        disabled={!tieneCoords || estado === 'completada'}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors disabled:opacity-25"
                      >
                        <Navigation size={16} className="text-[var(--insignia-info)]" />
                        <span className="text-[10px] font-medium text-texto-secundario">Navegar</span>
                      </button>

                      {/* Columna 2: acción negativa / secundaria */}
                      {estado === 'cancelada' ? (
                        <button
                          onClick={() => manejarCambiarEstado(parada.id, 'programada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <RotateCcw size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">Reactivar</span>
                        </button>
                      ) : estado === 'completada' ? (
                        !esGenerica && v ? (
                          <button
                            onClick={() => manejarEditar(v.id)}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                          >
                            <Pencil size={16} className="text-texto-terciario" />
                            <span className="text-[10px] font-medium text-texto-secundario">Editar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => manejarCambiarEstado(parada.id, 'programada')}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                          >
                            <RotateCcw size={16} className="text-texto-terciario" />
                            <span className="text-[10px] font-medium text-texto-secundario">Reabrir</span>
                          </button>
                        )
                      ) : estado === 'en_sitio' && !esGenerica && v ? (
                        <button
                          onClick={() => {
                            setVisitaLlegada({
                              id: v.id,
                              nombre: v.recibe_nombre || v.contacto_nombre,
                              direccion: v.direccion_texto,
                              telefono: v.recibe_telefono || v.contacto_telefono || null,
                              lat: v.direccion_lat,
                              lng: v.direccion_lng,
                            })
                            setLlegadaAbierta(true)
                          }}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <Phone size={16} className="text-[var(--insignia-info)]" />
                          <span className="text-[10px] font-medium text-texto-secundario">Contactar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => manejarCambiarEstado(parada.id, 'cancelada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <X size={16} className="text-[var(--insignia-peligro)]" />
                          <span className="text-[10px] font-medium text-texto-secundario">{t('comun.cancelar')}</span>
                        </button>
                      )}

                      {/* Columna 3: acción principal */}
                      {estado === 'programada' ? (
                        <button
                          onClick={() => iniciarEnCamino(parada.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-[var(--insignia-info)]/30 bg-[var(--insignia-info)]/10 hover:bg-[var(--insignia-info)]/20 transition-colors"
                        >
                          <Route size={16} className="text-[var(--insignia-info)]" />
                          <span className="text-[10px] font-medium text-[var(--insignia-info)]">En camino</span>
                        </button>
                      ) : estado === 'en_camino' ? (
                        esGenerica ? (
                          <button
                            onClick={() => manejarCambiarEstado(parada.id, 'completada')}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-colors"
                          >
                            <Check size={16} className="text-[var(--insignia-exito)]" />
                            <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Completada</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => manejarLlegada(parada.id)}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-colors"
                          >
                            <MapPin size={16} className="text-[var(--insignia-exito)]" />
                            <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Llegué</span>
                          </button>
                        )
                      ) : estado === 'en_sitio' && !esGenerica && v ? (
                        <button
                          onClick={() => manejarRegistrar(v.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-[var(--insignia-exito)]/30 bg-[var(--insignia-exito)]/10 hover:bg-[var(--insignia-exito)]/20 transition-colors"
                        >
                          <Pencil size={16} className="text-[var(--insignia-exito)]" />
                          <span className="text-[10px] font-medium text-[var(--insignia-exito)]">Registrar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => manejarCambiarEstado(parada.id, 'programada')}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-card border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                        >
                          <RotateCcw size={16} className="text-texto-terciario" />
                          <span className="text-[10px] font-medium text-texto-secundario">{estado === 'completada' ? 'Reabrir' : 'Reactivar'}</span>
                        </button>
                      )}
                    </div>

                    {/* Nota libre para paradas genéricas — siempre disponible, opcional.
                        No se guarda en chatter, sólo queda en la parada para que el
                        visitador pueda recordarla al revisar el recorrido. */}
                    {esGenerica && (
                      <button
                        onClick={() => setNotaParadaAbierta({
                          id: parada.id,
                          titulo: parada.titulo || 'Parada',
                          notas: parada.notas || null,
                        })}
                        className="w-full mt-2 flex items-start gap-2 px-3 py-2 rounded-card border border-dashed border-borde-sutil hover:bg-white/[0.03] transition-colors text-left"
                      >
                        <Pencil size={12} className="text-texto-terciario shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {parada.notas ? (
                            <p className="text-[12px] text-texto-secundario leading-snug line-clamp-2">{parada.notas}</p>
                          ) : (
                            <p className="text-[11px] text-texto-terciario">Agregar nota (opcional)</p>
                          )}
                        </div>
                      </button>
                    )}

                    {/* 3. Indicadores + botón ver recorrido */}
                    <div className="flex flex-col items-center gap-2.5 pt-3">
                      <div className="flex gap-1.5">
                        {paradas.map((p, i) => {
                          const e = estadoDe(p)
                          return (
                            <button
                              key={p.id}
                              onClick={() => setParadaVistaIndice(i)}
                              className={`rounded-full transition-all ${i === idx ? 'w-5 h-2' : 'size-2'}`}
                              style={{
                                backgroundColor: i === idx ? colorEstado
                                  : e === 'completada' ? 'var(--insignia-exito)'
                                  : e === 'cancelada' ? 'var(--insignia-peligro)'
                                  : 'var(--borde-sutil)',
                              }}
                            />
                          )
                        })}
                      </div>
                      <button
                        onClick={() => { setSheetExpandido(true); if (!recorridoIniciado) setModoEdicion(true) }}
                        className="text-[11px] font-medium tracking-wider uppercase text-texto-terciario hover:text-texto-secundario px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] transition-colors"
                      >
                        {recorridoIniciado ? 'Ver recorrido' : 'Ajustar recorrido'}
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          /* ── EXPANDIDO: lista completa de paradas ── */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pb-2 shrink-0 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-texto-primario">
                {t('recorrido.recorrido_del_dia')}
              </h2>
              {puedeAgregarParadas && !formParadaAbierto && (
                <button
                  onClick={() => { setFormParadaAbierto(true); setSheetExpandido(true) }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-texto-secundario border border-borde-sutil hover:bg-superficie-elevada transition-colors"
                  title="Agregar parada (no cuenta como visita)"
                >
                  <Plus size={12} />
                  <span>Parada</span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              {formParadaAbierto && (
                <div className="px-4 pb-3">
                  <div className="rounded-card border border-white/[0.06] bg-white/[0.02] p-3">
                    <FormParadaRecorrido
                      onGuardar={agregarParadaGenerica}
                      onCancelar={() => setFormParadaAbierto(false)}
                      guardando={agregandoParada}
                    />
                  </div>
                </div>
              )}
              <ListaParadas
                paradas={paradas}
                paradaActualIndice={paradaActualIndice}
                paradaSeleccionada={paradaSeleccionada}
                onSeleccionarParada={setParadaSeleccionada}
                onReordenar={manejarReordenar}
                onCambiarEstado={(paradaId, estado) => {
                  if (estado === 'en_camino') iniciarEnCamino(paradaId)
                  else manejarCambiarEstado(paradaId, estado)
                }}
                onRegistrar={manejarRegistrar}
                onEditar={manejarEditar}
                onQuitarParada={puedeQuitarParadas ? manejarQuitarParada : undefined}
                modoEdicion={modoEdicion}
                destinoFinal={destinoFinal}
                onCambiarDestino={modoEdicion ? setDestinoFinal : undefined}
                horarios={horarios}
              />
            </div>
          </div>
        )}

        {/* ── Bottom bar — solo visible en expandido ── */}
        {sheetExpandido && (
        <div
          className="border-t border-borde-sutil shrink-0 bg-superficie-app pb-4"
        >
          {modoEdicion ? (
            /* ── Expandido + edición: herramientas + iniciar ── */
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={invertirRuta}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-card text-sm font-medium border border-borde-sutil text-texto-secundario hover:bg-superficie-elevada transition-colors"
                >
                  <ArrowUpDown size={14} />
                  <span>{t('visitas.invertir')}</span>
                </button>
                <button
                  onClick={optimizarRuta}
                  disabled={optimizando}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-card text-sm font-medium border border-borde-sutil text-texto-secundario hover:bg-superficie-elevada transition-colors disabled:opacity-50"
                >
                  {optimizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{t('visitas.optimizar')}</span>
                </button>
                {paradasPreOptimizar && (
                  <button
                    onClick={revertirOptimizacion}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-card text-sm font-medium border border-insignia-advertencia/40 text-insignia-advertencia hover:bg-insignia-advertencia/10 transition-colors"
                  >
                    <Undo2 size={14} />
                    <span>{t('visitas.revertir')}</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setModoEdicion(false); setSheetExpandido(false) }}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-card text-sm font-semibold text-white bg-insignia-info transition-colors"
              >
                <span>{t('visitas.confirmar_ruta')}</span>
              </button>
            </div>
          ) : (
            /* ── Expandido + vista: pills sutiles ── */
            <div className="flex items-center justify-center gap-3 py-3">
              {puedeReordenar && (
              <button
                onClick={() => setModoEdicion(true)}
                className="text-[11px] font-medium text-texto-terciario hover:text-texto-secundario px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] transition-colors"
              >
                Ajustar
              </button>
              )}
              <button
                onClick={iniciarRuta}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--insignia-info)] px-3.5 py-2 rounded-full bg-[var(--insignia-info)]/[0.08] border border-[var(--insignia-info)]/[0.15] hover:bg-[var(--insignia-info)]/[0.15] transition-colors"
              >
                <Navigation size={11} />
                <span>{t('recorrido.iniciar_recorrido')}</span>
              </button>
              <button
                onClick={() => setSheetExpandido(false)}
                className="text-[11px] font-medium text-texto-terciario hover:text-texto-secundario px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* BottomSheet de registro */}
      <RegistroVisita
        abierto={registroAbierto}
        onCerrar={() => setRegistroAbierto(false)}
        visitaId={visitaRegistro}
        modo={modoRegistro}
        checklist={checklistRegistro}
        onExito={manejarRegistroExitoso}
        contactoNombre={registroContacto?.nombre}
        contactoDireccion={registroContacto?.direccion}
        onReabrir={reabrirVisitaActual}
      />

      {/* Modal de aviso "En camino" — opcional, se abre al marcar una parada como en_camino */}
      <ModalAvisoEnCamino
        abierto={avisoCaminoAbierto}
        onCerrar={() => setAvisoCaminoAbierto(false)}
        onEnviado={() => mostrar('exito', `Aviso enviado a ${visitaAvisoCamino?.nombre}`)}
        visitaId={visitaAvisoCamino?.id || ''}
        contactoNombre={visitaAvisoCamino?.nombre || ''}
        direccionTexto={visitaAvisoCamino?.direccion || ''}
        ubicacionActual={ubicacionUsuario}
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
        mostrarAvisarLlegada={avisosWAActivos}
        onAvisarLlegada={() => {
          // Cierra el modal de llegada y abre el de envío de WhatsApp con preview.
          // Mantiene el flujo existente (Llegué → confirmar envío) pero ahora hace
          // un envío real vía /api/recorrido/aviso-llegada.
          if (visitaLlegada) {
            setVisitaAvisoLlegada({
              id: visitaLlegada.id,
              nombre: visitaLlegada.nombre,
              direccion: visitaLlegada.direccion,
            })
            setAvisoLlegadaAbierto(true)
          }
        }}
      />

      {/* Modal de aviso de llegada — se abre al tocar "Avisar que llegué" desde ModalLlegada */}
      <ModalAvisoLlegada
        abierto={avisoLlegadaAbierto}
        onCerrar={() => setAvisoLlegadaAbierto(false)}
        onEnviado={() => mostrar('exito', `Aviso enviado a ${visitaAvisoLlegada?.nombre}`)}
        visitaId={visitaAvisoLlegada?.id || ''}
        contactoNombre={visitaAvisoLlegada?.nombre || ''}
        direccionTexto={visitaAvisoLlegada?.direccion || ''}
      />

      {/* BottomSheet para editar la nota libre de una parada genérica.
          Actualiza el estado local sin recargar todo el recorrido (solo parcha
          la parada afectada). */}
      <RegistroParada
        abierto={!!notaParadaAbierta}
        onCerrar={() => setNotaParadaAbierta(null)}
        paradaId={notaParadaAbierta?.id || ''}
        tituloParada={notaParadaAbierta?.titulo || ''}
        notasIniciales={notaParadaAbierta?.notas || null}
        onGuardado={(nuevasNotas) => {
          if (!notaParadaAbierta) return
          setParadas(prev => prev.map(p => p.id === notaParadaAbierta.id ? { ...p, notas: nuevasNotas } : p))
        }}
      />
    </div>
  )
}
