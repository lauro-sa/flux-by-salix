'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { CalendarDays, Users, Inbox, MapPin, Calendar, GripVertical } from 'lucide-react'
import { ProveedorMapa } from '@/componentes/mapa'
import TarjetaVisitador from './TarjetaVisitador'
import ModalRecorrido from './ModalRecorrido'
import type { ConfigPermisos } from './ConfigRecorrido'

/**
 * PanelPlanificacion — Vista kanban del coordinador para planificar recorridos.
 * Muestra TODOS los miembros del equipo como columnas.
 * Drag & drop para reasignar visitas entre personas y reordenar paradas.
 */

interface VisitaPlan {
  id: string
  contacto_nombre: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  estado: string
  prioridad: string
  duracion_estimada_min: number | null
  fecha_programada: string | null
  motivo: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  contacto?: { tipo_contacto?: { clave: string; etiqueta: string } | null } | null
}

interface VisitadorPlan {
  usuario_id: string
  nombre: string
  apellido: string
  avatar_url: string | null
  rol: string | null
  visitas: VisitaPlan[]
  recorrido: {
    id: string
    estado: string
    total_visitas: number | null
    visitas_completadas: number | null
    distancia_total_km: number | null
    duracion_total_min: number | null
    config: ConfigPermisos | null
  } | null
}

interface DatosPlanificacion {
  fecha: string
  visitadores: VisitadorPlan[]
  sin_asignar: VisitaPlan[]
  pendientes_sin_asignar: VisitaPlan[]
  total_visitas: number
}

const ID_SIN_ASIGNAR = '__sin_asignar__'

interface PropsPanelPlanificacion {
  onAbrirVisita?: (visitaId: string) => void
}

export default function PanelPlanificacion({ onAbrirVisita }: PropsPanelPlanificacion) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const queryClient = useQueryClient()

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const columnaOrigenRef = useRef<string | null>(null)
  const [optimizandoUsuario, setOptimizandoUsuario] = useState<string | null>(null)
  const [tabMobile, setTabMobile] = useState(0)
  // Modal de recorrido
  const [modalRecorrido, setModalRecorrido] = useState<{ abierto: boolean; usuarioId: string; nombreVisitador: string; fecha: string }>({
    abierto: false, usuarioId: '', nombreVisitador: '', fecha: '',
  })

  // Orden de columnas persistido en localStorage
  const [ordenColumnas, setOrdenColumnas] = useState<string[]>([])
  const ordenCargado = useRef(false)

  // Fetch datos — todas las visitas pendientes sin filtro de fecha
  const { data: datos, isLoading, refetch } = useQuery<DatosPlanificacion>({
    queryKey: ['visitas-planificacion'],
    queryFn: async () => {
      const res = await fetch('/api/visitas/planificacion')
      if (!res.ok) throw new Error('Error al cargar planificación')
      return res.json()
    },
    staleTime: 20_000,
  })

  // Realtime: recargar cuando cambian visitas (otro usuario reasigna o completa)
  useEffect(() => {
    const supabase = crearClienteNavegador()
    const canal = supabase
      .channel('planificacion-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'visitas',
      }, () => { refetch() })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [refetch])

  // Estado local optimista
  const [visitadoresLocal, setVisitadoresLocal] = useState<VisitadorPlan[]>([])
  const [sinAsignarLocal, setSinAsignarLocal] = useState<VisitaPlan[]>([])

  // Peso por estado: activas arriba, pendientes en medio, completadas abajo
  const pesoEstado = useCallback((estado: string) => {
    if (estado === 'en_camino' || estado === 'en_sitio') return 0
    if (estado === 'completada') return 2
    if (estado === 'cancelada') return 3
    return 1 // programada, reprogramada
  }, [])

  // Ordenar visitas: agrupar por día, dentro de cada día ordenar por estado (activas arriba, completadas abajo)
  const ordenarPorFecha = useCallback((arr: VisitaPlan[]) =>
    [...arr].sort((a, b) => {
      // Primero agrupar por día (sin hora)
      const diaA = a.fecha_programada?.split('T')[0] || '9999'
      const diaB = b.fecha_programada?.split('T')[0] || '9999'
      if (diaA !== diaB) return diaA.localeCompare(diaB)
      // Dentro del mismo día, por estado: activas → pendientes → completadas
      const pa = pesoEstado(a.estado)
      const pb = pesoEstado(b.estado)
      if (pa !== pb) return pa - pb
      // Mismo estado, por hora
      const fa = a.fecha_programada ? new Date(a.fecha_programada).getTime() : Infinity
      const fb = b.fecha_programada ? new Date(b.fecha_programada).getTime() : Infinity
      return fa - fb
    })
  , [pesoEstado])

  useEffect(() => {
    if (datos) {
      // Aplicar orden guardado a visitadores
      let visitadoresOrdenados = datos.visitadores
      if (!ordenCargado.current) {
        try {
          const guardado = localStorage.getItem('flux-orden-columnas-planificacion')
          if (guardado) setOrdenColumnas(JSON.parse(guardado))
        } catch { /* ignorar */ }
        ordenCargado.current = true
      }
      if (ordenColumnas.length > 0) {
        visitadoresOrdenados = [...datos.visitadores].sort((a, b) => {
          const ia = ordenColumnas.indexOf(a.usuario_id)
          const ib = ordenColumnas.indexOf(b.usuario_id)
          if (ia === -1 && ib === -1) return 0
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
      }
      // Ordenar visitas dentro de cada visitador por fecha+estado
      setVisitadoresLocal(visitadoresOrdenados.map(v => ({
        ...v,
        visitas: ordenarPorFecha(v.visitas),
      })))
      setSinAsignarLocal(ordenarPorFecha(datos.pendientes_sin_asignar || datos.sin_asignar))
    }
  }, [datos, ordenColumnas, ordenarPorFecha])

  // Mover columna de visitador
  const moverColumna = useCallback((usuarioId: string, direccion: -1 | 1) => {
    setVisitadoresLocal(prev => {
      const idx = prev.findIndex(v => v.usuario_id === usuarioId)
      if (idx === -1) return prev
      const nuevoIdx = idx + direccion
      if (nuevoIdx < 0 || nuevoIdx >= prev.length) return prev
      const nuevo = [...prev]
      const temp = nuevo[idx]
      nuevo[idx] = nuevo[nuevoIdx]
      nuevo[nuevoIdx] = temp
      // Persistir orden
      const nuevoOrden = nuevo.map(v => v.usuario_id)
      setOrdenColumnas(nuevoOrden)
      localStorage.setItem('flux-orden-columnas-planificacion', JSON.stringify(nuevoOrden))
      return nuevo
    })
  }, [])

  // Resumen
  const totalVisitas = (datos?.total_visitas || 0)
  const visitadoresConVisitas = visitadoresLocal.filter(v => v.visitas.length > 0).length

  // ── DnD helpers ──
  const encontrarColumna = useCallback((visitaId: string): string | null => {
    if (sinAsignarLocal.some(v => v.id === visitaId)) return ID_SIN_ASIGNAR
    for (const vis of visitadoresLocal) {
      if (vis.visitas.some(v => v.id === visitaId)) return vis.usuario_id
    }
    return null
  }, [visitadoresLocal, sinAsignarLocal])

  const encontrarVisita = useCallback((visitaId: string): VisitaPlan | null => {
    const sinAsg = sinAsignarLocal.find(v => v.id === visitaId)
    if (sinAsg) return sinAsg
    for (const vis of visitadoresLocal) {
      const found = vis.visitas.find(v => v.id === visitaId)
      if (found) return found
    }
    return null
  }, [visitadoresLocal, sinAsignarLocal])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    setDraggingId(id)
    columnaOrigenRef.current = encontrarColumna(id)
  }, [encontrarColumna])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    const columnaOrigen = encontrarColumna(activeId)
    let columnaDestino = encontrarColumna(overId)
    if (!columnaDestino) columnaDestino = overId
    if (!columnaOrigen || !columnaDestino || columnaOrigen === columnaDestino) return

    const visita = encontrarVisita(activeId)
    if (!visita) return

    if (columnaOrigen === ID_SIN_ASIGNAR) {
      setSinAsignarLocal(prev => prev.filter(v => v.id !== activeId))
    } else {
      setVisitadoresLocal(prev => prev.map(vis =>
        vis.usuario_id === columnaOrigen ? { ...vis, visitas: vis.visitas.filter(v => v.id !== activeId) } : vis
      ))
    }
    if (columnaDestino === ID_SIN_ASIGNAR) {
      setSinAsignarLocal(prev => ordenarPorFecha([...prev, visita]))
    } else {
      setVisitadoresLocal(prev => prev.map(vis =>
        vis.usuario_id === columnaDestino ? { ...vis, visitas: ordenarPorFecha([...vis.visitas, visita]) } : vis
      ))
    }
  }, [encontrarColumna, encontrarVisita, ordenarPorFecha])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingId(null)
    if (!over) { columnaOrigenRef.current = null; return }

    const activeId = active.id as string
    const overId = over.id as string
    const columnaOrigen = columnaOrigenRef.current
    const columnaActual = encontrarColumna(activeId)
    columnaOrigenRef.current = null
    if (!columnaActual) return

    // ¿Cambió de columna? (comparar con origen guardado en dragStart)
    const cambioColumna = columnaOrigen !== null && columnaOrigen !== columnaActual

    if (cambioColumna) {
      // Reasignar entre columnas — la UI ya se actualizó en handleDragOver
      const visitadorDestino = columnaActual === ID_SIN_ASIGNAR
        ? null : visitadoresLocal.find(v => v.usuario_id === columnaActual)
      try {
        const res = await fetch('/api/visitas/planificacion/reasignar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visita_id: activeId,
            asignado_a: columnaActual === ID_SIN_ASIGNAR ? null : columnaActual,
            asignado_nombre: visitadorDestino ? `${visitadorDestino.nombre} ${visitadorDestino.apellido}`.trim() : null,
          }),
        })
        if (!res.ok) throw new Error()
        mostrar('exito', t('visitas.visita_reasignada'))
      } catch {
        mostrar('error', 'Error al reasignar')
        refetch()
      }
      return
    }

    // Reordenar dentro de la misma columna — respetando grupos de fecha
    if (columnaActual === ID_SIN_ASIGNAR) return
    const visitador = visitadoresLocal.find(v => v.usuario_id === columnaActual)
    if (!visitador) return
    const oldIndex = visitador.visitas.findIndex(v => v.id === activeId)
    const newIndex = visitador.visitas.findIndex(v => v.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // Solo permitir reorden dentro del mismo grupo de fecha
    const fechaActiva = visitador.visitas[oldIndex].fecha_programada?.split('T')[0] || ''
    const fechaOver = visitador.visitas[newIndex].fecha_programada?.split('T')[0] || ''
    if (fechaActiva !== fechaOver) return // no mover entre fechas distintas

    const nuevasVisitas = arrayMove(visitador.visitas, oldIndex, newIndex)
    setVisitadoresLocal(prev => prev.map(v =>
      v.usuario_id === columnaActual ? { ...v, visitas: nuevasVisitas } : v
    ))
    if (visitador.recorrido) {
      try {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: visitador.recorrido.id,
            paradas: nuevasVisitas.map((v, i) => ({ id: v.id, orden: i + 1 })),
          }),
        })
      } catch { refetch() }
    }
  }, [encontrarColumna, visitadoresLocal, refetch, mostrar, t])

  // Optimizar ruta
  const optimizarRuta = useCallback(async (usuarioId: string) => {
    const visitador = visitadoresLocal.find(v => v.usuario_id === usuarioId)
    if (!visitador || visitador.visitas.length < 2) return
    const paradasConGeo = visitador.visitas.filter(v => v.direccion_lat && v.direccion_lng)
    if (paradasConGeo.length < 2) {
      mostrar('error', 'Se necesitan al menos 2 paradas con ubicación')
      return
    }
    setOptimizandoUsuario(usuarioId)
    try {
      const origen = { lat: paradasConGeo[0].direccion_lat!, lng: paradasConGeo[0].direccion_lng! }
      const res = await fetch('/api/mapa/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen, paradas: paradasConGeo.map(v => ({ id: v.id, lat: v.direccion_lat!, lng: v.direccion_lng! })) }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const idsOrdenados = (data.paradas_ordenadas as { id: string }[]).map(p => p.id)
      const visitasOrdenadas = [
        ...idsOrdenados.map(id => visitador.visitas.find(v => v.id === id)!).filter(Boolean),
        ...visitador.visitas.filter(v => !v.direccion_lat || !v.direccion_lng),
      ]
      setVisitadoresLocal(prev => prev.map(v =>
        v.usuario_id === usuarioId ? { ...v, visitas: visitasOrdenadas } : v
      ))
      if (visitador.recorrido) {
        await fetch('/api/recorrido/reordenar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recorrido_id: visitador.recorrido.id,
            paradas: visitasOrdenadas.map((v, i) => ({ id: v.id, orden: i + 1 })),
          }),
        })
      }
      mostrar('exito', t('visitas.ruta_optimizada'))
    } catch {
      mostrar('error', 'Error al optimizar ruta')
    } finally {
      setOptimizandoUsuario(null)
    }
  }, [visitadoresLocal, mostrar, t])

  // Guardar config permisos
  const guardarConfig = useCallback(async (recorridoId: string, config: ConfigPermisos) => {
    const res = await fetch('/api/recorrido/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recorrido_id: recorridoId, config }),
    })
    if (!res.ok) throw new Error()
    queryClient.invalidateQueries({ queryKey: ['visitas-planificacion'] })
  }, [queryClient])

  // Abrir modal de recorrido
  const abrirRecorrido = useCallback((usuarioId: string, fecha: string) => {
    const visitador = visitadoresLocal.find(v => v.usuario_id === usuarioId)
    const nombre = visitador ? `${visitador.nombre} ${visitador.apellido}`.trim() : 'Visitador'
    setModalRecorrido({ abierto: true, usuarioId, nombreVisitador: nombre, fecha })
  }, [visitadoresLocal])

  const cerrarRecorrido = useCallback(() => {
    setModalRecorrido(prev => ({ ...prev, abierto: false }))
  }, [])

  const formato = useFormato()
  const visitaDragging = draggingId ? encontrarVisita(draggingId) : null

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-texto-marca border-t-transparent" />
      </div>
    )
  }

  return (
    <ProveedorMapa>
    <div className="flex flex-col gap-3 px-2 sm:px-6 pb-4 flex-1 min-h-0">

      {/* ── Resumen compacto ── */}
      <div className="flex items-center gap-3 text-xs text-texto-terciario px-1">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={11} />
          <strong className="text-texto-primario">{totalVisitas}</strong> visitas pendientes
        </span>
        <span className="text-borde-fuerte">·</span>
        <span className="flex items-center gap-1.5">
          <Users size={11} />
          <strong className="text-texto-primario">{visitadoresConVisitas}</strong>/{visitadoresLocal.length} con visitas
        </span>
        {sinAsignarLocal.length > 0 && (
          <>
            <span className="text-borde-fuerte">·</span>
            <span className="flex items-center gap-1.5 text-insignia-advertencia">
              <Inbox size={11} />
              <strong>{sinAsignarLocal.length}</strong> sin asignar
            </span>
          </>
        )}
      </div>

      {/* ── Kanban ── */}
      <DndContext
        key={visitadoresLocal.map(v => v.usuario_id).join(',')}
        collisionDetection={(args) => {
          const pw = pointerWithin(args)
          return pw.length > 0 ? pw : rectIntersection(args)
        }}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Tabs mobile */}
        <div className="md:hidden">
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
            {sinAsignarLocal.length > 0 && (
              <button
                onClick={() => setTabMobile(-1)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tabMobile === -1 ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-terciario hover:bg-white/[0.06]'
                }`}
              >
                {t('visitas.sin_asignar')} ({sinAsignarLocal.length})
              </button>
            )}
            {visitadoresLocal.map((vis, idx) => (
              <button
                key={vis.usuario_id}
                onClick={() => setTabMobile(idx)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tabMobile === idx ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-terciario hover:bg-white/[0.06]'
                }`}
              >
                {vis.nombre || 'Sin nombre'} ({vis.visitas.length})
              </button>
            ))}
          </div>

          {tabMobile === -1 && sinAsignarLocal.length > 0 && (
            <TarjetaVisitador
              usuarioId={ID_SIN_ASIGNAR} nombre={t('visitas.sin_asignar')} apellido="" avatarUrl={null}
              visitas={sinAsignarLocal} recorrido={null}
              onOptimizarRuta={() => {}} onGuardarConfig={async () => {}}
              onAbrirVisita={onAbrirVisita}
            />
          )}
          {tabMobile >= 0 && visitadoresLocal[tabMobile] && (
            <TarjetaVisitador
              key={visitadoresLocal[tabMobile].usuario_id}
              usuarioId={visitadoresLocal[tabMobile].usuario_id}
              nombre={visitadoresLocal[tabMobile].nombre}
              apellido={visitadoresLocal[tabMobile].apellido}
              avatarUrl={visitadoresLocal[tabMobile].avatar_url}
              visitas={visitadoresLocal[tabMobile].visitas}
              recorrido={visitadoresLocal[tabMobile].recorrido}
              onOptimizarRuta={optimizarRuta} onGuardarConfig={guardarConfig}
              onAbrirRecorrido={abrirRecorrido}
              onAbrirVisita={onAbrirVisita}
              optimizando={optimizandoUsuario === visitadoresLocal[tabMobile].usuario_id}
            />
          )}
        </div>

        {/* Desktop kanban */}
        <div className="hidden md:flex items-stretch gap-3 flex-1 min-h-0">
          {/* Columna sin asignar — siempre visible */}
          <TarjetaVisitador
            usuarioId={ID_SIN_ASIGNAR}
            nombre={t('visitas.sin_asignar')}
            apellido=""
            avatarUrl={null}
            visitas={sinAsignarLocal}
            recorrido={null}
            onOptimizarRuta={() => {}}
            onGuardarConfig={async () => {}}
            onAbrirVisita={onAbrirVisita}
            esSinAsignar
          />

          {/* Columnas del equipo — SIEMPRE visibles */}
          {visitadoresLocal.map(visitador => (
            <TarjetaVisitador
              key={visitador.usuario_id}
              usuarioId={visitador.usuario_id}
              nombre={visitador.nombre}
              apellido={visitador.apellido}
              avatarUrl={visitador.avatar_url}
              visitas={visitador.visitas}
              recorrido={visitador.recorrido}
              onOptimizarRuta={optimizarRuta}
              onGuardarConfig={guardarConfig}
              onMoverColumna={moverColumna}
              onAbrirRecorrido={abrirRecorrido}
              onAbrirVisita={onAbrirVisita}
              optimizando={optimizandoUsuario === visitador.usuario_id}
            />
          ))}
        </div>

        {/* Drag overlay — replica exacta de la tarjeta */}
        <DragOverlay dropAnimation={null}>
          {visitaDragging && (() => {
            const v = visitaDragging
            const horaOv = v.fecha_programada ? formato.hora(v.fecha_programada) : null
            const fechaOv = v.fecha_programada
              ? new Date(v.fecha_programada).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
                  .replace(/^\w/, c => c.toUpperCase())
              : null
            const colorBorde = v.prioridad === 'urgente' ? 'border-l-insignia-peligro'
              : v.prioridad === 'alta' ? 'border-l-insignia-advertencia'
              : 'border-l-texto-marca/40'

            return (
              <div className={`rounded-lg border border-texto-marca/30 border-l-2 ${colorBorde} bg-superficie-elevada shadow-xl w-[280px] cursor-grabbing`}>
                <div className="flex justify-center py-0.5 opacity-30">
                  <GripVertical size={12} />
                </div>
                <div className="px-3 pb-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-texto-primario flex-1">
                      {v.contacto_nombre || 'Sin contacto'}
                    </span>
                    {v.contacto?.tipo_contacto?.etiqueta && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                        {v.contacto.tipo_contacto.etiqueta}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-texto-terciario flex-wrap">
                    {fechaOv && (
                      <span className="flex items-center gap-1">
                        <Calendar size={9} />
                        {fechaOv}
                      </span>
                    )}
                    {horaOv && <span>· {horaOv}</span>}
                    {v.duracion_estimada_min && <span>· {v.duracion_estimada_min}min</span>}
                  </div>
                  {v.direccion_texto && (
                    <div className="flex items-start gap-1.5">
                      <MapPin size={10} className="shrink-0 text-texto-terciario mt-0.5" />
                      <span className="text-[11px] text-texto-terciario leading-tight line-clamp-2">{v.direccion_texto}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

      {/* Modal de recorrido para organizar paradas de un visitador en una fecha */}
      <ModalRecorrido
        abierto={modalRecorrido.abierto}
        onCerrar={cerrarRecorrido}
        usuarioId={modalRecorrido.usuarioId}
        nombreVisitador={modalRecorrido.nombreVisitador}
        fecha={modalRecorrido.fecha}
        onActualizar={refetch}
      />
    </div>
    </ProveedorMapa>
  )
}
