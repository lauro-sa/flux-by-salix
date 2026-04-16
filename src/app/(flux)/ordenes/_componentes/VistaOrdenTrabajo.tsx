'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, User, ExternalLink, Loader2, X, Phone, MessageCircle, MapPin, Crown, Plus, Bell } from 'lucide-react'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import CabeceraOrden from './CabeceraOrden'
import SeccionActividadesOrden from './SeccionActividadesOrden'
import { ETIQUETAS_ESTADO_OT } from '@/tipos/orden-trabajo'
import type { OrdenTrabajo, EstadoOrdenTrabajo, AsignadoOrdenTrabajo } from '@/tipos/orden-trabajo'

/**
 * VistaOrdenTrabajo — Vista detalle completa de una orden de trabajo.
 * Diseño operativo: contacto con acciones rápidas, múltiples asignados con responsable,
 * publicar/despublicar, actividades como progreso, chatter.
 */

interface Props {
  ordenId: string
}

interface MiembroEquipo {
  id: string
  nombre: string
}

export default function VistaOrdenTrabajo({ ordenId }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const router = useRouter()
  const { mostrar: mostrarToast } = useToast()

  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [asignados, setAsignados] = useState<AsignadoOrdenTrabajo[]>([])
  const [progreso, setProgreso] = useState({ total_actividades: 0, completadas: 0, porcentaje: 0 })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [menuAsignadosAbierto, setMenuAsignadosAbierto] = useState(false)
  const refMenuAsignados = useRef<HTMLDivElement>(null)
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null)
  const [rolUsuario, setRolUsuario] = useState<string | null>(null)
  const [esSuperadmin, setEsSuperadmin] = useState(false)

  // Cargar miembros del equipo + datos del usuario actual
  useEffect(() => {
    (async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUsuarioActualId(user.id)
      setRolUsuario(user.app_metadata?.rol || null)
      setEsSuperadmin(user.app_metadata?.es_superadmin || false)
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return
      const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
      if (!mRes?.length) return
      const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
      setMiembros((perfiles || []).map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido || ''}`.trim() })))
    })()
  }, [])

  // Cerrar dropdown de asignados al hacer click fuera
  useEffect(() => {
    if (!menuAsignadosAbierto) return
    const cerrar = (e: MouseEvent) => {
      if (refMenuAsignados.current && !refMenuAsignados.current.contains(e.target as Node)) {
        setMenuAsignadosAbierto(false)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuAsignadosAbierto])

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`)
      if (!res.ok) { router.push('/ordenes'); return }
      const data = await res.json()
      setOrden(data.orden)
      setAsignados(data.asignados || [])
      setProgreso(data.progreso || { total_actividades: 0, completadas: 0, porcentaje: 0 })
    } catch {
      mostrarToast('error', 'Error al cargar la orden')
    } finally {
      setCargando(false)
    }
  }, [ordenId, router, mostrarToast])

  useEffect(() => { cargar() }, [cargar])

  // ── Permisos derivados ──
  const esResponsable = asignados.some(a => a.usuario_id === usuarioActualId && a.es_cabecilla)
  const esCreador = orden?.creado_por === usuarioActualId
  const esAdmin = ['propietario', 'administrador', 'gerente'].includes(rolUsuario || '') || esSuperadmin
  const puedeEditarEstado = esAdmin || esResponsable || esCreador

  // ── Cambiar estado ──
  const cambiarEstado = async (nuevoEstado: EstadoOrdenTrabajo) => {
    if (!orden) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) {
        const err = await res.json()
        mostrarToast('error', err.error || 'Error al cambiar estado')
        return
      }
      const ordenActualizada = await res.json()
      setOrden(ordenActualizada)
      mostrarToast('exito', `Estado cambiado a ${ETIQUETAS_ESTADO_OT[nuevoEstado]}`)
      cargar()
    } catch {
      mostrarToast('error', 'Error al cambiar estado')
    } finally {
      setGuardando(false)
    }
  }

  // ── Publicar / Despublicar ──
  const publicar = async () => {
    if (!orden) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicada: true }),
      })
      if (res.ok) {
        const actualizada = await res.json()
        setOrden(actualizada)
        mostrarToast('exito', 'Orden publicada')
      }
    } catch {
      mostrarToast('error', 'Error al publicar')
    } finally {
      setGuardando(false)
    }
  }

  const despublicar = async () => {
    if (!orden) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicada: false }),
      })
      if (res.ok) {
        const actualizada = await res.json()
        setOrden(actualizada)
        mostrarToast('exito', 'Orden despublicada (modo borrador)')
      }
    } catch {
      mostrarToast('error', 'Error al despublicar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Gestionar asignados ──
  const agregarAsignado = async (miembro: MiembroEquipo) => {
    if (asignados.some(a => a.usuario_id === miembro.id)) return
    const nuevosAsignados = [
      ...asignados.map(a => ({
        usuario_id: a.usuario_id,
        usuario_nombre: a.usuario_nombre,
        es_cabecilla: a.es_cabecilla,
      })),
      {
        usuario_id: miembro.id,
        usuario_nombre: miembro.nombre,
        es_cabecilla: asignados.length === 0, // primer asignado es responsable por defecto
      },
    ]
    await guardarAsignados(nuevosAsignados)
  }

  const quitarAsignado = async (usuarioId: string) => {
    const restantes = asignados
      .filter(a => a.usuario_id !== usuarioId)
      .map(a => ({
        usuario_id: a.usuario_id,
        usuario_nombre: a.usuario_nombre,
        es_cabecilla: a.es_cabecilla,
      }))
    // Si se quitó al responsable, promover al primero
    if (restantes.length > 0 && !restantes.some(a => a.es_cabecilla)) {
      restantes[0].es_cabecilla = true
    }
    await guardarAsignados(restantes)
  }

  const toggleResponsable = async (usuarioId: string) => {
    const actual = asignados.find(a => a.usuario_id === usuarioId)
    if (!actual) return
    const yaEsResponsable = actual.es_cabecilla
    const responsablesActuales = asignados.filter(a => a.es_cabecilla).length

    // Si ya es responsable y hay más de 1, quitar
    // Si no es responsable y hay menos de 2, agregar
    if (yaEsResponsable && responsablesActuales <= 1) {
      mostrarToast('error', 'Debe haber al menos 1 responsable')
      return
    }
    if (!yaEsResponsable && responsablesActuales >= 2) {
      mostrarToast('error', 'Máximo 2 responsables')
      return
    }

    const actualizados = asignados.map(a => ({
      usuario_id: a.usuario_id,
      usuario_nombre: a.usuario_nombre,
      es_cabecilla: a.usuario_id === usuarioId ? !yaEsResponsable : a.es_cabecilla,
    }))
    await guardarAsignados(actualizados)
  }

  const guardarAsignados = async (nuevosAsignados: { usuario_id: string; usuario_nombre: string; es_cabecilla: boolean }[]) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignados: nuevosAsignados }),
      })
      if (res.ok) {
        cargar()
      }
    } catch {
      mostrarToast('error', 'Error al actualizar asignados')
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar fecha (autoguardado) ──
  const guardarFecha = async (campo: 'fecha_inicio' | 'fecha_fin_estimada', valor: string | null) => {
    if (!orden) return
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor }),
      })
      if (res.ok) {
        const actualizada = await res.json()
        setOrden(actualizada)
      }
    } catch {
      mostrarToast('error', 'Error al guardar fecha')
    }
  }

  // Progreso callback
  const handleProgresoChange = useCallback((completadas: number, total: number) => {
    setProgreso({
      total_actividades: total,
      completadas,
      porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
    })
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 size={24} className="animate-spin text-texto-terciario" />
      </div>
    )
  }

  if (!orden) return null

  // Miembros que no están asignados (para el selector)
  const miembrosDisponibles = miembros.filter(m => !asignados.some(a => a.usuario_id === m.id))

  return (
    <div className="min-h-screen bg-superficie-app">
      {/* Cabecera */}
      <CabeceraOrden
        numero={orden.numero}
        titulo={orden.titulo}
        estado={orden.estado}
        prioridad={orden.prioridad}
        publicada={orden.publicada}
        puedeEditarEstado={puedeEditarEstado}
        onCambiarEstado={cambiarEstado}
        onPublicar={publicar}
        onDespublicar={despublicar}
        guardando={guardando}
      />

      {/* Barra de progreso global */}
      {progreso.total_actividades > 0 && (
        <div className="border-b border-borde-sutil bg-superficie-tarjeta/50 px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-bold" style={{ color: progreso.porcentaje === 100 ? 'var(--insignia-exito)' : 'var(--texto-marca)' }}>
                {progreso.porcentaje}%
              </span>
            </div>
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full transition-colors"
                style={{ backgroundColor: progreso.porcentaje === 100 ? 'var(--insignia-exito)' : 'var(--texto-marca)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progreso.porcentaje}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-sm text-texto-terciario shrink-0">
              {progreso.completadas} de {progreso.total_actividades} actividad{progreso.total_actividades !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Ficha operativa ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Card principal: contacto + datos clave */}
        <div className="rounded-xl border border-borde-sutil bg-superficie-tarjeta p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_auto] gap-5">

            {/* Lado izquierdo: contacto + acciones rápidas */}
            <div className="space-y-3">
              {orden.contacto_nombre && (
                <p className="text-lg font-semibold text-texto-primario">{orden.contacto_nombre}</p>
              )}

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap gap-2">
                {orden.contacto_telefono && (
                  <a href={`tel:${orden.contacto_telefono.replace(/[^+\d]/g, '')}`}>
                    <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent text-texto-secundario hover:bg-superficie-hover/50 active:scale-95">
                      <Phone size={14} />
                      {t('ordenes.llamar')}
                    </button>
                  </a>
                )}
                {(orden.contacto_whatsapp || orden.contacto_telefono) && (
                  <a href={`https://wa.me/${(orden.contacto_whatsapp || orden.contacto_telefono || '').replace(/[^+\d]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent hover:bg-superficie-hover/50 active:scale-95" style={{ color: 'var(--canal-whatsapp)' }}>
                      <MessageCircle size={14} />
                      {t('ordenes.whatsapp')}
                    </button>
                  </a>
                )}
                {orden.contacto_direccion && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orden.contacto_direccion)}`} target="_blank" rel="noopener noreferrer">
                    <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent text-texto-secundario hover:bg-superficie-hover/50 active:scale-95">
                      <MapPin size={14} />
                      {t('ordenes.ver_mapa')}
                    </button>
                  </a>
                )}
                {/* Avisar llegada — prioridad: atención (dirigido a) > contacto principal */}
                {(orden.contacto_nombre || orden.atencion_nombre) && (() => {
                  // Prioridad: si hay "dirigido a" con teléfono, usarlo. Sino, contacto principal.
                  const tieneAtencion = orden.atencion_nombre && orden.atencion_telefono
                  const nombreAviso = tieneAtencion ? orden.atencion_nombre! : orden.contacto_nombre
                  const telAviso = tieneAtencion
                    ? orden.atencion_telefono!
                    : (orden.contacto_whatsapp || orden.contacto_telefono || '')
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const num = telAviso.replace(/[^+\d]/g, '')
                        if (!num) {
                          mostrarToast('error', 'No hay teléfono/WhatsApp cargado para avisar')
                          return
                        }
                        const direccion = orden.contacto_direccion || ''
                        const mensaje = encodeURIComponent(
                          `Hola ${nombreAviso}, le avisamos que estamos llegando${direccion ? ` a ${direccion}` : ''} para realizar el trabajo de la OT #${orden.numero}.`
                        )
                        window.open(`https://wa.me/${num}?text=${mensaje}`, '_blank')
                        mostrarToast('exito', `Aviso de llegada enviado a ${nombreAviso}`)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/10 text-insignia-exito-texto hover:bg-insignia-exito/20 active:scale-95"
                    >
                      <Bell size={14} />
                      Avisar llegada
                      {tieneAtencion && (
                        <span className="text-[10px] font-normal opacity-70">({nombreAviso})</span>
                      )}
                    </button>
                  )
                })()}
              </div>

              {/* Dirección */}
              {orden.contacto_direccion && (
                <p className="text-sm text-texto-terciario">{orden.contacto_direccion}</p>
              )}
            </div>

            {/* Divisor vertical */}
            <div className="hidden md:block bg-white/[0.07]" />

            {/* Lado derecho: datos clave */}
            <div className="space-y-3 md:min-w-[220px]">
              {/* Presupuesto origen */}
              {orden.presupuesto_id && (
                <div>
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-0.5">{t('ordenes.presupuesto_origen')}</p>
                  <button
                    type="button"
                    onClick={() => router.push(`/presupuestos/${orden.presupuesto_id}`)}
                    className="flex items-center gap-1.5 text-sm text-texto-marca hover:underline cursor-pointer border-none bg-transparent p-0"
                  >
                    <FileText size={13} />
                    {orden.presupuesto_numero}
                    <ExternalLink size={11} />
                  </button>
                </div>
              )}

              {/* ── Asignados (múltiples con responsable) ── */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">Asignados</p>

                {/* Lista de asignados */}
                <div className="space-y-1">
                  {asignados.map(a => (
                    <div key={a.usuario_id} className="flex items-center gap-2 group">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {a.es_cabecilla ? (
                          <Crown size={13} className="text-texto-marca shrink-0" />
                        ) : (
                          <User size={13} className="text-texto-terciario shrink-0" />
                        )}
                        <span className={`text-sm truncate ${a.es_cabecilla ? 'text-texto-primario font-medium' : 'text-texto-secundario'}`}>
                          {a.usuario_nombre}
                        </span>
                        {a.es_cabecilla && (
                          <span className="text-[10px] text-texto-marca font-medium">Responsable</span>
                        )}
                      </div>
                      {/* Acciones (solo admin/responsable puede gestionar) */}
                      {puedeEditarEstado && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleResponsable(a.usuario_id)}
                            className={`p-1 rounded-md transition-colors cursor-pointer border-none bg-transparent ${
                              a.es_cabecilla
                                ? 'text-texto-marca hover:bg-texto-marca/10'
                                : 'text-texto-terciario hover:text-texto-marca hover:bg-texto-marca/10'
                            }`}
                            title={a.es_cabecilla ? 'Quitar responsable' : 'Hacer responsable'}
                          >
                            <Crown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => quitarAsignado(a.usuario_id)}
                            className="p-1 rounded-md hover:bg-insignia-peligro/10 text-texto-terciario hover:text-insignia-peligro transition-colors cursor-pointer border-none bg-transparent"
                            title="Quitar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {asignados.length === 0 && (
                    <p className="text-xs text-texto-terciario italic">Sin asignar</p>
                  )}
                </div>

                {/* Botón para agregar asignado */}
                {puedeEditarEstado && miembrosDisponibles.length > 0 && (
                  <div ref={refMenuAsignados} className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setMenuAsignadosAbierto(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-marca transition-colors cursor-pointer border-none bg-transparent p-0"
                    >
                      <Plus size={12} />
                      Agregar persona
                    </button>

                    <AnimatePresence>
                      {menuAsignadosAbierto && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
                        >
                          {miembrosDisponibles.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { agregarAsignado(m); setMenuAsignadosAbierto(false) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-superficie-tarjeta text-texto-secundario border-none bg-transparent cursor-pointer"
                            >
                              <User size={13} /> {m.nombre}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Fecha de inicio */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                  {t('ordenes.fecha_inicio')}
                </p>
                <SelectorFecha
                  valor={orden.fecha_inicio ? orden.fecha_inicio.slice(0, 10) : null}
                  onChange={(v) => guardarFecha('fecha_inicio', v)}
                  placeholder="Sin fecha"
                  limpiable
                  className="text-sm"
                />
              </div>

              {/* Fecha fin estimada */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                  {t('ordenes.fecha_fin_estimada')}
                </p>
                <SelectorFecha
                  valor={orden.fecha_fin_estimada ? orden.fecha_fin_estimada.slice(0, 10) : null}
                  onChange={(v) => guardarFecha('fecha_fin_estimada', v)}
                  placeholder="Sin fecha"
                  limpiable
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Descripción (si existe, debajo del grid) */}
          {orden.descripcion && (
            <div className="mt-4 pt-4 border-t border-white/[0.07]">
              <p className="text-sm text-texto-secundario whitespace-pre-wrap">{orden.descripcion}</p>
            </div>
          )}
        </div>

        {/* Tareas y actividades con progreso */}
        <div className="rounded-xl border border-borde-sutil bg-superficie-tarjeta p-4">
          <SeccionActividadesOrden
            ordenId={ordenId}
            ordenNumero={orden.numero}
            asignadosOT={asignados}
            usuarioActualId={usuarioActualId}
            puedeEditarEstado={puedeEditarEstado}
            onProgresoChange={handleProgresoChange}
          />
        </div>

        {/* Chatter — abajo de todo */}
        <div className="rounded-xl border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
          <PanelChatter
            entidadTipo="orden_trabajo"
            entidadId={ordenId}
            contactoPrincipal={orden.contacto_id && orden.contacto_nombre ? { id: orden.contacto_id, nombre: orden.contacto_nombre } : undefined}
            tipoDocumento="OT"
            datosDocumento={{ numero: orden.numero }}
          />
        </div>
      </div>
    </div>
  )
}
