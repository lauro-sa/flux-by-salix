'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlusCircle, CheckCircle, Clock, RotateCcw, Ban, User, Calendar, ChevronDown,
  GripVertical, Pencil, Trash2, RefreshCw, X, FileText, Heading, StickyNote,
  Loader2,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalActividad } from '../../actividades/_componentes/ModalActividad'
import type { Actividad, Miembro } from '../../actividades/_componentes/ModalActividad'
import type { TipoActividad } from '../../actividades/configuracion/_tipos'
import type { EstadoActividad } from '../../actividades/configuracion/secciones/SeccionEstados'
import type { AsignadoOrdenTrabajo } from '@/tipos/orden-trabajo'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useMiembrosAsignables } from '@/hooks/useMiembrosAsignables'

/**
 * SeccionActividadesOrden — Lista unificada de tareas + actividades de la OT.
 *
 * Tareas (`tareas_orden`) tienen tres tipos:
 *   - 'producto': trabajo a hacer, completable, con asignados y fecha.
 *   - 'seccion': encabezado/separador del presupuesto, no completable.
 *   - 'nota': bloque de texto entre líneas, no completable.
 *
 * En modo borrador (no publicada) y como gestor:
 *   - editar inline título / descripción / detalle (autoguarda al blur)
 *   - eliminar línea
 *   - reordenar drag-and-drop
 *   - agregar producto / sección / nota
 *   - re-importar del presupuesto (no destructivo)
 *
 * Una vez publicada queda congelada; al despublicar vuelve a ser editable.
 */

type TipoTarea = 'producto' | 'seccion' | 'nota'

interface TareaOrden {
  id: string
  orden_trabajo_id: string
  tipo: TipoTarea
  titulo: string
  descripcion: string | null
  descripcion_detalle: string | null
  codigo_producto: string | null
  origen_linea_id: string | null
  estado: 'pendiente' | 'completada' | 'cancelada' | 'no_aplica'
  prioridad: string
  fecha_vencimiento: string | null
  fecha_completada: string | null
  asignados: { id: string; nombre: string }[]
  asignados_ids: string[]
  orden: number
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
}

interface PropiedadesSeccion {
  ordenId: string
  ordenNumero: string
  asignadosOT: AsignadoOrdenTrabajo[]
  usuarioActualId: string | null
  /** Admin / creador / cabecilla. Decide quién puede marcar tareas hechas. */
  puedeGestionar: boolean
  /** Gestor + OT no publicada. Habilita crear/editar/eliminar/reordenar. */
  puedeEditar: boolean
  /** Si hay presupuesto, mostramos el botón "Re-importar". */
  tienePresupuesto: boolean
  publicada: boolean
  onProgresoChange?: (completadas: number, total: number) => void
}

export default function SeccionActividadesOrden({
  ordenId, ordenNumero, asignadosOT, usuarioActualId, puedeGestionar, puedeEditar,
  tienePresupuesto, publicada, onProgresoChange,
}: PropiedadesSeccion) {
  const { t } = useTraduccion()
  const { mostrar: mostrarToast } = useToast()
  const [tareas, setTareas] = useState<TareaOrden[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const { data: miembros = [] } = useMiembrosAsignables()
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)

  // Cancelar
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [cancelarTipo, setCancelarTipo] = useState<'tarea' | 'actividad'>('tarea')
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  // Crear nueva (con selector de tipo)
  const [tipoNueva, setTipoNueva] = useState<TipoTarea | null>(null)
  const [tituloNueva, setTituloNueva] = useState('')
  const [descripcionNueva, setDescripcionNueva] = useState('')
  const [detalleNueva, setDetalleNueva] = useState('')
  const [fechaNueva, setFechaNueva] = useState('')
  const [responsablesNueva, setResponsablesNueva] = useState<string[]>([])
  const [menuResponsablesNueva, setMenuResponsablesNueva] = useState(false)
  const [creando, setCreando] = useState(false)

  // Reimportar
  const [reimportando, setReimportando] = useState(false)

  // Edición inline
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const sensors = useSensors(
    // pointer + tolerancia: el touch en mobile no abre drag por error al
    // hacer scroll. activationConstraint distancia=6 => requiere 6px de mov.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const cargar = useCallback(async () => {
    try {
      const [tareasRes, actRes, configRes] = await Promise.all([
        fetch(`/api/ordenes/${ordenId}/tareas`).then(r => r.json()),
        fetch(`/api/actividades?orden_trabajo_id=${ordenId}&por_pagina=50`).then(r => r.json()),
        fetch('/api/actividades/config').then(r => r.json()),
      ])
      const tareasOT = tareasRes.tareas || []
      const acts = actRes.actividades || []
      setTareas(tareasOT)
      setActividades(acts)
      setTipos(configRes.tipos || [])
      setEstados(configRes.estados || [])

      // Progreso: solo cuentan tareas tipo='producto' + actividades.
      // Las secciones y notas son informativas.
      const tareasCompletables = tareasOT.filter((t: TareaOrden) => t.tipo === 'producto')
      const tareasCompletadas = tareasCompletables.filter((t: TareaOrden) => t.estado === 'completada').length
      const totalTareas = tareasCompletables.length
      const totalActs = acts.length
      const actsCompletadas = acts.filter((a: Actividad) => a.estado_clave === 'completada').length
      onProgresoChange?.(tareasCompletadas + actsCompletadas, totalTareas + totalActs)
    } catch {
      console.error('Error al cargar tareas/actividades de la orden')
    } finally {
      setCargando(false)
    }
  }, [ordenId, onProgresoChange])

  useEffect(() => { cargar() }, [cargar])

  // ── Acciones tareas ──
  const completarTarea = async (id: string) => {
    await fetch(`/api/ordenes/${ordenId}/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    cargar()
  }

  const reactivarTarea = async (id: string) => {
    await fetch(`/api/ordenes/${ordenId}/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'reactivar' }),
    })
    cargar()
  }

  const confirmarCancelarTarea = async () => {
    if (!cancelarId) return
    await fetch(`/api/ordenes/${ordenId}/tareas/${cancelarId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cancelar', notas: motivoCancelacion || undefined }),
    })
    setCancelarId(null)
    setMotivoCancelacion('')
    cargar()
  }

  const eliminarTarea = async (id: string) => {
    if (!confirm('¿Eliminar esta línea? Solo se borra de la OT, no del presupuesto.')) return
    const res = await fetch(`/api/ordenes/${ordenId}/tareas/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      mostrarToast('error', err.error || 'Error al eliminar')
      return
    }
    cargar()
  }

  const guardarEdicion = async (id: string, campos: Partial<Pick<TareaOrden, 'titulo' | 'descripcion' | 'descripcion_detalle'>>) => {
    const res = await fetch(`/api/ordenes/${ordenId}/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      mostrarToast('error', err.error || 'Error al guardar')
      return false
    }
    cargar()
    return true
  }

  const reordenar = async (nuevasTareas: TareaOrden[]) => {
    // Optimista
    setTareas(nuevasTareas)
    const ids = nuevasTareas.map(t => t.id)
    const res = await fetch(`/api/ordenes/${ordenId}/tareas/reordenar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: ids }),
    })
    if (!res.ok) {
      mostrarToast('error', 'Error al reordenar')
      cargar()
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tareas.findIndex(t => t.id === active.id)
    const newIndex = tareas.findIndex(t => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reordenar(arrayMove(tareas, oldIndex, newIndex))
  }

  const reimportar = async () => {
    if (!confirm('Re-importar las líneas del presupuesto? Solo se agregan las que falten — no se tocan tus ediciones.')) return
    setReimportando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/tareas/reimportar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        mostrarToast('error', data.error || 'Error al re-importar')
        return
      }
      const msg = data.agregadas > 0
        ? `Re-importado: ${data.agregadas} ${data.agregadas === 1 ? 'línea nueva' : 'líneas nuevas'}`
        : 'Sin cambios — la OT ya estaba al día'
      mostrarToast('exito', msg)
      cargar()
    } finally {
      setReimportando(false)
    }
  }

  // ── Acciones actividades ──
  const crearActividad = async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear')
    cargar()
  }

  const completarActividad = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    cargar()
  }

  const posponerActividad = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'posponer', dias: 1 }),
    })
    cargar()
  }

  const reactivarActividad = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'reactivar' }),
    })
    cargar()
  }

  const confirmarCancelarActividad = async () => {
    if (!cancelarId) return
    await fetch(`/api/actividades/${cancelarId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cancelar', notas: motivoCancelacion || undefined }),
    })
    setCancelarId(null)
    setMotivoCancelacion('')
    cargar()
  }

  const abrirCancelar = (id: string, tipo: 'tarea' | 'actividad') => {
    setCancelarId(id)
    setCancelarTipo(tipo)
    setMotivoCancelacion('')
  }

  // ── Permisos por tarea ──
  const responsablesOT = asignadosOT.filter(a => a.es_cabecilla)
  const esResponsableOT = responsablesOT.some(a => a.usuario_id === usuarioActualId)

  const puedeMarcarTarea = (tarea: TareaOrden): boolean => {
    if (tarea.tipo !== 'producto') return false
    if (puedeGestionar) return true
    if (!usuarioActualId || !publicada) return false
    const asignadosTarea = tarea.asignados || []
    if (asignadosTarea.length > 0) {
      return asignadosTarea.some(a => a.id === usuarioActualId)
    }
    return esResponsableOT
  }

  const puedeMarcarActividad = (actividad: Actividad): boolean => {
    if (puedeGestionar) return true
    if (!usuarioActualId || !publicada) return false
    const asignadosActividad = actividad.asignados || []
    if (asignadosActividad.length > 0) {
      return asignadosActividad.some(a => a.id === usuarioActualId)
    }
    return esResponsableOT
  }

  // ── Crear nueva ──
  const crearNueva = async () => {
    if (!tipoNueva || creando) return
    const titulo = tituloNueva.trim()
    if (!titulo) return
    setCreando(true)
    try {
      const asignados = tipoNueva === 'producto'
        ? responsablesNueva.map(uid => {
          const m = miembros.find(x => x.usuario_id === uid)
          return m ? { id: m.usuario_id, nombre: `${m.nombre} ${m.apellido || ''}`.trim() } : null
        }).filter(Boolean)
        : []

      const res = await fetch(`/api/ordenes/${ordenId}/tareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoNueva,
          titulo,
          descripcion: descripcionNueva.trim() || null,
          descripcion_detalle: detalleNueva.trim() || null,
          asignados,
          fecha_vencimiento: tipoNueva === 'producto' ? (fechaNueva || null) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        mostrarToast('error', err.error || 'Error al crear')
        return
      }
      setTipoNueva(null)
      setTituloNueva(''); setDescripcionNueva(''); setDetalleNueva('')
      setFechaNueva(''); setResponsablesNueva([])
      cargar()
    } finally {
      setCreando(false)
    }
  }

  // ── Listas ──
  // Las tareas vienen ordenadas por `orden` desde el backend. No las
  // re-particionamos por tipo (la mezcla preserva la jerarquía visual del
  // presupuesto). Para la vista de "finalizadas" sí separamos por estado.
  const tareasActivas = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'no_aplica')
  const tareasFinalizadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'cancelada')
  const tiposPorId = Object.fromEntries(tipos.map(t => [t.id, t]))
  const actividadesPendientes = actividades.filter(a => a.estado_clave !== 'completada' && a.estado_clave !== 'cancelada')
  const actividadesFinalizadas = actividades.filter(a => a.estado_clave === 'completada' || a.estado_clave === 'cancelada')

  const tareasCompletables = tareas.filter(t => t.tipo === 'producto')
  const totalItems = tareasCompletables.length + actividades.length
  const completadasCount = tareasCompletables.filter(t => t.estado === 'completada').length
    + actividades.filter(a => a.estado_clave === 'completada').length
  const porcentaje = totalItems > 0 ? Math.round((completadasCount / totalItems) * 100) : 0

  const miembrosAsignadosOT = miembros.filter(m => asignadosOT.some(a => a.usuario_id === m.usuario_id))
  const miembrosParaResponsables = miembrosAsignadosOT.length > 0 ? miembrosAsignadosOT : miembros

  return (
    <section>
      {/* Header con progreso + acciones */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider shrink-0">
            {t('ordenes.progreso_actividades')}
          </h3>
          {totalItems > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-[200px]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: porcentaje === 100 ? 'var(--insignia-exito)' : 'var(--texto-marca)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${porcentaje}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-texto-terciario shrink-0">
                {completadasCount}/{totalItems}
              </span>
            </div>
          )}
        </div>

        {puedeEditar && (
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <SelectorAgregarTipo
              onElegir={(tipo) => {
                setTipoNueva(tipo)
                setModalAbierto(false)
                setTituloNueva(''); setDescripcionNueva(''); setDetalleNueva('')
                setFechaNueva(''); setResponsablesNueva([])
              }}
            />
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<PlusCircle size={13} />}
              onClick={() => { setModalAbierto(true); setTipoNueva(null) }}
            >
              Actividad
            </Boton>
            {tienePresupuesto && (
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={reimportando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                onClick={reimportar}
                disabled={reimportando}
                titulo="Re-importar las líneas del presupuesto (no destructivo)"
              >
                Re-importar
              </Boton>
            )}
          </div>
        )}
      </div>

      {/* Formulario inline para nueva tarea */}
      <AnimatePresence>
        {tipoNueva && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-3 rounded-card border border-texto-marca/20 bg-texto-marca/5 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-texto-marca uppercase tracking-wider">
                <IconoTipoTarea tipo={tipoNueva} size={12} />
                {tipoNueva === 'producto' ? 'Nueva tarea' : tipoNueva === 'seccion' ? 'Nueva sección' : 'Nueva nota'}
              </div>
              <input
                type="text"
                value={tituloNueva}
                onChange={e => setTituloNueva(e.target.value)}
                placeholder={tipoNueva === 'producto' ? 'Qué hay que hacer...' : tipoNueva === 'seccion' ? 'Encabezado de sección' : 'Texto de la nota'}
                className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && tituloNueva.trim()) crearNueva()
                  if (e.key === 'Escape') setTipoNueva(null)
                }}
              />
              {tipoNueva === 'producto' && (
                <textarea
                  value={detalleNueva}
                  onChange={e => setDetalleNueva(e.target.value)}
                  placeholder="Detalle (opcional) — qué incluye, especificaciones, etc."
                  className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
                  rows={2}
                />
              )}
              {tipoNueva === 'producto' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-texto-terciario" />
                    <input
                      type="date"
                      value={fechaNueva}
                      onChange={e => setFechaNueva(e.target.value)}
                      className="px-2 py-1.5 rounded-card bg-superficie-app border border-borde-sutil text-xs text-texto-primario focus:outline-none focus:border-texto-marca"
                    />
                  </div>
                  <SelectorResponsables
                    miembros={miembrosParaResponsables}
                    seleccionados={responsablesNueva}
                    onChange={setResponsablesNueva}
                    max={2}
                    abierto={menuResponsablesNueva}
                    onToggle={() => setMenuResponsablesNueva(v => !v)}
                    onCerrar={() => setMenuResponsablesNueva(false)}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 justify-end">
                <Boton variante="fantasma" tamano="sm" onClick={() => setTipoNueva(null)}>
                  Cancelar
                </Boton>
                <Boton variante="primario" tamano="sm" onClick={crearNueva} disabled={!tituloNueva.trim() || creando}>
                  Agregar
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      {cargando ? (
        <div className="py-4 text-center text-xs text-texto-terciario">Cargando...</div>
      ) : totalItems === 0 && tareasActivas.length === 0 && actividadesPendientes.length === 0 ? (
        <div className="py-6 text-center text-xs text-texto-terciario">
          {t('ordenes.sin_actividades')}
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Tareas activas (con drag-and-drop si puedeEditar) */}
          {tareasActivas.length > 0 && (
            puedeEditar ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={tareasActivas.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {tareasActivas.map(tarea => (
                    <FilaTareaSortable
                      key={tarea.id}
                      tarea={tarea}
                      puedeEditar={puedeEditar}
                      puedeMarcar={puedeMarcarTarea(tarea)}
                      enEdicion={editandoId === tarea.id}
                      onAbrirEdicion={() => setEditandoId(tarea.id)}
                      onCerrarEdicion={() => setEditandoId(null)}
                      onGuardar={(campos) => guardarEdicion(tarea.id, campos)}
                      onCompletar={() => completarTarea(tarea.id)}
                      onCancelar={() => abrirCancelar(tarea.id, 'tarea')}
                      onEliminar={() => eliminarTarea(tarea.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              tareasActivas.map(tarea => (
                <FilaTarea
                  key={tarea.id}
                  tarea={tarea}
                  puedeEditar={false}
                  puedeMarcar={puedeMarcarTarea(tarea)}
                  enEdicion={false}
                  onAbrirEdicion={() => {}}
                  onCerrarEdicion={() => {}}
                  onGuardar={async () => false}
                  onCompletar={() => completarTarea(tarea.id)}
                />
              ))
            )
          )}

          {/* Separador entre tareas y actividades */}
          {tareasActivas.length > 0 && actividadesPendientes.length > 0 && (
            <div className="pt-3 pb-1 border-t border-white/[0.06] mt-2">
              <p className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">Actividades</p>
            </div>
          )}

          {/* Actividades manuales */}
          {actividadesPendientes.map(act => (
            <FilaActividadCompacta
              key={act.id}
              actividad={act}
              tipo={tiposPorId[act.tipo_id]}
              puedeMarcar={puedeMarcarActividad(act)}
              onCompletar={() => completarActividad(act.id)}
              onPosponer={() => posponerActividad(act.id)}
            />
          ))}

          {/* Finalizadas */}
          {(tareasFinalizadas.length > 0 || actividadesFinalizadas.length > 0) && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] opacity-50 space-y-0.5">
              {tareasFinalizadas.map(tarea => (
                <FilaTarea
                  key={tarea.id}
                  tarea={tarea}
                  completada
                  puedeEditar={false}
                  puedeMarcar={puedeMarcarTarea(tarea)}
                  enEdicion={false}
                  onAbrirEdicion={() => {}}
                  onCerrarEdicion={() => {}}
                  onGuardar={async () => false}
                  onReactivar={() => reactivarTarea(tarea.id)}
                />
              ))}
              {actividadesFinalizadas.map(act => (
                <FilaActividadCompacta
                  key={act.id}
                  actividad={act}
                  tipo={tiposPorId[act.tipo_id]}
                  completada
                  puedeMarcar={puedeMarcarActividad(act)}
                  onReactivar={() => reactivarActividad(act.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal cancelación */}
      <AnimatePresence>
        {cancelarId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 p-4 rounded-card border border-insignia-peligro/20 bg-insignia-peligro/5 space-y-3"
          >
            <p className="text-sm font-medium text-texto-primario">Motivo de cancelación</p>
            <textarea
              value={motivoCancelacion}
              onChange={e => setMotivoCancelacion(e.target.value)}
              placeholder="¿Por qué se cancela? (opcional)"
              className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Boton variante="fantasma" tamano="sm" onClick={() => setCancelarId(null)}>Volver</Boton>
              <Boton
                variante="peligro"
                tamano="sm"
                icono={<Ban size={14} />}
                onClick={cancelarTipo === 'tarea' ? confirmarCancelarTarea : confirmarCancelarActividad}
              >
                Cancelar tarea
              </Boton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalActividad
        abierto={modalAbierto}
        tipos={tipos}
        estados={estados}
        miembros={miembros}
        vinculoInicial={{ tipo: 'orden', id: ordenId, nombre: `OT #${ordenNumero}` }}
        modulo="ordenes"
        onGuardar={crearActividad}
        onCerrar={() => setModalAbierto(false)}
      />
    </section>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  Sub-componente: selector "Agregar producto / sección / nota"
// ──────────────────────────────────────────────────────────────────────────

function SelectorAgregarTipo({ onElegir }: { onElegir: (tipo: TipoTarea) => void }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <Boton
        variante="fantasma"
        tamano="xs"
        icono={<PlusCircle size={13} />}
        onClick={() => setAbierto(v => !v)}
      >
        Agregar
      </Boton>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 right-0 z-50 min-w-44 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1"
          >
            <BotonItemTipo tipo="producto" label="Tarea" descripcion="Trabajo a realizar" onClick={() => { onElegir('producto'); setAbierto(false) }} />
            <BotonItemTipo tipo="seccion" label="Sección" descripcion="Encabezado del bloque" onClick={() => { onElegir('seccion'); setAbierto(false) }} />
            <BotonItemTipo tipo="nota" label="Nota" descripcion="Texto entre tareas" onClick={() => { onElegir('nota'); setAbierto(false) }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BotonItemTipo({ tipo, label, descripcion, onClick }: { tipo: TipoTarea; label: string; descripcion: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-superficie-tarjeta border-none bg-transparent cursor-pointer"
    >
      <div className="mt-0.5 text-texto-terciario"><IconoTipoTarea tipo={tipo} size={13} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-texto-primario">{label}</p>
        <p className="text-xxs text-texto-terciario">{descripcion}</p>
      </div>
    </button>
  )
}

function IconoTipoTarea({ tipo, size = 14 }: { tipo: TipoTarea; size?: number }) {
  if (tipo === 'producto') return <CheckCircle size={size} />
  if (tipo === 'seccion') return <Heading size={size} />
  return <StickyNote size={size} />
}

// ──────────────────────────────────────────────────────────────────────────
//  Wrapper sortable: agrega handle + transform al FilaTarea
// ──────────────────────────────────────────────────────────────────────────

function FilaTareaSortable(props: PropsFilaTarea) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.tarea.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <FilaTarea {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  Fila de tarea: render diferenciado por tipo, con edición inline
// ──────────────────────────────────────────────────────────────────────────

interface PropsFilaTarea {
  tarea: TareaOrden
  completada?: boolean
  puedeEditar: boolean
  puedeMarcar: boolean
  enEdicion: boolean
  onAbrirEdicion: () => void
  onCerrarEdicion: () => void
  onGuardar: (campos: Partial<Pick<TareaOrden, 'titulo' | 'descripcion' | 'descripcion_detalle'>>) => Promise<boolean>
  onCompletar?: () => void
  onCancelar?: () => void
  onEliminar?: () => void
  onReactivar?: () => void
  dragHandleProps?: Record<string, unknown>
}

function FilaTarea(props: PropsFilaTarea) {
  if (props.tarea.tipo === 'seccion') return <FilaSeccion {...props} />
  if (props.tarea.tipo === 'nota') return <FilaNota {...props} />
  return <FilaProducto {...props} />
}

function FilaProducto({
  tarea, completada, puedeEditar, puedeMarcar, enEdicion,
  onAbrirEdicion, onCerrarEdicion, onGuardar,
  onCompletar, onCancelar, onEliminar, onReactivar, dragHandleProps,
}: PropsFilaTarea) {
  const formato = useFormato()
  const [tituloEd, setTituloEd] = useState(tarea.titulo)
  const [detalleEd, setDetalleEd] = useState(tarea.descripcion_detalle || '')
  const vencida = tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date() && !completada

  useEffect(() => {
    if (enEdicion) {
      setTituloEd(tarea.titulo)
      setDetalleEd(tarea.descripcion_detalle || '')
    }
  }, [enEdicion, tarea.titulo, tarea.descripcion_detalle])

  const guardar = async () => {
    const cambios: Partial<Pick<TareaOrden, 'titulo' | 'descripcion_detalle'>> = {}
    const t = tituloEd.trim()
    const d = detalleEd.trim()
    if (t && t !== tarea.titulo) cambios.titulo = t
    if (d !== (tarea.descripcion_detalle || '')) cambios.descripcion_detalle = d || null
    if (Object.keys(cambios).length === 0) {
      onCerrarEdicion()
      return
    }
    const ok = await onGuardar(cambios)
    if (ok) onCerrarEdicion()
  }

  return (
    <div className={`group flex items-start gap-2 px-2 sm:px-3 py-3 rounded-card transition-colors border-b border-white/[0.04] last:border-b-0 ${completada ? 'opacity-50' : 'hover:bg-superficie-hover/50'}`}>
      {puedeEditar && dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="touch-none p-1 -ml-1 mt-0.5 text-texto-terciario/60 hover:text-texto-secundario cursor-grab active:cursor-grabbing rounded"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar"
        >
          <GripVertical size={13} />
        </button>
      )}
      <div
        className="w-8 h-8 rounded-card flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: 'var(--texto-marca)' + '15', color: 'var(--texto-marca)' }}
      >
        <CheckCircle size={14} />
      </div>

      <div className="flex-1 min-w-0">
        {enEdicion ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={tituloEd}
              onChange={e => setTituloEd(e.target.value)}
              className="w-full px-2 py-1.5 rounded-card bg-superficie-app border border-texto-marca/40 text-sm text-texto-primario focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardar() }
                if (e.key === 'Escape') onCerrarEdicion()
              }}
            />
            <textarea
              value={detalleEd}
              onChange={e => setDetalleEd(e.target.value)}
              placeholder="Detalle (opcional)"
              className="w-full px-2 py-1.5 rounded-card bg-superficie-app border border-borde-sutil text-xs text-texto-secundario resize-none focus:outline-none focus:border-texto-marca"
              rows={2}
            />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={onCerrarEdicion} className="px-2 py-1 rounded-card text-xs text-texto-terciario hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent">
                <X size={11} className="inline -mt-0.5" /> Cancelar
              </button>
              <button type="button" onClick={guardar} className="px-2 py-1 rounded-card bg-texto-marca/15 text-texto-marca text-xs font-medium hover:bg-texto-marca/25 transition-colors cursor-pointer border-none">
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p
              className={`text-sm ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'} ${puedeEditar ? 'cursor-text' : ''}`}
              onClick={() => puedeEditar && onAbrirEdicion()}
            >
              {tarea.titulo}
            </p>
            {tarea.descripcion_detalle && !completada && (
              <p
                className={`text-xs text-texto-terciario whitespace-pre-wrap mt-0.5 ${puedeEditar ? 'cursor-text' : ''}`}
                onClick={() => puedeEditar && onAbrirEdicion()}
              >
                {tarea.descripcion_detalle}
              </p>
            )}
            {tarea.descripcion && !completada && (
              <p className="text-xs text-texto-terciario mt-0.5">
                {tarea.descripcion}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {tarea.fecha_vencimiento && (
                <span className={`text-xs ${vencida ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}`}>
                  {formato.fecha(tarea.fecha_vencimiento, { corta: true })}
                  {vencida && ' — vencida'}
                </span>
              )}
              {tarea.asignados && tarea.asignados.length > 0 && (
                <span className="text-xs text-texto-terciario flex items-center gap-1">
                  <User size={10} />
                  {tarea.asignados.map(a => a.nombre).join(', ')}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {!enEdicion && (
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {!completada && puedeMarcar && onCompletar && (
            <button
              type="button"
              onClick={onCompletar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/5 text-insignia-exito-texto hover:bg-insignia-exito/15 active:scale-95"
            >
              <CheckCircle size={14} />
              <span className="hidden sm:inline">Hecho</span>
            </button>
          )}
          {!completada && puedeEditar && (
            <>
              <button
                type="button"
                onClick={onAbrirEdicion}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-card text-texto-terciario hover:text-texto-marca hover:bg-texto-marca/10 cursor-pointer border-none bg-transparent"
                title="Editar"
              >
                <Pencil size={12} />
              </button>
              {onCancelar && (
                <button
                  type="button"
                  onClick={onCancelar}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-card text-texto-terciario hover:text-insignia-advertencia-texto hover:bg-insignia-advertencia/10 cursor-pointer border-none bg-transparent"
                  title="Cancelar"
                >
                  <Ban size={12} />
                </button>
              )}
              {onEliminar && (
                <button
                  type="button"
                  onClick={onEliminar}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-card text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 cursor-pointer border-none bg-transparent"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
          {completada && puedeMarcar && onReactivar && (
            <button
              type="button"
              onClick={onReactivar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-white/[0.1] bg-transparent text-texto-terciario hover:text-texto-primario hover:bg-white/[0.05] active:scale-95"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reabrir</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FilaSeccion({
  tarea, puedeEditar, enEdicion, onAbrirEdicion, onCerrarEdicion, onGuardar,
  onEliminar, dragHandleProps,
}: PropsFilaTarea) {
  const [tituloEd, setTituloEd] = useState(tarea.titulo)

  useEffect(() => {
    if (enEdicion) setTituloEd(tarea.titulo)
  }, [enEdicion, tarea.titulo])

  const guardar = async () => {
    const t = tituloEd.trim()
    if (!t || t === tarea.titulo) {
      onCerrarEdicion()
      return
    }
    const ok = await onGuardar({ titulo: t })
    if (ok) onCerrarEdicion()
  }

  return (
    <div className="group flex items-center gap-2 px-2 sm:px-3 py-2.5 mt-1.5">
      {puedeEditar && dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="touch-none p-1 -ml-1 text-texto-terciario/60 hover:text-texto-secundario cursor-grab active:cursor-grabbing rounded"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar"
        >
          <GripVertical size={13} />
        </button>
      )}
      <Heading size={13} className="text-texto-marca shrink-0" />
      {enEdicion ? (
        <input
          type="text"
          value={tituloEd}
          onChange={e => setTituloEd(e.target.value)}
          onBlur={guardar}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); guardar() }
            if (e.key === 'Escape') onCerrarEdicion()
          }}
          autoFocus
          className="flex-1 px-2 py-1 rounded-card bg-superficie-app border border-texto-marca/40 text-sm font-semibold text-texto-primario uppercase tracking-wider focus:outline-none"
        />
      ) : (
        <h4
          className={`flex-1 text-sm font-semibold text-texto-primario uppercase tracking-wider ${puedeEditar ? 'cursor-text' : ''}`}
          onClick={() => puedeEditar && onAbrirEdicion()}
        >
          {tarea.titulo}
        </h4>
      )}
      {puedeEditar && !enEdicion && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onAbrirEdicion}
            className="p-1.5 rounded-card text-texto-terciario hover:text-texto-marca hover:bg-texto-marca/10 cursor-pointer border-none bg-transparent"
            title="Editar"
          >
            <Pencil size={11} />
          </button>
          {onEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              className="p-1.5 rounded-card text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 cursor-pointer border-none bg-transparent"
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FilaNota({
  tarea, puedeEditar, enEdicion, onAbrirEdicion, onCerrarEdicion, onGuardar,
  onEliminar, dragHandleProps,
}: PropsFilaTarea) {
  const [tituloEd, setTituloEd] = useState(tarea.titulo)
  const [detalleEd, setDetalleEd] = useState(tarea.descripcion_detalle || '')

  useEffect(() => {
    if (enEdicion) {
      setTituloEd(tarea.titulo)
      setDetalleEd(tarea.descripcion_detalle || '')
    }
  }, [enEdicion, tarea.titulo, tarea.descripcion_detalle])

  const guardar = async () => {
    const cambios: Partial<Pick<TareaOrden, 'titulo' | 'descripcion_detalle'>> = {}
    const t = tituloEd.trim()
    const d = detalleEd.trim()
    if (t && t !== tarea.titulo) cambios.titulo = t
    if (d !== (tarea.descripcion_detalle || '')) cambios.descripcion_detalle = d || null
    if (Object.keys(cambios).length === 0) {
      onCerrarEdicion()
      return
    }
    const ok = await onGuardar(cambios)
    if (ok) onCerrarEdicion()
  }

  return (
    <div className="group flex items-start gap-2 px-2 sm:px-3 py-2.5 my-1.5 rounded-card border-l-2 border-texto-marca/30 bg-texto-marca/[0.04]">
      {puedeEditar && dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="touch-none p-1 -ml-1 mt-0.5 text-texto-terciario/60 hover:text-texto-secundario cursor-grab active:cursor-grabbing rounded"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar"
        >
          <GripVertical size={13} />
        </button>
      )}
      <StickyNote size={13} className="text-texto-marca/70 shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        {enEdicion ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={tituloEd}
              onChange={e => setTituloEd(e.target.value)}
              autoFocus
              className="w-full px-2 py-1 rounded-card bg-superficie-app border border-texto-marca/40 text-sm text-texto-secundario italic focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardar() }
                if (e.key === 'Escape') onCerrarEdicion()
              }}
            />
            <textarea
              value={detalleEd}
              onChange={e => setDetalleEd(e.target.value)}
              placeholder="Detalle (opcional)"
              rows={2}
              className="w-full px-2 py-1 rounded-card bg-superficie-app border border-borde-sutil text-xs text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
            />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={onCerrarEdicion} className="px-2 py-0.5 rounded-card text-xs text-texto-terciario hover:bg-superficie-hover transition-colors cursor-pointer border-none bg-transparent">
                Cancelar
              </button>
              <button type="button" onClick={guardar} className="px-2 py-0.5 rounded-card bg-texto-marca/15 text-texto-marca text-xs font-medium hover:bg-texto-marca/25 transition-colors cursor-pointer border-none">
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p
              className={`text-sm text-texto-secundario italic whitespace-pre-wrap ${puedeEditar ? 'cursor-text' : ''}`}
              onClick={() => puedeEditar && onAbrirEdicion()}
            >
              {tarea.titulo}
            </p>
            {tarea.descripcion_detalle && (
              <p
                className={`text-xs text-texto-terciario whitespace-pre-wrap mt-0.5 ${puedeEditar ? 'cursor-text' : ''}`}
                onClick={() => puedeEditar && onAbrirEdicion()}
              >
                {tarea.descripcion_detalle}
              </p>
            )}
          </>
        )}
      </div>
      {puedeEditar && !enEdicion && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onAbrirEdicion}
            className="p-1.5 rounded-card text-texto-terciario hover:text-texto-marca hover:bg-texto-marca/10 cursor-pointer border-none bg-transparent"
            title="Editar"
          >
            <Pencil size={11} />
          </button>
          {onEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              className="p-1.5 rounded-card text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 cursor-pointer border-none bg-transparent"
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  Selector de responsables (sin cambios — copia del original)
// ──────────────────────────────────────────────────────────────────────────

function SelectorResponsables({
  miembros, seleccionados, onChange, max, abierto, onToggle, onCerrar,
}: {
  miembros: Miembro[]
  seleccionados: string[]
  onChange: (ids: string[]) => void
  max: number
  abierto: boolean
  onToggle: () => void
  onCerrar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto, onCerrar])
  const toggle = (uid: string) => {
    if (seleccionados.includes(uid)) onChange(seleccionados.filter(id => id !== uid))
    else if (seleccionados.length < max) onChange([...seleccionados, uid])
  }
  const nombresSeleccionados = seleccionados
    .map(uid => miembros.find(m => m.usuario_id === uid))
    .filter(Boolean)
    .map(m => m!.nombre)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-card bg-superficie-app border border-borde-sutil text-xs text-texto-secundario hover:border-texto-marca/40 transition-colors cursor-pointer"
      >
        <User size={12} className="text-texto-terciario" />
        {nombresSeleccionados.length > 0 ? nombresSeleccionados.join(', ') : 'Responsable (opcional)'}
        <ChevronDown size={11} className="text-texto-terciario" />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
          >
            {seleccionados.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-superficie-tarjeta text-insignia-peligro-texto border-none bg-transparent cursor-pointer"
              >
                Quitar todos
              </button>
            )}
            {miembros.map(m => {
              const activo = seleccionados.includes(m.usuario_id)
              const deshabilitado = !activo && seleccionados.length >= max
              return (
                <button
                  key={m.usuario_id}
                  type="button"
                  onClick={() => !deshabilitado && toggle(m.usuario_id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors border-none bg-transparent cursor-pointer ${
                    activo ? 'text-texto-marca font-medium bg-texto-marca/5' : deshabilitado ? 'text-texto-terciario/50 cursor-not-allowed' : 'text-texto-secundario hover:bg-superficie-tarjeta'
                  }`}
                  disabled={deshabilitado}
                >
                  {activo && <CheckCircle size={12} className="text-texto-marca" />}
                  {!activo && <User size={12} />}
                  {m.nombre} {m.apellido || ''}
                </button>
              )
            })}
            {seleccionados.length >= max && (
              <p className="px-3 py-1.5 text-[10px] text-texto-terciario">Máximo {max} responsables</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  Fila actividad (sin cambios — actividades viven en su propia tabla)
// ──────────────────────────────────────────────────────────────────────────

function FilaActividadCompacta({
  actividad, tipo, completada, puedeMarcar, onCompletar, onPosponer, onReactivar,
}: {
  actividad: Actividad
  tipo?: TipoActividad
  completada?: boolean
  puedeMarcar: boolean
  onCompletar?: () => void
  onPosponer?: () => void
  onReactivar?: () => void
}) {
  const formato = useFormato()
  const Icono = tipo ? obtenerIcono(tipo.icono) : null
  const vencida = actividad.fecha_vencimiento && new Date(actividad.fecha_vencimiento) < new Date() && !completada

  return (
    <div className={`flex items-start gap-3 px-3 py-3.5 rounded-card transition-colors border-b border-white/[0.04] last:border-b-0 ${completada ? 'opacity-50' : 'hover:bg-superficie-hover/50'}`}>
      {tipo && (
        <div
          className="w-8 h-8 rounded-card flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: tipo.color + '15', color: tipo.color }}
        >
          {Icono && <Icono size={14} />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
          {actividad.titulo}
        </p>
        {actividad.descripcion && !completada && (
          <p className="text-xs text-texto-terciario line-clamp-2 mt-0.5 whitespace-pre-wrap">
            {actividad.descripcion}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {actividad.fecha_vencimiento && (
            <span className={`text-xs ${vencida ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}`}>
              {formato.fecha(actividad.fecha_vencimiento, { corta: true })}
              {vencida && ' — vencida'}
            </span>
          )}
          {actividad.asignados && actividad.asignados.length > 0 && (
            <span className="text-xs text-texto-terciario flex items-center gap-1">
              <User size={10} />
              {actividad.asignados.map(a => a.nombre).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {!completada && puedeMarcar && onCompletar && (
          <button type="button" onClick={onCompletar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/5 text-insignia-exito-texto hover:bg-insignia-exito/15 active:scale-95">
            <CheckCircle size={14} />
            <span className="hidden sm:inline">Hecho</span>
          </button>
        )}
        {!completada && puedeMarcar && onPosponer && (
          <button type="button" onClick={onPosponer} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-advertencia/30 bg-transparent text-insignia-advertencia-texto hover:bg-insignia-advertencia/10 active:scale-95">
            <Clock size={14} />
          </button>
        )}
        {completada && puedeMarcar && onReactivar && (
          <button type="button" onClick={onReactivar} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-white/[0.1] bg-transparent text-texto-terciario hover:text-texto-primario hover:bg-white/[0.05] active:scale-95">
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reabrir</span>
          </button>
        )}
      </div>
    </div>
  )
}
