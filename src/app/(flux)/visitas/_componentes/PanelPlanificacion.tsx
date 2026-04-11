'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { Boton } from '@/componentes/ui/Boton'
import { CalendarDays, Users, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { ProveedorMapa } from '@/componentes/mapa'
import TarjetaVisitador from './TarjetaVisitador'
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

/** Formatea fecha como "Lun 10 Abr" */
function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso + 'T12:00:00')
  return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/^\w/, c => c.toUpperCase())
}

export default function PanelPlanificacion() {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const queryClient = useQueryClient()

  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [optimizandoUsuario, setOptimizandoUsuario] = useState<string | null>(null)
  const [tabMobile, setTabMobile] = useState(0)

  // Fetch datos
  const { data: datos, isLoading, refetch } = useQuery<DatosPlanificacion>({
    queryKey: ['visitas-planificacion', fecha],
    queryFn: async () => {
      const res = await fetch(`/api/visitas/planificacion?fecha=${fecha}`)
      if (!res.ok) throw new Error('Error al cargar planificación')
      return res.json()
    },
    staleTime: 20_000,
  })

  // Estado local optimista
  const [visitadoresLocal, setVisitadoresLocal] = useState<VisitadorPlan[]>([])
  const [sinAsignarLocal, setSinAsignarLocal] = useState<VisitaPlan[]>([])

  useEffect(() => {
    if (datos) {
      setVisitadoresLocal(datos.visitadores)
      // Sin asignar: usar TODAS las pendientes sin asignar (cualquier fecha), ordenadas por fecha más cercana
      const pendientes = datos.pendientes_sin_asignar || datos.sin_asignar
      pendientes.sort((a, b) => {
        const fa = a.fecha_programada ? new Date(a.fecha_programada).getTime() : Infinity
        const fb = b.fecha_programada ? new Date(b.fecha_programada).getTime() : Infinity
        return fa - fb
      })
      setSinAsignarLocal(pendientes)
    }
  }, [datos])

  // Helper para formatear fecha local sin UTC
  const fechaLocal = useCallback((d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  , [])

  // Navegación de fecha: día anterior / siguiente
  const cambiarDia = useCallback((delta: number) => {
    setFecha(prev => {
      const d = new Date(prev + 'T12:00:00')
      d.setDate(d.getDate() + delta)
      return fechaLocal(d)
    })
  }, [fechaLocal])

  const botonesRapidos = useMemo(() => {
    const hoy = new Date()
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
    const diaSemana = hoy.getDay()
    const lunesEsta = new Date(hoy); lunesEsta.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    const lunesProx = new Date(lunesEsta); lunesProx.setDate(lunesEsta.getDate() + 7)
    return [
      { label: t('visitas.hoy'), valor: fechaLocal(hoy) },
      { label: t('visitas.manana'), valor: fechaLocal(manana) },
      { label: t('visitas.esta_semana'), valor: fechaLocal(lunesEsta) },
      { label: t('visitas.proxima_semana'), valor: fechaLocal(lunesProx) },
    ]
  }, [t, fechaLocal])

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
    setDraggingId(event.active.id as string)
  }, [])

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
      setSinAsignarLocal(prev => [...prev, visita])
    } else {
      setVisitadoresLocal(prev => prev.map(vis =>
        vis.usuario_id === columnaDestino ? { ...vis, visitas: [...vis.visitas, visita] } : vis
      ))
    }
  }, [encontrarColumna, encontrarVisita])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingId(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const columnaActual = encontrarColumna(activeId)
    if (!columnaActual) return

    // Reordenar dentro de la misma columna
    if (columnaActual === encontrarColumna(overId) || columnaActual === overId) {
      if (columnaActual === ID_SIN_ASIGNAR) return
      const visitador = visitadoresLocal.find(v => v.usuario_id === columnaActual)
      if (!visitador) return
      const oldIndex = visitador.visitas.findIndex(v => v.id === activeId)
      const newIndex = visitador.visitas.findIndex(v => v.id === overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

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
      return
    }

    // Reasignar entre columnas
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
  }, [encontrarColumna, encontrarVisita, visitadoresLocal, refetch, mostrar, t])

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
    <div className="flex flex-col gap-3 px-2 sm:px-6 pb-4">

      {/* ── Barra de controles estilo asistencias ── */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-borde-sutil bg-superficie-tarjeta">
        {/* Chips rápidos */}
        {botonesRapidos.map(btn => (
          <button
            key={btn.valor}
            onClick={() => setFecha(btn.valor)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              fecha === btn.valor
                ? 'bg-superficie-elevada text-texto-primario'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            {btn.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Resumen */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-texto-terciario whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={11} />
            <strong className="text-texto-primario">{totalVisitas}</strong> visitas
          </span>
          <span className="text-borde-fuerte">·</span>
          <span className="flex items-center gap-1.5">
            <Users size={11} />
            <strong className="text-texto-primario">{visitadoresConVisitas}</strong>/{visitadoresLocal.length} con rutas
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
      </div>

      {/* ── Navegación de fecha centrada ── */}
      <div className="flex items-center justify-center gap-3 shrink-0">
        <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronLeft size={16} />} onClick={() => cambiarDia(-1)} />
        <button
          onClick={() => setFecha(botonesRapidos[0].valor)}
          className="text-center hover:text-texto-marca transition-colors min-w-[120px]"
        >
          <p className="text-sm font-semibold text-texto-primario">{formatearFechaCorta(fecha)}</p>
          <p className="text-[10px] text-texto-terciario">{fecha}</p>
        </button>
        <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronRight size={16} />} onClick={() => cambiarDia(1)} />
      </div>

      {/* ── Kanban ── */}
      <DndContext
        collisionDetection={pointerWithin}
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
              optimizando={optimizandoUsuario === visitadoresLocal[tabMobile].usuario_id}
            />
          )}
        </div>

        {/* Desktop kanban */}
        <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
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
              optimizando={optimizandoUsuario === visitador.usuario_id}
            />
          ))}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {visitaDragging && (
            <div className="rounded-lg border border-texto-marca/40 bg-superficie-elevada p-2.5 shadow-lg max-w-[300px]">
              <p className="text-sm font-medium text-texto-primario truncate">
                {visitaDragging.contacto_nombre || 'Sin contacto'}
              </p>
              {visitaDragging.direccion_texto && (
                <p className="text-xs text-texto-terciario truncate mt-0.5">
                  {visitaDragging.direccion_texto}
                </p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
    </ProveedorMapa>
  )
}
