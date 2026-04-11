'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin, User, Calendar, Clock, CheckCircle, X,
  Navigation, ArrowLeft, AlertTriangle, RotateCcw,
  ExternalLink, Check,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import type { Visita } from '../_componentes/ModalVisita'

/**
 * DetalleVisita — Componente client para la vista de detalle de una visita.
 * Layout de 2 columnas: info + PanelChatter.
 */

const COLORES_ESTADO: Record<string, { color: string; variable: string }> = {
  programada: { color: 'advertencia', variable: 'var(--estado-pendiente)' },
  en_camino: { color: 'exito', variable: 'var(--canal-whatsapp)' },
  en_sitio: { color: 'info', variable: 'var(--insignia-info)' },
  completada: { color: 'exito', variable: 'var(--estado-completado)' },
  cancelada: { color: 'peligro', variable: 'var(--estado-error)' },
  reprogramada: { color: 'advertencia', variable: 'var(--insignia-advertencia)' },
}

interface Props {
  visita: Visita
}

export default function DetalleVisita({ visita: visitaInicial }: Props) {
  const router = useRouter()
  const formato = useFormato()
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [visita, setVisita] = useState(visitaInicial)
  const [accionando, setAccionando] = useState(false)

  const esActiva = !['completada', 'cancelada'].includes(visita.estado)
  const estadoColor = COLORES_ESTADO[visita.estado]

  const ejecutarAccion = async (accion: string, datos?: Record<string, unknown>) => {
    setAccionando(true)
    try {
      const res = await fetch(`/api/visitas/${visita.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...datos }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setVisita(data)
      mostrar('exito', `Visita: ${t(`visitas.estados.${data.estado}`)}`)
    } catch {
      mostrar('error', 'Error al actualizar la visita')
    } finally {
      setAccionando(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-borde-sutil">
        <button
          onClick={() => router.push('/visitas')}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-texto-terciario"
        >
          <ArrowLeft size={18} />
        </button>
        <MapPin size={20} style={{ color: estadoColor?.variable }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-texto-primario truncate">
            {visita.contacto_nombre}
          </h1>
          <p className="text-sm text-texto-terciario">
            {visita.direccion_texto || 'Sin dirección'}
          </p>
        </div>
        <Insignia color={estadoColor?.color as 'exito' | 'peligro' | 'advertencia' | 'info'}>
          {t(`visitas.estados.${visita.estado}`)}
        </Insignia>
      </div>

      {/* Acciones rápidas */}
      {esActiva && (
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-borde-sutil">
          {visita.estado === 'programada' && (
            <Boton
              tamano="sm"
              variante="secundario"
              cargando={accionando}
              onClick={() => ejecutarAccion('en_camino')}
            >
              <Navigation size={14} className="mr-1.5" />
              En camino
            </Boton>
          )}
          {(visita.estado === 'en_camino' || visita.estado === 'programada') && (
            <Boton
              tamano="sm"
              variante="secundario"
              cargando={accionando}
              onClick={() => ejecutarAccion('en_sitio')}
            >
              <MapPin size={14} className="mr-1.5" />
              Llegué
            </Boton>
          )}
          {visita.estado === 'en_sitio' && (
            <Boton
              tamano="sm"
              cargando={accionando}
              onClick={() => ejecutarAccion('completar')}
            >
              <CheckCircle size={14} className="mr-1.5" />
              Completar
            </Boton>
          )}
          <Boton
            tamano="sm"
            variante="fantasma"
            cargando={accionando}
            onClick={() => ejecutarAccion('cancelar')}
          >
            <X size={14} className="mr-1.5" />
            Cancelar
          </Boton>
        </div>
      )}
      {!esActiva && visita.estado !== 'cancelada' && (
        <div className="flex gap-2 px-6 py-3 border-b border-borde-sutil">
          <Boton
            tamano="sm"
            variante="fantasma"
            cargando={accionando}
            onClick={() => ejecutarAccion('reactivar')}
          >
            <RotateCcw size={14} className="mr-1.5" />
            Reactivar
          </Boton>
        </div>
      )}

      {/* Contenido: 2 columnas */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_380px] overflow-hidden">
        {/* Info */}
        <div className="overflow-y-auto p-6 space-y-6 border-r border-borde-sutil">
          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1 block">
                {t('visitas.contacto')}
              </label>
              <div className="flex items-center gap-2">
                <User size={14} className="text-texto-terciario" />
                <button
                  onClick={() => router.push(`/contactos/${visita.contacto_id}`)}
                  className="text-sm text-texto-marca hover:underline"
                >
                  {visita.contacto_nombre}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1 block">
                {t('visitas.asignado')}
              </label>
              <div className="flex items-center gap-2">
                <User size={14} className="text-texto-terciario" />
                <span className="text-sm text-texto-primario">{visita.asignado_nombre || '—'}</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1 block">
                {t('visitas.fecha_programada')}
              </label>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-texto-terciario" />
                <span className="text-sm text-texto-primario">
                  {formato.fecha(visita.fecha_programada)} · {formato.hora(visita.fecha_programada)}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1 block">
                {t('visitas.duracion')}
              </label>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-texto-terciario" />
                <span className="text-sm text-texto-primario">
                  {visita.duracion_real_min
                    ? `${visita.duracion_real_min} min (real)`
                    : `${visita.duracion_estimada_min} min (est.)`
                  }
                </span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1 block">
                {t('visitas.prioridad')}
              </label>
              <Insignia color={
                visita.prioridad === 'urgente' || visita.prioridad === 'alta' ? 'peligro'
                : visita.prioridad === 'baja' ? 'info' : 'neutro' as never
              }>
                {t(`visitas.prioridades.${visita.prioridad}`)}
              </Insignia>
            </div>
          </div>

          {/* Dirección con enlace a Google Maps */}
          {visita.direccion_texto && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.direccion')}
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <MapPin size={14} className="text-texto-terciario flex-shrink-0" />
                <span className="text-sm text-texto-primario flex-1">{visita.direccion_texto}</span>
                {visita.direccion_lat && visita.direccion_lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${visita.direccion_lat},${visita.direccion_lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-texto-marca hover:text-texto-marca/80 flex items-center gap-1 text-xs"
                  >
                    <Navigation size={12} />
                    Navegar
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Motivo */}
          {visita.motivo && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.motivo')}
              </label>
              <p className="text-sm text-texto-primario">{visita.motivo}</p>
            </div>
          )}

          {/* Resultado */}
          {visita.resultado && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.resultado')}
              </label>
              <p className="text-sm text-texto-primario">{visita.resultado}</p>
            </div>
          )}

          {/* Notas */}
          {visita.notas && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.notas')}
              </label>
              <p className="text-sm text-texto-secundario whitespace-pre-wrap">{visita.notas}</p>
            </div>
          )}

          {/* Checklist */}
          {visita.checklist && visita.checklist.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.checklist')} ({visita.checklist.filter(c => c.completado).length}/{visita.checklist.length})
              </label>
              <div className="space-y-1">
                {visita.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <div className={`size-4 rounded border flex items-center justify-center ${
                      item.completado ? 'bg-texto-marca border-texto-marca' : 'border-borde-fuerte'
                    }`}>
                      {item.completado && <Check size={10} className="text-white" />}
                    </div>
                    <span className={item.completado ? 'line-through text-texto-terciario' : 'text-texto-primario'}>
                      {item.texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Geolocalización */}
          {visita.registro_lat && visita.registro_lng && (
            <div>
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.registro_ubicacion')}
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <MapPin size={14} className="text-green-400" />
                <span className="text-sm text-texto-primario">
                  {visita.registro_lat.toFixed(6)}, {visita.registro_lng.toFixed(6)}
                </span>
                {visita.registro_precision_m && (
                  <span className="text-xs text-texto-terciario">±{visita.registro_precision_m}m</span>
                )}
                <a
                  href={`https://www.google.com/maps?q=${visita.registro_lat},${visita.registro_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-texto-marca text-xs flex items-center gap-1 ml-auto"
                >
                  <ExternalLink size={12} />
                  Ver
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Chatter */}
        <div className="overflow-hidden">
          <PanelChatter
            entidadTipo="visita"
            entidadId={visita.id}
            contacto={visita.contacto_id ? { id: visita.contacto_id, nombre: visita.contacto_nombre } : undefined}
          />
        </div>
      </div>
    </div>
  )
}
