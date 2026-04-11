'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
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
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { MapPin, CalendarDays, Users, Inbox } from 'lucide-react'
import { ProveedorMapa } from '@/componentes/mapa'
import TarjetaVisitador from './TarjetaVisitador'
import type { ConfigPermisos } from './ConfigRecorrido'

/**
 * PanelPlanificacion — Componente principal de planificación de recorridos.
 * Vista kanban con columnas por visitador, drag & drop entre columnas,
 * optimización de ruta y configuración de permisos.
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
  total_visitas: number
}

const ID_SIN_ASIGNAR = '__sin_asignar__'

export default function PanelPlanificacion() {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const queryClient = useQueryClient()

  // Fecha seleccionada (ISO: YYYY-MM-DD)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [optimizandoUsuario, setOptimizandoUsuario] = useState<string | null>(null)
  // Tab activo en mobile (índice del visitador visible, -1 = sin asignar)
  const [tabMobile, setTabMobile] = useState(0)

  // Fetch datos de planificación
  const { data: datos, isLoading, refetch } = useQuery<DatosPlanificacion>({
    queryKey: ['visitas-planificacion', fecha],
    queryFn: async () => {
      const res = await fetch(`/api/visitas/planificacion?fecha=${fecha}`)
      if (!res.ok) throw new Error('Error al cargar planificación')
      return res.json()
    },
    staleTime: 20_000,
  })

  // Estado local para DnD optimista (visitadores + sin_asignar)
  const [visitadoresLocal, setVisitadoresLocal] = useState<VisitadorPlan[]>([])
  const [sinAsignarLocal, setSinAsignarLocal] = useState<VisitaPlan[]>([])

  // Sincronizar datos del server con estado local
  useEffect(() => {
    if (datos) {
      setVisitadoresLocal(datos.visitadores)
      setSinAsignarLocal(datos.sin_asignar)
    }
  }, [datos])

  // Botones rápidos de fecha
  const botonesRapidos = useMemo(() => {
    const hoy = new Date()
    const manana = new Date(hoy)
    manana.setDate(manana.getDate() + 1)

    // Lunes de esta semana
    const diaSemana = hoy.getDay()
    const lunesEstaSemana = new Date(hoy)
    lunesEstaSemana.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    const lunesProxSemana = new Date(lunesEstaSemana)
    lunesProxSemana.setDate(lunesEstaSemana.getDate() + 7)

    return [
      { label: t('visitas.hoy'), valor: hoy.toISOString().split('T')[0] },
      { label: t('visitas.manana'), valor: manana.toISOString().split('T')[0] },
      { label: t('visitas.esta_semana'), valor: lunesEstaSemana.toISOString().split('T')[0] },
      { label: t('visitas.proxima_semana'), valor: lunesProxSemana.toISOString().split('T')[0] },
    ]
  }, [t])

  // Encontrar en qué columna está una visita
  const encontrarColumna = useCallback((visitaId: string): string | null => {
    if (sinAsignarLocal.some(v => v.id === visitaId)) return ID_SIN_ASIGNAR
    for (const vis of visitadoresLocal) {
      if (vis.visitas.some(v => v.id === visitaId)) return vis.usuario_id
    }
    return null
  }, [visitadoresLocal, sinAsignarLocal])

  // Encontrar datos de una visita
  const encontrarVisita = useCallback((visitaId: string): VisitaPlan | null => {
    const sinAsg = sinAsignarLocal.find(v => v.id === visitaId)
    if (sinAsg) return sinAsg
    for (const vis of visitadoresLocal) {
      const found = vis.visitas.find(v => v.id === visitaId)
      if (found) return found
    }
    return null
  }, [visitadoresLocal, sinAsignarLocal])

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const columnaOrigen = encontrarColumna(activeId)
    // El over puede ser una visita (en cuyo caso buscamos su columna) o una columna directa
    let columnaDestino = encontrarColumna(overId)
    if (!columnaDestino) {
      // over es directamente un droppable de columna (usuario_id o __sin_asignar__)
      columnaDestino = overId
    }

    if (!columnaOrigen || !columnaDestino || columnaOrigen === columnaDestino) return

    // Mover visita entre columnas (optimista)
    const visita = encontrarVisita(activeId)
    if (!visita) return

    // Quitar de origen
    if (columnaOrigen === ID_SIN_ASIGNAR) {
      setSinAsignarLocal(prev => prev.filter(v => v.id !== activeId))
    } else {
      setVisitadoresLocal(prev => prev.map(vis =>
        vis.usuario_id === columnaOrigen
          ? { ...vis, visitas: vis.visitas.filter(v => v.id !== activeId) }
          : vis
      ))
    }

    // Agregar a destino
    if (columnaDestino === ID_SIN_ASIGNAR) {
      setSinAsignarLocal(prev => [...prev, visita])
    } else {
      setVisitadoresLocal(prev => prev.map(vis =>
        vis.usuario_id === columnaDestino
          ? { ...vis, visitas: [...vis.visitas, visita] }
          : vis
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
      if (columnaActual === ID_SIN_ASIGNAR) return // no reordenar sin_asignar

      const visitador = visitadoresLocal.find(v => v.usuario_id === columnaActual)
      if (!visitador) return

      const oldIndex = visitador.visitas.findIndex(v => v.id === activeId)
      const newIndex = visitador.visitas.findIndex(v => v.id === overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const nuevasVisitas = arrayMove(visitador.visitas, oldIndex, newIndex)
      setVisitadoresLocal(prev => prev.map(v =>
        v.usuario_id === columnaActual ? { ...v, visitas: nuevasVisitas } : v
      ))

      // Persistir reorden si hay recorrido
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
        } catch {
          // Revertir si falla — refetch
          refetch()
        }
      }
      return
    }

    // Mover entre columnas — ya se hizo optimistamente en dragOver, ahora persistir
    const visita = encontrarVisita(activeId)
    if (!visita) return

    const visitadorDestino = columnaActual === ID_SIN_ASIGNAR
      ? null
      : visitadoresLocal.find(v => v.usuario_id === columnaActual)

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

  // Optimizar ruta de un visitador
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
      // Usar la primera parada como origen
      const origen = { lat: paradasConGeo[0].direccion_lat!, lng: paradasConGeo[0].direccion_lng! }

      const res = await fetch('/api/mapa/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen,
          paradas: paradasConGeo.map(v => ({ id: v.id, lat: v.direccion_lat!, lng: v.direccion_lng! })),
        }),
      })

      if (!res.ok) throw new Error()

      const data = await res.json()
      const idsOrdenados = (data.paradas_ordenadas as { id: string }[]).map(p => p.id)

      // Reordenar visitas localmente según resultado
      const visitasOrdenadas = [
        ...idsOrdenados.map(id => visitador.visitas.find(v => v.id === id)!).filter(Boolean),
        // Agregar las que no tenían geo al final
        ...visitador.visitas.filter(v => !v.direccion_lat || !v.direccion_lng),
      ]

      setVisitadoresLocal(prev => prev.map(v =>
        v.usuario_id === usuarioId ? { ...v, visitas: visitasOrdenadas } : v
      ))

      // Persistir si hay recorrido
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

  // Guardar config de permisos de un recorrido
  const guardarConfig = useCallback(async (recorridoId: string, config: ConfigPermisos) => {
    const res = await fetch('/api/recorrido/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recorrido_id: recorridoId, config }),
    })
    if (!res.ok) throw new Error()
    queryClient.invalidateQueries({ queryKey: ['visitas-planificacion'] })
  }, [queryClient])

  // Visita que se está arrastrando (para overlay)
  const visitaDragging = draggingId ? encontrarVisita(draggingId) : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-texto-marca border-t-transparent" />
      </div>
    )
  }

  return (
    <ProveedorMapa>
    <div className="flex flex-col gap-4 h-full">
      {/* Barra superior: fecha + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectorFecha
          valor={fecha}
          onChange={(v) => v && setFecha(v)}
          className="w-44"
        />
        <div className="flex items-center gap-1.5">
          {botonesRapidos.map(btn => (
            <Boton
              key={btn.valor}
              variante={fecha === btn.valor ? 'primario' : 'fantasma'}
              tamano="xs"
              onClick={() => setFecha(btn.valor)}
            >
              {btn.label}
            </Boton>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-texto-terciario">
          <Users size={14} />
          <span>{visitadoresLocal.length} visitadores</span>
          <span className="text-borde-fuerte">·</span>
          <CalendarDays size={14} />
          <span>{datos?.total_visitas || 0} visitas</span>
        </div>
      </div>

      {/* Kanban de visitadores */}
      {visitadoresLocal.length === 0 && sinAsignarLocal.length === 0 ? (
        <EstadoVacio
          icono={<MapPin size={40} className="text-texto-terciario" />}
          titulo={t('visitas.sin_visitas')}
          descripcion={t('visitas.sin_visitas_desc')}
        />
      ) : (
        <DndContext
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Tabs mobile — visible solo en <md */}
          <div className="md:hidden">
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
              {sinAsignarLocal.length > 0 && (
                <button
                  onClick={() => setTabMobile(-1)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tabMobile === -1
                      ? 'bg-texto-marca/15 text-texto-marca'
                      : 'text-texto-terciario hover:bg-white/[0.06]'
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
                    tabMobile === idx
                      ? 'bg-texto-marca/15 text-texto-marca'
                      : 'text-texto-terciario hover:bg-white/[0.06]'
                  }`}
                >
                  {vis.nombre} ({vis.visitas.length})
                </button>
              ))}
            </div>

            {/* Card del visitador activo en mobile */}
            {tabMobile === -1 && sinAsignarLocal.length > 0 && (
              <TarjetaVisitador
                usuarioId={ID_SIN_ASIGNAR}
                nombre={t('visitas.sin_asignar')}
                apellido=""
                avatarUrl={null}
                visitas={sinAsignarLocal}
                recorrido={null}
                onOptimizarRuta={() => {}}
                onGuardarConfig={async () => {}}
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
                onOptimizarRuta={optimizarRuta}
                onGuardarConfig={guardarConfig}
                optimizando={optimizandoUsuario === visitadoresLocal[tabMobile].usuario_id}
              />
            )}
          </div>

          {/* Kanban desktop — visible en md+ */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-4 flex-1">
            {/* Columna sin asignar */}
            {sinAsignarLocal.length > 0 && (
              <TarjetaVisitador
                usuarioId={ID_SIN_ASIGNAR}
                nombre={t('visitas.sin_asignar')}
                apellido=""
                avatarUrl={null}
                visitas={sinAsignarLocal}
                recorrido={null}
                onOptimizarRuta={() => {}}
                onGuardarConfig={async () => {}}
              />
            )}

            {/* Columnas por visitador */}
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
      )}
    </div>
    </ProveedorMapa>
  )
}
