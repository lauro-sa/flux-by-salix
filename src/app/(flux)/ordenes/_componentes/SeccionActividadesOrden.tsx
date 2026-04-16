'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, CheckCircle, Clock, RotateCcw, Ban } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalActividad } from '../../actividades/_componentes/ModalActividad'
import type { Actividad, Miembro } from '../../actividades/_componentes/ModalActividad'
import type { TipoActividad } from '../../actividades/configuracion/secciones/SeccionTipos'
import type { EstadoActividad } from '../../actividades/configuracion/secciones/SeccionEstados'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

/**
 * SeccionActividadesOrden — Actividades vinculadas a una orden de trabajo.
 * Muestra progreso dinámico + lista de actividades pendientes/completadas.
 * Basado en SeccionActividadesContacto con barra de progreso adicional.
 */

interface PropiedadesSeccion {
  ordenId: string
  ordenNumero: string
  onProgresoChange?: (completadas: number, total: number) => void
}

export default function SeccionActividadesOrden({ ordenId, ordenNumero, onProgresoChange }: PropiedadesSeccion) {
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

      // Notificar progreso al componente padre
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

  // Crear tarea OT rápida (título + descripción, sin modal pesado)
  const crearTareaOT = async () => {
    if (!tituloTarea.trim() || creandoTarea) return
    setCreandoTarea(true)
    try {
      // Buscar tipo "tarea" y estado "pendiente"
      const tipoTarea = tipos.find(t => t.clave === 'tarea')
      const estadoPendiente = estados.find(e => e.clave === 'pendiente')
      if (!tipoTarea || !estadoPendiente) return

      const vinculosNuevaTarea = [
        { tipo: 'orden', id: ordenId, nombre: `OT #${ordenNumero}` },
      ]

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
          asignados: [],
        }),
      })
      setTituloTarea('')
      setDescripcionTarea('')
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

  // Separar tareas OT (auto-generadas) de actividades manuales
  const tareasOT = pendientes.filter(a => (a as Record<string, unknown>).es_tarea_ot === true)
  const actividadesManuales = pendientes.filter(a => (a as Record<string, unknown>).es_tarea_ot !== true)

  const totalActs = actividades.length
  const completadasCount = actividades.filter(a => a.estado_clave === 'completada').length
  const porcentaje = totalActs > 0 ? Math.round((completadasCount / totalActs) * 100) : 0

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
              {/* Barra de progreso */}
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
              <div className="flex items-center gap-2 justify-end">
                <Boton variante="fantasma" tamano="sm" onClick={() => setNuevaTarea(false)}>
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
          {/* Tareas del trabajo (auto-generadas desde el presupuesto) */}
          {tareasOT.map(act => (
            <FilaActividadCompacta
              key={act.id}
              actividad={act}
              tipo={tiposPorId[act.tipo_id]}
              esTareaOT
              onCompletar={() => completar(act.id)}
              onCancelar={() => abrirCancelar(act.id)}
            />
          ))}

          {/* Separador si hay ambos tipos */}
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
              onCompletar={() => completar(act.id)}
              onPosponer={() => posponer(act.id)}
            />
          ))}

          {/* Completadas/canceladas — siempre visibles, atenuadas */}
          {completadas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] opacity-50 space-y-0.5">
              {completadas.map(act => (
                <FilaActividadCompacta
                  key={act.id}
                  actividad={act}
                  tipo={tiposPorId[act.tipo_id]}
                  completada
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

      {/* Modal de crear actividad pre-vinculada a esta orden */}
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

// ── Fila compacta de actividad ──

function FilaActividadCompacta({
  actividad,
  tipo,
  completada,
  esTareaOT,
  onCompletar,
  onPosponer,
  onCancelar,
  onReactivar,
}: {
  actividad: Actividad
  tipo?: TipoActividad
  completada?: boolean
  esTareaOT?: boolean
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
        <div className="flex items-center gap-2 mt-1">
          {actividad.fecha_vencimiento && (
            <span className={`text-xs ${vencida ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}`}>
              {formato.fecha(actividad.fecha_vencimiento, { corta: true })}
              {vencida && ' — vencida'}
            </span>
          )}
          {actividad.asignados?.[0] && (
            <span className="text-xs text-texto-terciario">
              · {actividad.asignados[0].nombre}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {!completada && onCompletar && (
          <button
            type="button"
            onClick={onCompletar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/5 text-insignia-exito-texto hover:bg-insignia-exito/15 active:scale-95"
          >
            <CheckCircle size={14} />
            <span className="hidden sm:inline">Hecho</span>
          </button>
        )}
        {!completada && !esTareaOT && onPosponer && (
          <button
            type="button"
            onClick={onPosponer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-advertencia/30 bg-transparent text-insignia-advertencia-texto hover:bg-insignia-advertencia/10 active:scale-95"
          >
            <Clock size={14} />
          </button>
        )}
        {!completada && onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-insignia-peligro/20 bg-transparent text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 active:scale-95"
          >
            <Ban size={13} />
          </button>
        )}
        {completada && onReactivar && (
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
