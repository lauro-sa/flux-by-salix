'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, User, Calendar, Clock, ExternalLink, Loader2, ChevronDown, X, Phone, MessageCircle, MapPin } from 'lucide-react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import CabeceraOrden from './CabeceraOrden'
import SeccionActividadesOrden from './SeccionActividadesOrden'
import { ETIQUETAS_ESTADO_OT } from '@/tipos/orden-trabajo'
import type { OrdenTrabajo, LineaOrdenTrabajo, HistorialOrdenTrabajo, EstadoOrdenTrabajo } from '@/tipos/orden-trabajo'

/**
 * VistaOrdenTrabajo — Vista detalle completa de una orden de trabajo.
 * Diseño limpio y operativo: contacto con acciones rápidas, líneas sin precios,
 * actividades como progreso, historial, chatter.
 */

interface Props {
  ordenId: string
}

export default function VistaOrdenTrabajo({ ordenId }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const router = useRouter()
  const { mostrar: mostrarToast } = useToast()

  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [lineas, setLineas] = useState<LineaOrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<HistorialOrdenTrabajo[]>([])
  const [progreso, setProgreso] = useState({ total_actividades: 0, completadas: 0, porcentaje: 0 })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [miembros, setMiembros] = useState<{ id: string; nombre: string }[]>([])
  const [menuAsignadoAbierto, setMenuAsignadoAbierto] = useState(false)

  // Cargar miembros del equipo
  useEffect(() => {
    (async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return
      const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
      if (!mRes?.length) return
      const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
      setMiembros((perfiles || []).map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido || ''}`.trim() })))
    })()
  }, [])

  // Asignar responsable
  const asignar = async (userId: string | null, nombre: string | null) => {
    if (!orden) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignado_a: userId, asignado_nombre: nombre }),
      })
      if (res.ok) {
        const actualizada = await res.json()
        setOrden(actualizada)
        setMenuAsignadoAbierto(false)
      }
    } catch {
      mostrarToast('error', 'Error al asignar')
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar nota (línea de la OT)
  const eliminarNota = async (lineaId: string) => {
    try {
      const admin = crearClienteNavegador()
      await admin.from('lineas_orden_trabajo').delete().eq('id', lineaId)
      setLineas(prev => prev.filter(l => l.id !== lineaId))
    } catch {
      mostrarToast('error', 'Error al eliminar nota')
    }
  }

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`)
      if (!res.ok) { router.push('/ordenes'); return }
      const data = await res.json()
      setOrden(data.orden)
      setLineas(data.lineas || [])
      setHistorial(data.historial || [])
      setProgreso(data.progreso || { total_actividades: 0, completadas: 0, porcentaje: 0 })
    } catch {
      mostrarToast('error', 'Error al cargar la orden')
    } finally {
      setCargando(false)
    }
  }, [ordenId, router, mostrarToast])

  useEffect(() => { cargar() }, [cargar])

  // Cambiar estado
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
      // Recargar historial
      cargar()
    } catch {
      mostrarToast('error', 'Error al cambiar estado')
    } finally {
      setGuardando(false)
    }
  }

  // Callback para cuando cambia el progreso de actividades
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

  return (
    <div className="min-h-screen bg-superficie-app">
      {/* Cabecera */}
      <CabeceraOrden
        numero={orden.numero}
        titulo={orden.titulo}
        estado={orden.estado}
        prioridad={orden.prioridad}
        onCambiarEstado={cambiarEstado}
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
              </div>

              {/* Dirección */}
              {orden.contacto_direccion && (
                <p className="text-sm text-texto-terciario">{orden.contacto_direccion}</p>
              )}
            </div>

            {/* Divisor vertical */}
            <div className="hidden md:block bg-white/[0.07]" />

            {/* Lado derecho: datos clave */}
            <div className="space-y-3 md:min-w-[200px]">
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

              {/* Asignado */}
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-0.5">{t('ordenes.asignado')}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuAsignadoAbierto(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-texto-primario hover:text-texto-marca transition-colors cursor-pointer border-none bg-transparent p-0"
                  >
                    <User size={13} className="text-texto-terciario" />
                    {orden.asignado_nombre || 'Sin asignar'}
                    <ChevronDown size={11} className="text-texto-terciario" />
                  </button>
                  {menuAsignadoAbierto && (
                    <div className="absolute top-full mt-1 left-0 z-50 min-w-44 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto">
                      {orden.asignado_a && (
                        <button type="button" onClick={() => asignar(null, null)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-superficie-tarjeta text-insignia-peligro-texto border-none bg-transparent cursor-pointer">
                          <X size={13} /> Quitar asignado
                        </button>
                      )}
                      {miembros.map(m => (
                        <button key={m.id} type="button" onClick={() => asignar(m.id, m.nombre)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-superficie-tarjeta border-none bg-transparent cursor-pointer ${m.id === orden.asignado_a ? 'text-texto-marca font-medium' : 'text-texto-secundario'}`}>
                          <User size={13} /> {m.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fecha de inicio */}
              {orden.fecha_inicio && (
                <div>
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-0.5">{t('ordenes.fecha_inicio')}</p>
                  <div className="flex items-center gap-1.5 text-sm text-texto-primario">
                    <Calendar size={13} className="text-texto-terciario" />
                    {formato.fecha(orden.fecha_inicio)}
                  </div>
                </div>
              )}

              {/* Fecha fin estimada */}
              {orden.fecha_fin_estimada && (
                <div>
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-0.5">{t('ordenes.fecha_fin_estimada')}</p>
                  <div className="flex items-center gap-1.5 text-sm text-texto-primario">
                    <Clock size={13} className="text-texto-terciario" />
                    {formato.fecha(orden.fecha_fin_estimada)}
                  </div>
                </div>
              )}
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
            onProgresoChange={handleProgresoChange}
          />
        </div>

        {/* Notas del presupuesto */}
        {lineas.filter(l => l.tipo_linea === 'nota' && l.descripcion).length > 0 && (
          <div className="rounded-xl border border-borde-sutil bg-superficie-tarjeta p-4 space-y-2">
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
              {t('ordenes.notas')}
            </p>
            {lineas.filter(l => l.tipo_linea === 'nota' && l.descripcion).map(l => (
              <div key={l.id} className="flex items-start gap-2 group">
                <p className="text-sm text-texto-secundario italic flex-1">{l.descripcion}</p>
                <button
                  type="button"
                  onClick={() => eliminarNota(l.id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md hover:bg-insignia-peligro/10 text-texto-terciario hover:text-insignia-peligro transition-all cursor-pointer border-none bg-transparent"
                  title="Quitar nota"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

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
