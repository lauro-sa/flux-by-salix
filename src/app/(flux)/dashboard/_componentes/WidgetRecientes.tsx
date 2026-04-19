'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Clock, Users, FileText, Zap, File, MessageSquare, Package, Calendar, UserCircle,
  Eye, Pencil, Plus, Trash2,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Formato detallado: "14:30" si es hoy, "Ayer 14:30", "Martes", o fecha corta */
function fechaReciente(input: string, formatoHora: string): string {
  const d = new Date(input)
  if (isNaN(d.getTime())) return '—'

  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const fechaInput = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDias = Math.floor((hoy.getTime() - fechaInput.getTime()) / 86400000)

  const hora = d.toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: formatoHora === '12h',
  })

  if (diffDias === 0) return hora
  if (diffDias === 1) return `Ayer ${hora}`
  if (diffDias === 2) return `Anteayer`
  if (diffDias < 7) {
    const dia = DIAS_SEMANA[d.getDay()]
    return dia.charAt(0).toUpperCase() + dia.slice(1)
  }
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/**
 * WidgetRecientes — Historial de entidades recientes del usuario.
 * Grid 2 columnas en desktop, tarjetas compactas con icono, acción y hora.
 */

interface EntradaReciente {
  id: string
  tipo_entidad: string
  entidad_id: string
  titulo: string
  subtitulo: string | null
  accion: string
  accedido_en: string
}

// Mapa tipo_entidad → icono, color y ruta
const CONFIG_ENTIDAD: Record<string, {
  icono: React.ReactNode
  color: string
  colorBorde: string
  ruta: (id: string) => string
}> = {
  contacto: {
    icono: <Users size={14} strokeWidth={1.5} />,
    color: 'text-insignia-primario-texto bg-insignia-primario-fondo',
    colorBorde: 'border-insignia-primario-fondo',
    ruta: (id) => `/contactos/${id}`,
  },
  presupuesto: {
    icono: <FileText size={14} strokeWidth={1.5} />,
    color: 'text-insignia-info-texto bg-insignia-info-fondo',
    colorBorde: 'border-insignia-info-fondo',
    ruta: (id) => `/presupuestos/${id}`,
  },
  actividad: {
    icono: <Zap size={14} strokeWidth={1.5} />,
    color: 'text-insignia-exito-texto bg-insignia-exito-fondo',
    colorBorde: 'border-insignia-exito-fondo',
    ruta: (id) => `/actividades?actividad_id=${id}`,
  },
  producto: {
    icono: <Package size={14} strokeWidth={1.5} />,
    color: 'text-insignia-advertencia-texto bg-insignia-advertencia-fondo',
    colorBorde: 'border-insignia-advertencia-fondo',
    ruta: (id) => `/productos?producto_id=${id}`,
  },
  documento: {
    icono: <File size={14} strokeWidth={1.5} />,
    color: 'text-insignia-naranja-texto bg-insignia-naranja-fondo',
    colorBorde: 'border-insignia-naranja-fondo',
    ruta: (id) => `/documentos/${id}`,
  },
  evento: {
    icono: <Calendar size={14} strokeWidth={1.5} />,
    color: 'text-insignia-info-texto bg-insignia-info-fondo',
    colorBorde: 'border-insignia-info-fondo',
    ruta: (id) => `/calendario?evento_id=${id}`,
  },
  conversacion: {
    icono: <MessageSquare size={14} strokeWidth={1.5} />,
    color: 'text-insignia-violeta-texto bg-insignia-violeta-fondo',
    colorBorde: 'border-insignia-violeta-fondo',
    ruta: (id) => `/inbox?conv=${id}`,
  },
  miembro: {
    icono: <UserCircle size={14} strokeWidth={1.5} />,
    color: 'text-insignia-primario-texto bg-insignia-primario-fondo',
    colorBorde: 'border-insignia-primario-fondo',
    ruta: (id) => `/usuarios/${id}`,
  },
}

// Acción: icono + etiqueta
const CONFIG_ACCION: Record<string, { icono: React.ReactNode; etiqueta: string; color: string }> = {
  visto: { icono: <Eye size={10} />, etiqueta: 'Visto', color: 'text-texto-terciario' },
  editado: { icono: <Pencil size={10} />, etiqueta: 'Editado', color: 'text-insignia-info-texto' },
  creado: { icono: <Plus size={10} />, etiqueta: 'Creado', color: 'text-insignia-exito-texto' },
  eliminado: { icono: <Trash2 size={10} />, etiqueta: 'Eliminado', color: 'text-insignia-peligro-texto' },
}

// Etiquetas amigables para estados
const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  confirmado_cliente: 'Confirmado',
  orden_venta: 'Orden de venta',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
  completada: 'Completada',
  en_progreso: 'En progreso',
  pospuesta: 'Pospuesta',
}

function formatearSubtitulo(subtitulo: string | null): string | null {
  if (!subtitulo) return null
  return ETIQUETA_ESTADO[subtitulo] || subtitulo
}

/** Detecta cuántas columnas del grid se muestran según el ancho de pantalla */
function useColumnas(): number {
  const [columnas, setColumnas] = useState(1)
  useEffect(() => {
    const calcular = () => {
      const w = window.innerWidth
      if (w >= 1920) setColumnas(4)       // pantallas grandes
      else if (w >= 1536) setColumnas(3)  // 2xl
      else if (w >= 768) setColumnas(2)   // md
      else setColumnas(1)
    }
    calcular()
    window.addEventListener('resize', calcular)
    return () => window.removeEventListener('resize', calcular)
  }, [])
  return columnas
}

export function WidgetRecientes() {
  const router = useRouter()
  const { formatoHora } = useFormato()
  const [recientes, setRecientes] = useState<EntradaReciente[]>([])
  const [cargando, setCargando] = useState(true)
  const columnas = useColumnas()

  // 6 items por columna: 1col=6, 2col=12, 3col=18
  const limite = columnas * 6
  const visibles = useMemo(() => recientes.slice(0, limite), [recientes, limite])

  useEffect(() => {
    fetch('/api/dashboard/recientes')
      .then(r => r.ok ? r.json() : [])
      .then(setRecientes)
      .catch(() => setRecientes([]))
      .finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return (
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-texto-terciario" />
          <h3 className="text-sm font-semibold text-texto-primario">Tu actividad reciente</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1920px]:grid-cols-4 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 bg-superficie-hover/40 rounded-boton animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (recientes.length === 0) {
    return (
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-texto-terciario" />
          <h3 className="text-sm font-semibold text-texto-primario">Tu actividad reciente</h3>
        </div>
        <p className="text-xs text-texto-terciario text-center py-6">
          Acá vas a ver lo último que visitaste o editaste
        </p>
      </div>
    )
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={15} className="text-texto-terciario" />
        <h3 className="text-sm font-semibold text-texto-primario">Tu actividad reciente</h3>
      </div>
      <div className="grid grid-flow-row md:grid-flow-col grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1920px]:grid-cols-4 grid-rows-6 gap-x-3 gap-y-0.5">
        {visibles.map((item, i) => {
          const config = CONFIG_ENTIDAD[item.tipo_entidad]
          if (!config) return null
          const accion = CONFIG_ACCION[item.accion] || CONFIG_ACCION.visto
          const subtitulo = formatearSubtitulo(item.subtitulo)

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.2 }}
              onClick={() => router.push(config.ruta(item.entidad_id))}
              className="flex items-center gap-2 py-1 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(config.ruta(item.entidad_id))
                }
              }}
            >
              {/* Icono tipo entidad */}
              <div className={`size-6 rounded-boton flex items-center justify-center shrink-0 ${config.color}`}>
                {config.icono}
              </div>

              {/* Contenido */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-texto-primario truncate group-hover:text-texto-marca transition-colors">
                    {item.titulo}
                  </p>
                  {subtitulo && (
                    <span className="text-xxs text-texto-terciario shrink-0 hidden sm:inline">· {subtitulo}</span>
                  )}
                </div>
              </div>

              {/* Acción + hora */}
              <div className="flex items-center gap-1 shrink-0">
                <span className={`flex items-center gap-0.5 text-xxs ${accion.color}`}>
                  {accion.icono}
                </span>
                <span className="text-xxs text-texto-terciario whitespace-nowrap">
                  {fechaReciente(item.accedido_en, formatoHora)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
