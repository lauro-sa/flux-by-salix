'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, CheckCircle, Clock, RotateCcw, Ban, User, Calendar, ChevronDown } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalActividad } from '../../actividades/_componentes/ModalActividad'
import type { Actividad, Miembro } from '../../actividades/_componentes/ModalActividad'
import type { TipoActividad } from '../../actividades/configuracion/secciones/SeccionTipos'
import type { EstadoActividad } from '../../actividades/configuracion/secciones/SeccionEstados'
import type { AsignadoOrdenTrabajo } from '@/tipos/orden-trabajo'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

/**
 * SeccionActividadesOrden — Actividades vinculadas a una orden de trabajo.
 * Muestra progreso dinámico + lista de actividades con responsables opcionales.
 * Solo los responsables asignados (o cabecilla/admin) pueden marcar como hecha.
 */

interface PropiedadesSeccion {
  ordenId: string
  ordenNumero: string
  asignadosOT: AsignadoOrdenTrabajo[]
  usuarioActualId: string | null
  puedeEditarEstado: boolean
  onProgresoChange?: (completadas: number, total: number) => void
}

export default function SeccionActividadesOrden({
  ordenId, ordenNumero, asignadosOT, usuarioActualId, puedeEditarEstado,
  onProgresoChange,
}: PropiedadesSeccion) {
  const { t } = useTraduccion()
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cancelarId, setCancelarId] = useState<string | null>(null)
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
      const [actRes, configRes, miembrosData] = await Promise.all([
        fetch(`/api/actividades?orden_trabajo_id=${ordenId}&por_pagina=50`).then(r => r.json()),
        fetch('/api/actividades/config').then(r => r.json()),
        (async () => {
          const supabase = crearClienteNavegador()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return []
          const empresaId = user.app_metadata?.empresa_activa_id
          if (!empresaId) return []
          const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
          if (!mRes?.length) return []
          const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
          return (perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido }))
        })(),
      ])
      const acts = actRes.actividades || []
      setActividades(acts)
      setTipos(configRes.tipos || [])
      setEstados(configRes.estados || [])
      setMiembros(miembrosData)

      const completadas = acts.filter((a: Actividad) => a.estado_clave === 'completada').length
      onProgresoChange?.(completadas, acts.length)
    } catch {
      console.error('Error al cargar actividades de la orden')
    } finally {
      setCargando(false)
    }
  }, [ordenId, onProgresoChange])

  useEffect(() => { cargar() }, [cargar])

  const crearActividad = async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear')
    cargar()
  }

  const completar = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    cargar()
  }

  const posponer = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'posponer', dias: 1 }),
    })
    cargar()
  }

  const reactivar = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'reactivar' }),
    })
    cargar()
  }

  const abrirCancelar = (id: string) => {
    setCancelarId(id)
    setMotivoCancelacion('')
  }

  const confirmarCancelar = async () => {
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

  // Responsables de la OT (es_cabecilla = true)
  const responsablesOT = asignadosOT.filter(a => a.es_cabecilla)
  const esResponsableOT = responsablesOT.some(a => a.usuario_id === usuarioActualId)

  // Determinar si el usuario actual puede marcar una actividad/tarea como hecha
  const puedeMarcar = (actividad: Actividad): boolean => {
    // Admin siempre puede
    if (puedeEditarEstado) return true
    if (!usuarioActualId) return false

    const asignadosActividad = actividad.asignados || []
    const esTarea = actividad.es_tarea_ot === true

    if (esTarea) {
      // Tareas OT: si tiene asignados específicos, solo ellos
      if (asignadosActividad.length > 0) {
        return asignadosActividad.some(a => a.id === usuarioActualId)
      }
      // Sin asignados → solo los responsables de la OT
      return esResponsableOT
    }

    // Actividades: solo su asignado puede completarla
    if (asignadosActividad.length > 0) {
      return asignadosActividad.some(a => a.id === usuarioActualId)
    }
    // Actividad sin asignado → responsables de la OT
    return esResponsableOT
  }

  // Crear tarea OT rápida con fecha y responsables opcionales
  const crearTareaOT = async () => {
    if (!tituloTarea.trim() || creandoTarea) return
    setCreandoTarea(true)
    try {
      const tipoTarea = tipos.find(t => t.clave === 'tarea')
      const estadoPendiente = estados.find(e => e.clave === 'pendiente')
      if (!tipoTarea || !estadoPendiente) return

      const vinculosNuevaTarea = [
        { tipo: 'orden', id: ordenId, nombre: `OT #${ordenNumero}` },
      ]

      // Construir asignados para la tarea
      const asignadosTarea = responsablesTarea.map(uid => {
        const miembro = miembros.find(m => m.usuario_id === uid)
        return miembro ? { usuario_id: miembro.usuario_id, nombre: miembro.nombre, apellido: miembro.apellido || '' } : null
      }).filter(Boolean)

      await fetch('/api/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloTarea.trim(),
          descripcion: descripcionTarea.trim() || null,
          tipo_id: tipoTarea.id,
          estado_id: estadoPendiente.id,
          vinculos: vinculosNuevaTarea,
          es_tarea_ot: true,
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

  const tiposPorId = Object.fromEntries(tipos.map(t => [t.id, t]))
  const pendientes = actividades.filter(a => a.estado_clave !== 'completada' && a.estado_clave !== 'cancelada')
  const completadas = actividades.filter(a => a.estado_clave === 'completada' || a.estado_clave === 'cancelada')

  const tareasOT = pendientes.filter(a => a.es_tarea_ot === true)
  const actividadesManuales = pendientes.filter(a => !a.es_tarea_ot)

  const totalActs = actividades.length
  const completadasCount = actividades.filter(a => a.estado_clave === 'completada').length
  const porcentaje = totalActs > 0 ? Math.round((completadasCount / totalActs) * 100) : 0

  // Miembros que son asignados a la OT (para selector de responsables)
  const miembrosAsignadosOT = miembros.filter(m => asignadosOT.some(a => a.usuario_id === m.usuario_id))
  // Si no hay asignados OT, mostrar todos los miembros
  const miembrosParaResponsables = miembrosAsignadosOT.length > 0 ? miembrosAsignadosOT : miembros

  return (
    <section>
      {/* Header con progreso */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider shrink-0">
            {t('ordenes.progreso_actividades')}
          </h3>
          {totalActs > 0 && (
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
                {completadasCount}/{totalActs}
              </span>
            </div>
          )}
        </div>
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
            <div className="mb-4 p-3 rounded-lg border border-texto-marca/20 bg-texto-marca/5 space-y-2.5">
              <input
                type="text"
                value={tituloTarea}
                onChange={e => setTituloTarea(e.target.value)}
                placeholder="Título de la tarea..."
                className="w-full px-3 py-2 rounded-lg bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && crearTareaOT()}
              />
              <textarea
                value={descripcionTarea}
                onChange={e => setDescripcionTarea(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 rounded-lg bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
                rows={2}
              />

              {/* Fila: Fecha + Responsables */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Fecha */}
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-texto-terciario" />
                  <input
                    type="date"
                    value={fechaTarea}
                    onChange={e => setFechaTarea(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-superficie-app border border-borde-sutil text-xs text-texto-primario focus:outline-none focus:border-texto-marca"
                  />
                </div>

                {/* Responsables (hasta 2) */}
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

      {/* Lista de actividades */}
      {cargando ? (
        <div className="py-4 text-center text-xs text-texto-terciario">Cargando...</div>
      ) : totalActs === 0 ? (
        <div className="py-6 text-center text-xs text-texto-terciario">
          {t('ordenes.sin_actividades')}
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Tareas del trabajo */}
          {tareasOT.map(act => (
            <FilaActividadCompacta
              key={act.id}
              actividad={act}
              tipo={tiposPorId[act.tipo_id]}
              esTareaOT
              puedeMarcar={puedeMarcar(act)}
              onCompletar={() => completar(act.id)}
              onCancelar={() => abrirCancelar(act.id)}
            />
          ))}

          {/* Separador */}
          {tareasOT.length > 0 && actividadesManuales.length > 0 && (
            <div className="pt-3 pb-1 border-t border-white/[0.06] mt-2">
              <p className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">Actividades</p>
            </div>
          )}

          {/* Actividades manuales */}
          {actividadesManuales.map(act => (
            <FilaActividadCompacta
              key={act.id}
              actividad={act}
              tipo={tiposPorId[act.tipo_id]}
              puedeMarcar={puedeMarcar(act)}
              onCompletar={() => completar(act.id)}
              onPosponer={() => posponer(act.id)}
            />
          ))}

          {/* Completadas/canceladas */}
          {completadas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] opacity-50 space-y-0.5">
              {completadas.map(act => (
                <FilaActividadCompacta
                  key={act.id}
                  actividad={act}
                  tipo={tiposPorId[act.tipo_id]}
                  completada
                  puedeMarcar={puedeMarcar(act)}
                  onReactivar={() => reactivar(act.id)}
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
            className="mt-3 p-4 rounded-lg border border-insignia-peligro/20 bg-insignia-peligro/5 space-y-3"
          >
            <p className="text-sm font-medium text-texto-primario">Motivo de cancelación</p>
            <textarea
              value={motivoCancelacion}
              onChange={e => setMotivoCancelacion(e.target.value)}
              placeholder="¿Por qué se cancela esta tarea? (opcional)"
              className="w-full px-3 py-2 rounded-lg bg-superficie-app border border-borde-sutil text-sm text-texto-primario placeholder:text-texto-terciario resize-none focus:outline-none focus:border-texto-marca"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Boton variante="fantasma" tamano="sm" onClick={() => setCancelarId(null)}>
                Volver
              </Boton>
              <Boton variante="peligro" tamano="sm" icono={<Ban size={14} />} onClick={confirmarCancelar}>
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
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-superficie-app border border-borde-sutil text-xs text-texto-secundario hover:border-texto-marca/40 transition-colors cursor-pointer"
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
            className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
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

// ── Fila compacta de actividad ──

function FilaActividadCompacta({
  actividad,
  tipo,
  completada,
  esTareaOT,
  puedeMarcar,
  onCompletar,
  onPosponer,
  onCancelar,
  onReactivar,
}: {
  actividad: Actividad
  tipo?: TipoActividad
  completada?: boolean
  esTareaOT?: boolean
  puedeMarcar: boolean
  onCompletar?: () => void
  onPosponer?: () => void
  onCancelar?: () => void
  onReactivar?: () => void
}) {
  const formato = useFormato()
  const Icono = tipo ? obtenerIcono(tipo.icono) : null
  const vencida = actividad.fecha_vencimiento && new Date(actividad.fecha_vencimiento) < new Date() && !completada

  return (
    <div className={`flex items-start gap-3 px-3 py-3.5 rounded-lg transition-colors border-b border-white/[0.04] last:border-b-0 ${completada ? 'opacity-50' : 'hover:bg-superficie-hover/50'}`}>
      {tipo && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
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
          {/* Mostrar responsables de la actividad */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/5 text-insignia-exito-texto hover:bg-insignia-exito/15 active:scale-95"
          >
            <CheckCircle size={14} />
            <span className="hidden sm:inline">Hecho</span>
          </button>
        )}
        {!completada && !esTareaOT && puedeMarcar && onPosponer && (
          <button
            type="button"
            onClick={onPosponer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-advertencia/30 bg-transparent text-insignia-advertencia-texto hover:bg-insignia-advertencia/10 active:scale-95"
          >
            <Clock size={14} />
          </button>
        )}
        {!completada && puedeMarcar && onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-peligro/20 bg-transparent text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 active:scale-95"
          >
            <Ban size={13} />
          </button>
        )}
        {completada && puedeMarcar && onReactivar && (
          <button
            type="button"
            onClick={onReactivar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-white/[0.1] bg-transparent text-texto-terciario hover:text-texto-primario hover:bg-white/[0.05] active:scale-95"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reabrir</span>
          </button>
        )}
      </div>
    </div>
  )
}
