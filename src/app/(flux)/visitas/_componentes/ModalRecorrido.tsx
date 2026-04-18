'use client'

/**
 * ModalRecorrido — Modal desktop para organizar el recorrido de un visitador en una fecha.
 * Layout horizontal: mapa a la izquierda + lista sortable a la derecha.
 * Funcionalidades: reordenar paradas (drag & drop), optimizar ruta, invertir ruta,
 * ver distancia/duración total, configurar permisos.
 * Se usa en: PanelPlanificacion, al hacer click en un grupo de fecha de un visitador.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, Sparkles, ArrowUpDown,
  Clock, Loader2, X, RotateCcw, Send, EyeOff, AlertTriangle, Bell,
} from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { ProveedorMapa, MapaRecorrido } from '@/componentes/mapa'
import type { PuntoMapa, RutaMapa } from '@/componentes/mapa'
import { useEmpresa } from '@/hooks/useEmpresa'
import ConfigRecorrido, { type ConfigPermisos } from './ConfigRecorrido'
import { ItemParadaSortable, type Parada, type VisitaParada } from './ItemParadaSortable'

export type { Parada, VisitaParada }

// ── Tipos ──

interface DatosRecorrido {
  id: string
  estado: string
  total_visitas: number
  visitas_completadas: number
  config: (ConfigPermisos & { destino?: { lat: number; lng: number; texto: string } | null }) | null
  origen_lat: number | null
  origen_lng: number | null
  origen_texto: string | null
}

interface PropiedadesModalRecorrido {
  abierto: boolean
  onCerrar: () => void
  usuarioId: string
  nombreVisitador: string
  fecha: string
  onActualizar: () => void
}

// ── Modal principal ──

export default function ModalRecorrido({
  abierto,
  onCerrar,
  usuarioId,
  nombreVisitador,
  fecha,
  onActualizar,
}: PropiedadesModalRecorrido) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { empresa } = useEmpresa()

  const [cargando, setCargando] = useState(true)
  const [recorrido, setRecorrido] = useState<DatosRecorrido | null>(null)
  const [paradas, setParadas] = useState<Parada[]>([])
  const [optimizando, setOptimizando] = useState(false)
  const [paradasPreOptimizar, setParadasPreOptimizar] = useState<Parada[] | null>(null)
  const [infoRuta, setInfoRuta] = useState<{ distancia_km: number; duracion_min: number } | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [confirmarEdicionEnCurso, setConfirmarEdicionEnCurso] = useState(false)
  const [edicionConfirmada, setEdicionConfirmada] = useState(false)

  // Origen y destino del recorrido — por default salen y vuelven a la empresa
  const [origenEmpresa, setOrigenEmpresa] = useState(true)
  const [destinoEmpresa, setDestinoEmpresa] = useState(true)

  // Dirección de la empresa
  const coordsEmpresa = useMemo(() => {
    const dir = empresa?.direccion as { coordenadas?: { lat: number; lng: number }; textoCompleto?: string } | null
    if (dir?.coordenadas?.lat && dir?.coordenadas?.lng) {
      return { lat: dir.coordenadas.lat, lng: dir.coordenadas.lng, texto: dir.textoCompleto || empresa?.nombre || 'Empresa' }
    }
    return null
  }, [empresa?.direccion, empresa?.nombre])

  // Derivados de estado
  const esBorrador = recorrido?.estado === 'borrador'
  const esEnCurso = recorrido?.estado === 'en_curso' || paradas.some(p => ['en_camino', 'en_sitio'].includes(p.visita?.estado || ''))

  // Sensores para drag & drop
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Fecha formateada para el título
  const fechaFormateada = useMemo(() => {
    const d = new Date(fecha + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^\w/, c => c.toUpperCase())
  }, [fecha])

  // Cargar recorrido al abrir
  const cargarRecorrido = useCallback(async () => {
    setCargando(true)
    try {
      const resp = await fetch(`/api/recorrido/por-visitador?usuario_id=${usuarioId}&fecha=${fecha}`)
      if (!resp.ok) throw new Error('Error al cargar recorrido')
      const data = await resp.json()
      setRecorrido(data.recorrido)
      setParadas(data.paradas || [])
    } catch {
      mostrar('error', 'No se pudo cargar el recorrido')
    } finally {
      setCargando(false)
    }
  }, [usuarioId, fecha, mostrar])

  useEffect(() => {
    if (abierto) {
      cargarRecorrido()
      setParadasPreOptimizar(null)
      setInfoRuta(null)
      setEdicionConfirmada(false)
    }
  }, [abierto, cargarRecorrido])

  // Mostrar confirmación si el recorrido está en curso
  useEffect(() => {
    if (recorrido && !cargando && esEnCurso && !edicionConfirmada) {
      setConfirmarEdicionEnCurso(true)
    }
  }, [recorrido, cargando, esEnCurso, edicionConfirmada])

  // Sincronizar switches de origen/destino con datos del recorrido.
  // Si el recorrido ya tiene datos guardados, usarlos.
  // Si es nuevo (sin origen guardado), guardar la empresa como default.
  useEffect(() => {
    if (!recorrido) return
    const tieneOrigenGuardado = recorrido.origen_lat != null
    const tieneDestinoGuardado = recorrido.config?.destino?.lat != null

    if (tieneOrigenGuardado || tieneDestinoGuardado) {
      // Recorrido con datos previos — sincronizar switches
      setOrigenEmpresa(tieneOrigenGuardado)
      setDestinoEmpresa(tieneDestinoGuardado)
    } else if (coordsEmpresa) {
      // Recorrido nuevo sin datos — guardar empresa como default
      setOrigenEmpresa(true)
      setDestinoEmpresa(true)
      fetch('/api/recorrido/origen-destino', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido.id,
          origen: coordsEmpresa,
          destino: coordsEmpresa,
        }),
      }).catch(() => { /* silencioso */ })
    }
  // Solo al cambiar recorrido.id, no en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorrido?.id])

  // Datos del mapa
  const rutaMapa: RutaMapa = useMemo(() => {
    const puntos: PuntoMapa[] = paradas
      .filter(p => p.visita?.direccion_lat && p.visita?.direccion_lng)
      .map(p => ({
        id: p.visita.id,
        lat: p.visita.direccion_lat!,
        lng: p.visita.direccion_lng!,
        titulo: p.visita.contacto_nombre || 'Sin contacto',
        subtitulo: p.visita.direccion_texto || undefined,
        estado: p.visita.estado as PuntoMapa['estado'],
      }))
    // Origen: empresa si está activo, si no la primera parada
    const origen = origenEmpresa && coordsEmpresa
      ? { lat: coordsEmpresa.lat, lng: coordsEmpresa.lng, texto: coordsEmpresa.texto }
      : puntos.length > 0 ? { lat: puntos[0].lat, lng: puntos[0].lng, texto: 'Inicio' } : undefined

    // Destino: empresa si está activo
    const destino = destinoEmpresa && coordsEmpresa
      ? { lat: coordsEmpresa.lat, lng: coordsEmpresa.lng, texto: coordsEmpresa.texto }
      : undefined

    return { puntos, origen, destino }
  }, [paradas, origenEmpresa, destinoEmpresa, coordsEmpresa])

  // Reordenar paradas (drag & drop)
  const manejarDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = paradas.findIndex(p => p.id === active.id)
    const newIndex = paradas.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordenadas = arrayMove(paradas, oldIndex, newIndex).map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(reordenadas)

    if (recorrido) {
      try {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: recorrido.id,
            paradas: reordenadas.map(p => ({ id: p.id, orden: p.orden })),
          }),
        })
      } catch {
        mostrar('error', 'Error al reordenar')
        cargarRecorrido()
      }
    }
  }, [paradas, recorrido, mostrar, cargarRecorrido])

  // Optimizar ruta
  const optimizarRuta = useCallback(async () => {
    const paradasConCoords = paradas.filter(
      p => p.visita?.direccion_lat != null && p.visita?.direccion_lng != null
    )
    if (paradasConCoords.length < 2) {
      mostrar('info', 'Se necesitan al menos 2 paradas con coordenadas')
      return
    }

    setOptimizando(true)
    setParadasPreOptimizar([...paradas])

    try {
      const origen = { lat: paradasConCoords[0].visita.direccion_lat!, lng: paradasConCoords[0].visita.direccion_lng! }
      const resp = await fetch('/api/mapa/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen,
          paradas: paradasConCoords.map(p => ({ id: p.visita.id, lat: p.visita.direccion_lat!, lng: p.visita.direccion_lng! })),
        }),
      })

      if (!resp.ok) throw new Error('Error al optimizar')
      const data = await resp.json()
      const idsOrdenados = (data.paradas_ordenadas as { id: string }[]).map(po => po.id)

      // Reordenar: primero las optimizadas, luego las sin coordenadas
      const mapaParadas = new Map(paradas.map(p => [p.visita.id, p]))
      const reordenadas = idsOrdenados
        .map((id, i) => {
          const original = mapaParadas.get(id)
          if (!original) return null
          return { ...original, orden: i + 1 }
        })
        .filter((p): p is Parada => p !== null)

      const sinCoords = paradas
        .filter(p => !p.visita.direccion_lat || !p.visita.direccion_lng)
        .map((p, i) => ({ ...p, orden: reordenadas.length + i + 1 }))

      const todasReordenadas = [...reordenadas, ...sinCoords]
      setParadas(todasReordenadas)

      // Persistir
      if (recorrido) {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: recorrido.id,
            paradas: todasReordenadas.map(p => ({ id: p.id, orden: p.orden })),
          }),
        })
      }

      mostrar('exito', `Ruta optimizada · ${data.distancia_total_km} km · ${data.duracion_total_min} min`)
    } catch {
      mostrar('error', 'No se pudo optimizar la ruta')
      cargarRecorrido()
    } finally {
      setOptimizando(false)
    }
  }, [paradas, recorrido, mostrar, cargarRecorrido])

  // Invertir ruta
  const invertirRuta = useCallback(async () => {
    const invertidas = [...paradas].reverse().map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(invertidas)
    if (recorrido) {
      try {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: recorrido.id,
            paradas: invertidas.map(p => ({ id: p.id, orden: p.orden })),
          }),
        })
        mostrar('exito', 'Ruta invertida')
      } catch {
        mostrar('error', 'Error al invertir')
        cargarRecorrido()
      }
    }
  }, [paradas, recorrido, mostrar, cargarRecorrido])

  // Revertir optimización
  const revertirOptimizacion = useCallback(async () => {
    if (!paradasPreOptimizar) return
    const restauradas = paradasPreOptimizar.map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(restauradas)
    setParadasPreOptimizar(null)
    if (recorrido) {
      try {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: recorrido.id,
            paradas: restauradas.map(p => ({ id: p.id, orden: p.orden })),
          }),
        })
        mostrar('info', 'Orden revertido')
      } catch {
        mostrar('error', 'Error al revertir')
        cargarRecorrido()
      }
    }
  }, [paradasPreOptimizar, recorrido, mostrar, cargarRecorrido])

  // Guardar config permisos
  const guardarConfig = useCallback(async (config: ConfigPermisos) => {
    if (!recorrido) return
    try {
      const res = await fetch('/api/recorrido/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrido_id: recorrido.id, config }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Permisos actualizados')
    } catch {
      mostrar('error', 'Error al guardar permisos')
    }
  }, [recorrido, mostrar])

  // Cambiar origen/destino
  const toggleOrigen = useCallback(async (activo: boolean) => {
    if (!recorrido || !coordsEmpresa) return
    setOrigenEmpresa(activo)
    try {
      await fetch('/api/recorrido/origen-destino', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido.id,
          origen: activo ? coordsEmpresa : null,
        }),
      })
    } catch {
      setOrigenEmpresa(!activo)
      mostrar('error', 'Error al guardar origen')
    }
  }, [recorrido, coordsEmpresa, mostrar])

  const toggleDestino = useCallback(async (activo: boolean) => {
    if (!recorrido || !coordsEmpresa) return
    setDestinoEmpresa(activo)
    try {
      await fetch('/api/recorrido/origen-destino', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido.id,
          destino: activo ? coordsEmpresa : null,
        }),
      })
    } catch {
      setDestinoEmpresa(!activo)
      mostrar('error', 'Error al guardar destino')
    }
  }, [recorrido, coordsEmpresa, mostrar])

  // Quitar parada del recorrido
  const quitarParada = useCallback(async (paradaId: string) => {
    if (!recorrido) return
    // Optimistic: quitar de la lista
    setParadas(prev => prev.filter(p => p.id !== paradaId).map((p, i) => ({ ...p, orden: i + 1 })))
    try {
      const resp = await fetch('/api/recorrido/quitar-parada', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrido_id: recorrido.id, parada_id: paradaId }),
      })
      if (!resp.ok) throw new Error()
      mostrar('exito', 'Parada quitada del recorrido')
    } catch {
      mostrar('error', 'Error al quitar parada')
      cargarRecorrido()
    }
  }, [recorrido, mostrar, cargarRecorrido])

  // Publicar / despublicar recorrido
  const togglePublicar = useCallback(async () => {
    if (!recorrido) return
    setPublicando(true)
    try {
      const resp = await fetch('/api/recorrido/publicar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrido_id: recorrido.id, publicar: esBorrador }),
      })
      if (!resp.ok) throw new Error()
      const data = await resp.json()
      setRecorrido(prev => prev ? { ...prev, estado: data.estado } : prev)
      mostrar('exito', esBorrador ? 'Recorrido publicado — el visitador ya puede verlo' : 'Recorrido despublicado')
    } catch {
      mostrar('error', 'Error al cambiar estado')
    } finally {
      setPublicando(false)
    }
  }, [recorrido, esBorrador, mostrar])

  // Notificar cambios al visitador (para recorridos en curso)
  const notificarCambios = useCallback(async () => {
    if (!recorrido) return
    setPublicando(true)
    try {
      // Reordenar fuerza la notificación al visitador via el endpoint
      await fetch('/api/recorrido/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorrido_id: recorrido.id,
          paradas: paradas.map((p, i) => ({ id: p.id, orden: i + 1 })),
        }),
      })
      mostrar('exito', `Se notificó a ${nombreVisitador} de los cambios`)
    } catch {
      mostrar('error', 'Error al notificar')
    } finally {
      setPublicando(false)
    }
  }, [recorrido, paradas, nombreVisitador, mostrar])

  // Cerrar y notificar
  const manejarCerrar = useCallback(() => {
    onCerrar()
    onActualizar()
  }, [onCerrar, onActualizar])

  // Estadísticas
  const totalParadas = paradas.length
  const completadas = paradas.filter(p => p.visita?.estado === 'completada').length
  const duracionEstimada = paradas.reduce((sum, p) => sum + (p.visita?.duracion_estimada_min || 0), 0)
  const idsParadas = useMemo(() => paradas.map(p => p.id), [paradas])

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={manejarCerrar}
      tamano="5xl"
      sinPadding
      forzarModal
      titulo={`${nombreVisitador} · ${fechaFormateada}`}
      acciones={
        recorrido && paradas.length > 0 ? (
          <div className="flex items-center justify-between w-full">
            {/* Indicador de estado a la izquierda */}
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
              esBorrador ? 'bg-insignia-advertencia/15 text-insignia-advertencia'
              : esEnCurso ? 'bg-insignia-info/15 text-insignia-info'
              : 'bg-insignia-exito/15 text-insignia-exito'
            }`}>
              {esBorrador ? t('visitas.borrador_desc')
              : esEnCurso ? t('visitas.en_curso_desc')
              : t('visitas.publicado_desc')}
            </span>

            <div className="flex items-center gap-2">
              <Boton variante="fantasma" tamano="sm" onClick={manejarCerrar}>
                {t('visitas.cerrar')}
              </Boton>

              {/* Borrador → Publicar */}
              {esBorrador && (
                <Boton
                  variante="primario"
                  tamano="sm"
                  icono={publicando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  onClick={togglePublicar}
                  disabled={publicando}
                >
                  {t('visitas.publicar_recorrido')}
                </Boton>
              )}

              {/* Pendiente → Despublicar */}
              {!esBorrador && !esEnCurso && (
                <Boton
                  variante="secundario"
                  tamano="sm"
                  icono={publicando ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                  onClick={togglePublicar}
                  disabled={publicando}
                >
                  {t('visitas.despublicar')}
                </Boton>
              )}

              {/* En curso → Notificar cambios */}
              {esEnCurso && (
                <Boton
                  variante="primario"
                  tamano="sm"
                  icono={publicando ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  onClick={notificarCambios}
                  disabled={publicando}
                >
                  {t('visitas.notificar_cambios')}
                </Boton>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Contenedor con altura fija para evitar saltos al cargar */}
      <div className="h-[calc(90dvh-130px)] min-h-[450px]">
      {cargando ? (
        <div className="flex items-center justify-center h-full">
          <div className="size-6 animate-spin rounded-full border-2 border-texto-marca border-t-transparent" />
        </div>
      ) : paradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Route size={48} strokeWidth={1} className="text-texto-terciario/40 mb-3" />
          <p className="text-sm text-texto-terciario">{t('visitas.sin_visitas_programadas')}</p>
        </div>
      ) : (
        <ProveedorMapa>
          {/* Banner si el recorrido está en curso */}
          {esEnCurso && (
            <div className="flex items-center gap-2 px-4 py-2 bg-insignia-advertencia/10 border-b border-insignia-advertencia/20">
              <AlertTriangle size={14} className="shrink-0 text-insignia-advertencia" />
              <span className="text-[12px] text-insignia-advertencia">
                Este recorrido está en curso — {nombreVisitador} ya lo está realizando. Los cambios le llegarán como notificación.
              </span>
            </div>
          )}
          <div className="flex flex-col md:flex-row h-full">
            {/* ── Panel izquierdo: Mapa ── */}
            <div className="flex-1 min-w-0 relative">
              <MapaRecorrido
                ruta={rutaMapa}
                className="!rounded-none !h-full"
                onInfoRuta={setInfoRuta}
              />

              {/* Overlay con estadísticas */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                <div className="flex items-center gap-3 rounded-card bg-superficie-elevada/90 backdrop-blur-md border border-white/[0.08] px-3.5 py-2 text-[12px]">
                  <span className="flex items-center gap-1.5 text-texto-primario font-medium">
                    <Route size={12} className="text-texto-marca" />
                    {totalParadas} paradas
                  </span>
                  {completadas > 0 && (
                    <span className="text-insignia-exito">
                      {completadas} completadas
                    </span>
                  )}
                  {(infoRuta?.distancia_km || 0) > 0 && (
                    <span className="text-texto-terciario">
                      {infoRuta!.distancia_km.toFixed(1)} km
                    </span>
                  )}
                  {(infoRuta?.duracion_min || 0) > 0 && (
                    <span className="flex items-center gap-1 text-texto-terciario">
                      <Clock size={10} />
                      {Math.floor(infoRuta!.duracion_min / 60)}h {Math.round(infoRuta!.duracion_min % 60)}m
                    </span>
                  )}
                  {duracionEstimada > 0 && (
                    <span className="text-texto-terciario">
                      · ~{Math.floor(duracionEstimada / 60)}h {duracionEstimada % 60}m en sitio
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Divisor vertical ── */}
            <div className="hidden md:block w-px bg-white/[0.07]" />

            {/* ── Panel derecho: Lista de paradas ── */}
            <div className="w-full md:w-[380px] flex flex-col min-h-0">
              {/* Header de la lista con herramientas */}
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                    {t('recorrido.paradas')}
                  </span>
                  <span className="text-[11px] text-texto-terciario">
                    {totalParadas} {totalParadas === 1 ? t('visitas.visita') : t('visitas.visitas_label')}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {/* Revertir optimización */}
                  {paradasPreOptimizar && (
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      soloIcono
                      icono={<RotateCcw size={13} />}
                      tooltip="Revertir optimización"
                      onClick={revertirOptimizacion}
                    />
                  )}
                  {/* Invertir ruta */}
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    icono={<ArrowUpDown size={13} />}
                    tooltip="Invertir ruta"
                    onClick={invertirRuta}
                    disabled={paradas.length < 2}
                  />
                  {/* Optimizar ruta */}
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    soloIcono
                    icono={optimizando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    tooltip={t('visitas.optimizar_ruta')}
                    onClick={optimizarRuta}
                    disabled={paradas.length < 2 || optimizando}
                  />
                  {/* Config permisos + salida/regreso */}
                  <ConfigRecorrido
                    recorridoId={recorrido?.id || null}
                    configActual={recorrido?.config}
                    nombreVisitador={nombreVisitador}
                    onGuardar={guardarConfig}
                    origenDestino={coordsEmpresa ? {
                      coordsEmpresa,
                      origenEmpresa,
                      destinoEmpresa,
                      onToggleOrigen: toggleOrigen,
                      onToggleDestino: toggleDestino,
                    } : undefined}
                  />
                </div>
              </div>

              {/* Barra de progreso compacta */}
              {esEnCurso && completadas > 0 && (
                <div className="shrink-0 px-4 py-2 border-b border-white/[0.07]">
                  <div className="flex items-center justify-between text-[11px] text-texto-terciario mb-1">
                    <span>{completadas} de {totalParadas} completadas</span>
                    <span>{Math.round((completadas / totalParadas) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-estado-completado transition-all"
                      style={{ width: `${(completadas / totalParadas) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Lista sortable con línea de tiempo */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <DndContext
                  sensors={sensores}
                  collisionDetection={closestCenter}
                  onDragEnd={manejarDragEnd}
                >
                  <SortableContext items={idsParadas} strategy={verticalListSortingStrategy}>
                    <div className="relative">
                      {/* Línea vertical de timeline */}
                      <div className="absolute left-[13px] top-3 bottom-3 w-px bg-white/[0.08]" />

                      <AnimatePresence initial={false}>
                        {paradas.map((parada, i) => {
                          const estado = parada.visita?.estado || 'programada'
                          const esCompletadaP = estado === 'completada'
                          const esActivaP = estado === 'en_camino' || estado === 'en_sitio'

                          // Color del nodo del timeline
                          const colorNodo = esCompletadaP ? 'bg-insignia-exito border-insignia-exito/40'
                            : esActivaP ? 'bg-texto-marca border-texto-marca/40 ring-2 ring-texto-marca/20'
                            : estado === 'cancelada' ? 'bg-insignia-peligro/50 border-insignia-peligro/40'
                            : 'bg-superficie-elevada border-white/[0.15]'

                          return (
                            <motion.div
                              key={parada.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.15 }}
                              className="relative flex gap-2.5 pb-2"
                            >
                              {/* Nodo del timeline */}
                              <div className="relative z-10 flex flex-col items-center pt-3 shrink-0 w-[26px]">
                                <div className={`size-2.5 rounded-full border ${colorNodo}`}>
                                  {esActivaP && (
                                    <span className="absolute -inset-1 rounded-full bg-texto-marca/20 animate-ping" />
                                  )}
                                </div>
                              </div>

                              {/* Tarjeta */}
                              <div className="flex-1 min-w-0">
                                <ItemParadaSortable parada={parada} indice={i} onQuitar={quitarParada} />
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        </ProveedorMapa>
      )}
      </div>

      {/* Modal de confirmación si el recorrido está en curso */}
      <ModalConfirmacion
        abierto={confirmarEdicionEnCurso}
        titulo={t('visitas.recorrido_en_curso')}
        descripcion={`${nombreVisitador} ${t('visitas.recorrido_en_curso_desc')}`}
        etiquetaConfirmar={t('visitas.si_editar')}
        etiquetaCancelar={t('comun.cancelar')}
        tipo="advertencia"
        onConfirmar={() => {
          setConfirmarEdicionEnCurso(false)
          setEdicionConfirmada(true)
        }}
        onCerrar={() => {
          setConfirmarEdicionEnCurso(false)
          manejarCerrar()
        }}
      />
    </ModalAdaptable>
  )
}
