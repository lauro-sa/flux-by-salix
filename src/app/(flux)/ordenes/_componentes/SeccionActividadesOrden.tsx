'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, CheckCircle, Clock, RotateCcw, Ban, User, Calendar, ChevronDown } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalActividad } from '../../actividades/_componentes/ModalActividad'
import type { Actividad, Miembro } from '../../actividades/_componentes/ModalActividad'
import type { TipoActividad } from '../../actividades/configuracion/_tipos'
import type { EstadoActividad } from '../../actividades/configuracion/secciones/SeccionEstados'
import type { AsignadoOrdenTrabajo } from '@/tipos/orden-trabajo'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useMiembrosAsignables } from '@/hooks/useMiembrosAsignables'

/**
 * SeccionActividadesOrden — Tareas y actividades vinculadas a una orden de trabajo.
 * Las tareas vienen de tareas_orden (entidad propia), las actividades de la tabla actividades.
 * Muestra progreso dinámico + lista con responsables opcionales.
 */

// Tipo para tareas de orden de trabajo (tabla tareas_orden)
interface TareaOrden {
  id: string
  orden_trabajo_id: string
  titulo: string
  descripcion: string | null
  estado: 'pendiente' | 'completada' | 'cancelada'
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
  /** True si el user es admin, creador o cabecilla. Determina si puede marcar cualquier tarea. */
  puedeGestionar: boolean
  /** True solo si es gestor Y la OT está en borrador: permite crear/editar/cancelar tareas. */
  puedeEditar: boolean
  /** Publicación de la OT. Asignados comunes solo marcan tareas en OTs publicadas. */
  publicada: boolean
  onProgresoChange?: (completadas: number, total: number) => void
}

export default function SeccionActividadesOrden({
  ordenId, ordenNumero, asignadosOT, usuarioActualId, puedeGestionar, puedeEditar, publicada,
  onProgresoChange,
}: PropiedadesSeccion) {
  const { t } = useTraduccion()
  const [tareas, setTareas] = useState<TareaOrden[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const { data: miembros = [] } = useMiembrosAsignables()
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
  const [cancelarTipo, setCancelarTipo] = useState<'tarea' | 'actividad'>('tarea')
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [nuevaTarea, setNuevaTarea] = useState(false)
  const [tituloTarea, setTituloTarea] = useState('')
  const [descripcionTarea, setDescripcionTarea] = useState('')
  const [fechaTarea, setFechaTarea] = useState('')
  const [responsablesTarea, setResponsablesTarea] = useState<string[]>([])
  const [menuResponsablesTarea, setMenuResponsablesTarea] = useState(false)
  const [creandoTarea, setCreandoTarea] = useState(false)

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

      // Progreso: combinar tareas + actividades
      const totalTareas = tareasOT.length
      const tareasCompletadas = tareasOT.filter((t: TareaOrden) => t.estado === 'completada').length
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

  // Acciones sobre tareas (tabla tareas_orden)
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

  // Acciones sobre actividades (tabla actividades)
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

  // Responsables de la OT (es_cabecilla = true)
  const responsablesOT = asignadosOT.filter(a => a.es_cabecilla)
  const esResponsableOT = responsablesOT.some(a => a.usuario_id === usuarioActualId)

  // Determinar si el usuario actual puede marcar una tarea como hecha.
  // Para no-gestores requiere OT publicada (coherente con backend).
  const puedeMarcarTarea = (tarea: TareaOrden): boolean => {
    if (puedeGestionar) return true
    if (!usuarioActualId || !publicada) return false

    const asignadosTarea = tarea.asignados || []
    if (asignadosTarea.length > 0) {
      return asignadosTarea.some(a => a.id === usuarioActualId)
    }
    return esResponsableOT
  }

  // Determinar si puede marcar una actividad
  const puedeMarcarActividad = (actividad: Actividad): boolean => {
    if (puedeGestionar) return true
    if (!usuarioActualId || !publicada) return false

    const asignadosActividad = actividad.asignados || []
    if (asignadosActividad.length > 0) {
      return asignadosActividad.some(a => a.id === usuarioActualId)
    }
    return esResponsableOT
  }

  // Crear tarea OT rápida
  const crearTareaOT = async () => {
    if (!tituloTarea.trim() || creandoTarea) return
    setCreandoTarea(true)
    try {
      const asignadosTarea = responsablesTarea.map(uid => {
        const miembro = miembros.find(m => m.usuario_id === uid)
        return miembro ? { id: miembro.usuario_id, nombre: `${miembro.nombre} ${miembro.apellido || ''}`.trim() } : null
      }).filter(Boolean)

      await fetch(`/api/ordenes/${ordenId}/tareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloTarea.trim(),
          descripcion: descripcionTarea.trim() || null,
          asignados: asignadosTarea,
          fecha_vencimiento: fechaTarea || null,
        }),
      })
      setTituloTarea('')
      setDescripcionTarea('')
      setFechaTarea('')
      setResponsablesTarea([])
      setNuevaTarea(false)
      cargar()
    } catch {
      console.error('Error al crear tarea')
    } finally {
      setCreandoTarea(false)
    }
  }

  // Separar tareas y actividades por estado
  const tareasPendientes = tareas.filter(t => t.estado === 'pendiente')
  const tareasFinalizadas = tareas.filter(t => t.estado === 'completada' || t.estado === 'cancelada')
  const tiposPorId = Object.fromEntries(tipos.map(t => [t.id, t]))
  const actividadesPendientes = actividades.filter(a => a.estado_clave !== 'completada' && a.estado_clave !== 'cancelada')
  const actividadesFinalizadas = actividades.filter(a => a.estado_clave === 'completada' || a.estado_clave === 'cancelada')

  const totalItems = tareas.length + actividades.length
  const completadasCount = tareas.filter(t => t.estado === 'completada').length +
    actividades.filter(a => a.estado_clave === 'completada').length
  const porcentaje = totalItems > 0 ? Math.round((completadasCount / totalItems) * 100) : 0

  // Miembros que son asignados a la OT (para selector de responsables)
  const miembrosAsignadosOT = miembros.filter(m => asignadosOT.some(a => a.usuario_id === m.usuario_id))
  const miembrosParaResponsables = miembrosAsignadosOT.length > 0 ? miembrosAsignadosOT : miembros

  return (
    <section>
      {/* Header con progreso */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
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
          <div className="flex items-center gap-1.5 shrink-0">
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<PlusCircle size={13} />}
              onClick={() => { setNuevaTarea(true); setModalAbierto(false) }}
            >
              Tarea
            </Boton>
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<PlusCircle size={13} />}
              onClick={() => { setModalAbierto(true); setNuevaTarea(false) }}
            >
              Actividad
            </Boton>
          </div>
        )}
      </div>

      {/* Formulario inline para nueva tarea OT */}
      <AnimatePresence>
        {nuevaTarea && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-3 rounded-card border border-texto-marca/20 bg-texto-marca/5 space-y-2.5">
              <input
                type="text"
                value={tituloTarea}
                onChange={e => setTituloTarea(e.target.value)}
                placeholder="Título de la tarea..."
                className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && crearTareaOT()}
              />
              <textarea
                value={descripcionTarea}
                onChange={e => setDescripcionTarea(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
                rows={2}
              />

              {/* Fila: Fecha + Responsables */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-texto-terciario" />
                  <input
                    type="date"
                    value={fechaTarea}
                    onChange={e => setFechaTarea(e.target.value)}
                    className="px-2 py-1.5 rounded-card bg-superficie-app border border-borde-sutil text-xs text-texto-primario focus:outline-none focus:border-texto-marca"
                  />
                </div>

                <SelectorResponsables
                  miembros={miembrosParaResponsables}
                  seleccionados={responsablesTarea}
                  onChange={setResponsablesTarea}
                  max={2}
                  abierto={menuResponsablesTarea}
                  onToggle={() => setMenuResponsablesTarea(v => !v)}
                  onCerrar={() => setMenuResponsablesTarea(false)}
                />
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Boton variante="fantasma" tamano="sm" onClick={() => { setNuevaTarea(false); setResponsablesTarea([]) }}>
                  Cancelar
                </Boton>
                <Boton variante="primario" tamano="sm" onClick={crearTareaOT} disabled={!tituloTarea.trim() || creandoTarea}>
                  Crear tarea
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      {cargando ? (
        <div className="py-4 text-center text-xs text-texto-terciario">Cargando...</div>
      ) : totalItems === 0 ? (
        <div className="py-6 text-center text-xs text-texto-terciario">
          {t('ordenes.sin_actividades')}
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Tareas de la orden */}
          {tareasPendientes.map(tarea => (
            <FilaTareaOrden
              key={tarea.id}
              tarea={tarea}
              puedeMarcar={puedeMarcarTarea(tarea)}
              puedeCancelar={puedeEditar}
              onCompletar={() => completarTarea(tarea.id)}
              onCancelar={() => abrirCancelar(tarea.id, 'tarea')}
            />
          ))}

          {/* Separador entre tareas y actividades */}
          {tareasPendientes.length > 0 && actividadesPendientes.length > 0 && (
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

          {/* Finalizadas (tareas + actividades) */}
          {(tareasFinalizadas.length > 0 || actividadesFinalizadas.length > 0) && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] opacity-50 space-y-0.5">
              {tareasFinalizadas.map(tarea => (
                <FilaTareaOrden
                  key={tarea.id}
                  tarea={tarea}
                  completada
                  puedeMarcar={puedeMarcarTarea(tarea)}
                  puedeCancelar={puedeEditar}
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

      {/* Mini modal de cancelación */}
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
              placeholder="¿Por qué se cancela esta tarea? (opcional)"
              className="w-full px-3 py-2 rounded-card bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Boton variante="fantasma" tamano="sm" onClick={() => setCancelarId(null)}>
                Volver
              </Boton>
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

      {/* Modal de crear actividad */}
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

// ── Selector de responsables (hasta 2) ──

function SelectorResponsables({
  miembros,
  seleccionados,
  onChange,
  max,
  abierto,
  onToggle,
  onCerrar,
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
    if (seleccionados.includes(uid)) {
      onChange(seleccionados.filter(id => id !== uid))
    } else if (seleccionados.length < max) {
      onChange([...seleccionados, uid])
    }
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
        {nombresSeleccionados.length > 0
          ? nombresSeleccionados.join(', ')
          : 'Responsable (opcional)'
        }
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

// ── Fila compacta de tarea de orden ──

function FilaTareaOrden({
  tarea,
  completada,
  puedeMarcar,
  puedeCancelar,
  onCompletar,
  onCancelar,
  onReactivar,
}: {
  tarea: TareaOrden
  completada?: boolean
  puedeMarcar: boolean
  puedeCancelar: boolean
  onCompletar?: () => void
  onCancelar?: () => void
  onReactivar?: () => void
}) {
  const formato = useFormato()
  const vencida = tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date() && !completada

  return (
    <div className={`flex items-start gap-3 px-3 py-3.5 rounded-card transition-colors border-b border-white/[0.04] last:border-b-0 ${completada ? 'opacity-50' : 'hover:bg-superficie-hover/50'}`}>
      <div
        className="w-8 h-8 rounded-card flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: 'var(--texto-marca)' + '15', color: 'var(--texto-marca)' }}
      >
        <CheckCircle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
          {tarea.titulo}
        </p>
        {tarea.descripcion && !completada && (
          <p className="text-xs text-texto-terciario line-clamp-2 mt-0.5 whitespace-pre-wrap">
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
      </div>
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
        {!completada && puedeCancelar && onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-peligro/20 bg-transparent text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 active:scale-95"
          >
            <Ban size={13} />
          </button>
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
    </div>
  )
}

// ── Fila compacta de actividad ──

function FilaActividadCompacta({
  actividad,
  tipo,
  completada,
  puedeMarcar,
  onCompletar,
  onPosponer,
  onReactivar,
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
          <button
            type="button"
            onClick={onCompletar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/5 text-insignia-exito-texto hover:bg-insignia-exito/15 active:scale-95"
          >
            <CheckCircle size={14} />
            <span className="hidden sm:inline">Hecho</span>
          </button>
        )}
        {!completada && puedeMarcar && onPosponer && (
          <button
            type="button"
            onClick={onPosponer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border border-insignia-advertencia/30 bg-transparent text-insignia-advertencia-texto hover:bg-insignia-advertencia/10 active:scale-95"
          >
            <Clock size={14} />
          </button>
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
    </div>
  )
}
