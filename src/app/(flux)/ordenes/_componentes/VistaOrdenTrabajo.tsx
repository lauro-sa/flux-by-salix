'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, User, ExternalLink, Loader2, X, Phone, MapPin, Crown, Plus, Bell } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useRol } from '@/hooks/useRol'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useNavegacion } from '@/hooks/useNavegacion'
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
  const { obtenerRutaModulo } = useNavegacion()
  const { mostrar: mostrarToast } = useToast()
  const { tienePermiso } = useRol()
  // Si el usuario no tiene acceso a presupuestos, el número de origen
  // se muestra como texto plano (sin link).
  const puedeVerPresupuesto = tienePermiso('presupuestos', 'ver_todos') || tienePermiso('presupuestos', 'ver_propio')

  // Restaurar título de pestaña al salir
  useEffect(() => {
    const tituloOriginal = document.title
    return () => { document.title = tituloOriginal }
  }, [])

  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [asignados, setAsignados] = useState<AsignadoOrdenTrabajo[]>([])
  const [progreso, setProgreso] = useState({ total_actividades: 0, completadas: 0, porcentaje: 0 })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [menuAsignadosAbierto, setMenuAsignadosAbierto] = useState(false)
  const refMenuAsignados = useRef<HTMLDivElement>(null)
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null)
  // Flags calculados por el servidor. puedeGestionar = admin/creador/(cabecilla con permiso editar).
  // Los permisos granulares llegan en `permisos` para decidir qué botones mostrar.
  const [puedeGestionar, setPuedeGestionar] = useState(false)
  const [permisos, setPermisos] = useState({
    editar: false,
    publicar: false,
    completar: false,
    completarEtapa: false,
    eliminar: false,
  })
  const [confirmarDespublicar, setConfirmarDespublicar] = useState(false)

  // Cargar miembros del equipo + datos del usuario actual
  useEffect(() => {
    (async () => {
      // ID del usuario actual (para resaltar "tú" y calcular permisos derivados)
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUsuarioActualId(user.id)

      // Miembros vía endpoint (evita problemas de RLS desde el cliente)
      try {
        const res = await fetch('/api/miembros')
        if (!res.ok) return
        const data = await res.json()
        const lista = (data.miembros || [])
          .filter((m: { usuario_id: string | null }) => m.usuario_id)
          .map((m: { usuario_id: string; nombre: string; apellido: string | null }) => ({
            id: m.usuario_id,
            nombre: `${m.nombre} ${m.apellido || ''}`.trim(),
          }))
        setMiembros(lista)
      } catch {
        // silencioso: si falla, el selector de asignados aparece vacío
      }
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
      if (!res.ok) { router.push(obtenerRutaModulo('/ordenes')); return }
      const data = await res.json()
      setOrden(data.orden)
      setAsignados(data.asignados || [])
      setProgreso(data.progreso || { total_actividades: 0, completadas: 0, porcentaje: 0 })
      setPuedeGestionar(Boolean(data.puedeGestionar))
      if (data.permisos) setPermisos(data.permisos)
      if (data.orden?.numero) document.title = `${data.orden.numero} — Flux`
    } catch {
      mostrarToast('error', 'Error al cargar la orden')
    } finally {
      setCargando(false)
    }
  }, [ordenId, router, mostrarToast])

  useEffect(() => { cargar() }, [cargar])

  // Publicada = congelada (vista previa de cómo la ve el asignado).
  // Para editar datos (fechas, responsables, tareas) hay que despublicar.
  // Solo quedan disponibles: cambio de publicada, cambio de estado, y marcar tareas hechas.
  const puedeEditar = puedeGestionar && !orden?.publicada

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

  // Abre un modal de confirmación antes de despublicar (hay asignados comunes
  // que perderán la visibilidad de la OT al volver a borrador).
  const solicitarDespublicar = () => setConfirmarDespublicar(true)

  const despublicar = async () => {
    if (!orden) return
    setConfirmarDespublicar(false)
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
      } else {
        const err = await res.json().catch(() => ({ error: 'Error al guardar fecha' }))
        mostrarToast('error', err.error || 'Error al guardar fecha')
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
        puedeGestionar={puedeGestionar}
        puedeCompletar={permisos.completar}
        onCambiarEstado={cambiarEstado}
        onPublicar={publicar}
        onDespublicar={solicitarDespublicar}
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
              {progreso.completadas} de {progreso.total_actividades} completadas
            </span>
          </div>
        </div>
      )}

      {/* ── Ficha operativa ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Card principal: contacto (izq) + meta-datos (der) */}
        <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_240px] gap-4 md:gap-6">

            {/* ── IZQUIERDA: contacto + acciones + asignados ── */}
            <div className="space-y-4">
              {/* Contacto (jerarquía principal) */}
              {orden.contacto_nombre && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-texto-primario leading-tight">
                    {orden.contacto_nombre}
                  </h2>
                  {orden.contacto_direccion && (
                    <p className="text-sm text-texto-terciario mt-1 flex items-start gap-1.5">
                      <MapPin size={13} className="shrink-0 mt-0.5" />
                      <span>{orden.contacto_direccion}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Botones de acción rápida
                  Mobile (<768px): grid 2 columnas, botones pegados tipo segmented control.
                  Desktop (md+): flex con ancho y altura natural. */}
              <div className="grupo-botones-mobile grid grid-cols-2 gap-1 md:flex md:flex-wrap md:gap-2">
                {orden.contacto_telefono && (
                  <a href={`tel:${orden.contacto_telefono.replace(/[^+\d]/g, '')}`} className="w-full md:w-auto">
                    <button type="button" className="w-full md:w-auto flex items-center justify-center md:justify-start gap-1.5 px-3 py-3 md:py-2 rounded-card text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent text-texto-secundario hover:bg-superficie-hover/50 active:scale-95">
                      <Phone size={14} />
                      {t('ordenes.llamar')}
                    </button>
                  </a>
                )}
                {(orden.contacto_whatsapp || orden.contacto_telefono) && (
                  <a href={`https://wa.me/${(orden.contacto_whatsapp || orden.contacto_telefono || '').replace(/[^+\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto">
                    <button type="button" className="w-full md:w-auto flex items-center justify-center md:justify-start gap-1.5 px-3 py-3 md:py-2 rounded-card text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent hover:bg-superficie-hover/50 active:scale-95" style={{ color: 'var(--canal-whatsapp)' }}>
                      <IconoWhatsApp size={14} />
                      {t('ordenes.whatsapp')}
                    </button>
                  </a>
                )}
                {orden.contacto_direccion && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orden.contacto_direccion)}`} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto">
                    <button type="button" className="w-full md:w-auto flex items-center justify-center md:justify-start gap-1.5 px-3 py-3 md:py-2 rounded-card text-sm font-medium transition-colors cursor-pointer border border-borde-sutil bg-transparent text-texto-secundario hover:bg-superficie-hover/50 active:scale-95">
                      <MapPin size={14} />
                      {t('ordenes.ver_mapa')}
                    </button>
                  </a>
                )}
                {/* Avisar llegada — prioridad: atención (dirigido a) > contacto principal */}
                {(orden.contacto_nombre || orden.atencion_nombre) && (() => {
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
                      className="w-full md:w-auto flex items-center justify-center md:justify-start gap-1.5 px-3 py-3 md:py-2 rounded-card text-sm font-semibold transition-colors cursor-pointer border border-insignia-exito/30 bg-insignia-exito/10 text-insignia-exito-texto hover:bg-insignia-exito/20 active:scale-95"
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

              {/* ── Asignados ── */}
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Asignados</p>

                {asignados.length === 0 ? (
                  <p className="text-sm text-texto-terciario italic">Sin asignar</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {asignados.map(a => (
                      <div
                        key={a.usuario_id}
                        className={`group inline-flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-sm ${
                          a.es_cabecilla
                            ? 'border-texto-marca/30 bg-texto-marca/10 text-texto-primario'
                            : 'border-borde-sutil bg-white/[0.03] text-texto-secundario'
                        }`}
                      >
                        {a.es_cabecilla ? (
                          <Crown size={12} className="text-texto-marca shrink-0" />
                        ) : (
                          <User size={12} className="text-texto-terciario shrink-0" />
                        )}
                        <span className={a.es_cabecilla ? 'font-medium' : ''}>{a.usuario_nombre}</span>
                        {a.es_cabecilla && (
                          <span className="text-[10px] text-texto-marca/80 ml-0.5">Responsable</span>
                        )}
                        {puedeEditar && (
                          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => toggleResponsable(a.usuario_id)}
                              className={`p-0.5 rounded-full transition-colors cursor-pointer border-none bg-transparent ${
                                a.es_cabecilla
                                  ? 'text-texto-marca hover:bg-texto-marca/15'
                                  : 'text-texto-terciario hover:text-texto-marca hover:bg-texto-marca/10'
                              }`}
                              title={a.es_cabecilla ? 'Quitar responsable' : 'Hacer responsable'}
                            >
                              <Crown size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => quitarAsignado(a.usuario_id)}
                              className="p-0.5 rounded-full hover:bg-insignia-peligro/15 text-texto-terciario hover:text-insignia-peligro transition-colors cursor-pointer border-none bg-transparent"
                              title="Quitar"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón para agregar asignado (solo en borrador) */}
                {puedeEditar && miembrosDisponibles.length > 0 && (
                  <div ref={refMenuAsignados} className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setMenuAsignadosAbierto(v => !v)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-borde-sutil text-xs text-texto-terciario hover:text-texto-marca hover:border-texto-marca/50 transition-colors cursor-pointer bg-transparent"
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
                          className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
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
            </div>

            {/* Divisor vertical (solo desktop) */}
            <div className="hidden md:block bg-white/[0.07]" />

            {/* ── DERECHA: meta-datos (presupuesto + fechas) ── */}
            {/* En móvil se muestra como fila de 2 columnas; en desktop columna estrecha */}
            <div className="md:space-y-4 grid grid-cols-2 md:grid-cols-1 gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
              {/* Presupuesto origen */}
              {orden.presupuesto_id && (
                <div className="col-span-2 md:col-span-1">
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                    {t('ordenes.presupuesto_origen')}
                  </p>
                  {puedeVerPresupuesto ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/presupuestos/${orden.presupuesto_id}`)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-texto-marca hover:underline cursor-pointer border-none bg-transparent p-0"
                    >
                      <FileText size={13} />
                      {orden.presupuesto_numero}
                      <ExternalLink size={11} />
                    </button>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-texto-secundario">
                      <FileText size={13} className="text-texto-terciario" />
                      {orden.presupuesto_numero}
                    </p>
                  )}
                </div>
              )}

              {/* Fecha de inicio */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                  {t('ordenes.fecha_inicio')}
                </p>
                {puedeEditar ? (
                  <SelectorFecha
                    valor={orden.fecha_inicio ? orden.fecha_inicio.slice(0, 10) : null}
                    onChange={(v) => guardarFecha('fecha_inicio', v)}
                    placeholder="Sin fecha"
                    limpiable
                    className="text-sm"
                  />
                ) : (
                  <p className={`text-base font-medium ${orden.fecha_inicio ? 'text-texto-primario' : 'text-texto-terciario italic'}`}>
                    {orden.fecha_inicio ? formato.fecha(orden.fecha_inicio, { corta: true }) : 'Sin fecha'}
                  </p>
                )}
              </div>

              {/* Fecha fin estimada */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                  {t('ordenes.fecha_fin_estimada')}
                </p>
                {puedeEditar ? (
                  <SelectorFecha
                    valor={orden.fecha_fin_estimada ? orden.fecha_fin_estimada.slice(0, 10) : null}
                    onChange={(v) => guardarFecha('fecha_fin_estimada', v)}
                    placeholder="Sin fecha"
                    limpiable
                    className="text-sm"
                  />
                ) : (
                  <p className={`text-base font-medium ${orden.fecha_fin_estimada ? 'text-texto-primario' : 'text-texto-terciario italic'}`}>
                    {orden.fecha_fin_estimada ? formato.fecha(orden.fecha_fin_estimada, { corta: true }) : 'Sin fecha'}
                  </p>
                )}
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
        <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4">
          <SeccionActividadesOrden
            ordenId={ordenId}
            ordenNumero={orden.numero}
            asignadosOT={asignados}
            usuarioActualId={usuarioActualId}
            puedeGestionar={puedeGestionar}
            puedeEditar={puedeEditar}
            publicada={orden.publicada}
            onProgresoChange={handleProgresoChange}
          />
        </div>

        {/* Chatter — solo para gestores (admin, creador, cabecilla).
            Los asignados comunes ejecutan el trabajo, no necesitan la conversación interna. */}
        {puedeGestionar && (
          <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
            <PanelChatter
              entidadTipo="orden_trabajo"
              entidadId={ordenId}
              contactoPrincipal={orden.contacto_id && orden.contacto_nombre ? { id: orden.contacto_id, nombre: orden.contacto_nombre } : undefined}
              tipoDocumento="OT"
              datosDocumento={{ numero: orden.numero }}
            />
          </div>
        )}
      </div>

      <ModalConfirmacion
        abierto={confirmarDespublicar}
        onCerrar={() => setConfirmarDespublicar(false)}
        onConfirmar={despublicar}
        tipo="advertencia"
        titulo="Despublicar orden"
        descripcion="La orden volverá a modo borrador y dejará de ser visible para los asignados comunes. Solo responsable, creador y administradores podrán verla."
        etiquetaConfirmar="Despublicar"
        cargando={guardando}
      />
    </div>
  )
}
