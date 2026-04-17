'use client'

/**
 * ModalVistaActividad — Modal de solo lectura para previsualizar una actividad.
 * Diseño inspirado en el editor pero en modo lectura: tipo con color/icono,
 * título grande, metadatos claros, descripción, checklist, vínculos.
 * Siempre hace fetch para tener datos completos y actualizados.
 * Reutilizable desde: chatter, tabla de actividades, dashboard, etc.
 */

import { useState, useEffect } from 'react'
import {
  Calendar, Clock, Users, AlertTriangle, CheckCircle2,
  Link as LinkIcon, CheckSquare, Square, Pencil, Ban,
} from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'

// ── Tipos ──
interface Actividad {
  id: string
  titulo: string
  descripcion?: string | null
  tipo_id?: string
  tipo_clave?: string
  prioridad?: string
  fecha_vencimiento?: string | null
  estado_clave?: string
  asignados?: { id: string; nombre: string }[]
  checklist?: { id: string; texto: string; completado: boolean }[]
  vinculos?: { id: string; tipo: string; nombre: string }[]
  creado_por_nombre?: string | null
  creado_en?: string | null
  completado_en?: string | null
}

interface TipoActividad {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  actividadId: string | null
  /** Callback para abrir en modo edición */
  onEditar?: (actividadId: string) => void
}

// ── Helpers ──
function fechaLegible(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hoy = new Date()
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)

  const mismaFecha = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  if (mismaFecha(d, hoy)) return 'Hoy'
  if (mismaFecha(d, manana)) return 'Mañana'
  if (mismaFecha(d, ayer)) return 'Ayer'

  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fechaHora(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function estaVencida(fecha?: string | null, estado?: string): boolean {
  if (!fecha || estado === 'completada' || estado === 'cancelada') return false
  return new Date(fecha) < new Date()
}

const PRIORIDADES: Record<string, { etiqueta: string; clase: string }> = {
  baja: { etiqueta: 'Baja', clase: 'text-insignia-info bg-insignia-info/10 border-insignia-info/20' },
  normal: { etiqueta: 'Normal', clase: 'text-texto-terciario bg-white/[0.04] border-white/[0.06]' },
  alta: { etiqueta: 'Alta', clase: 'text-insignia-peligro bg-insignia-peligro/10 border-insignia-peligro/20' },
}

const ESTADOS: Record<string, { etiqueta: string; clase: string }> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'text-insignia-advertencia bg-insignia-advertencia/10' },
  en_progreso: { etiqueta: 'En progreso', clase: 'text-insignia-info bg-insignia-info/10' },
  completada: { etiqueta: 'Completada', clase: 'text-insignia-exito bg-insignia-exito/10' },
  cancelada: { etiqueta: 'Cancelada', clase: 'text-insignia-peligro bg-insignia-peligro/10' },
}

// ── Componente ──
export function ModalVistaActividad({ abierto, onCerrar, actividadId, onEditar }: Props) {
  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [tipo, setTipo] = useState<TipoActividad | null>(null)
  const [cargando, setCargando] = useState(false)

  // Fetch actividad + tipo al abrir
  useEffect(() => {
    if (!abierto || !actividadId) return
    setCargando(true)

    // Cargar actividad y config de tipos en paralelo
    Promise.all([
      fetch(`/api/actividades/${actividadId}`).then(r => r.ok ? r.json() : null),
      fetch('/api/actividades/config').then(r => r.ok ? r.json() : null),
    ]).then(([act, config]) => {
      if (act) {
        setActividad(act)
        // Buscar el tipo correspondiente
        const tipos = config?.tipos || []
        const tipoEncontrado = tipos.find((t: TipoActividad) => t.id === act.tipo_id)
        setTipo(tipoEncontrado || null)
      }
    }).finally(() => setCargando(false))
  }, [abierto, actividadId])

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) { setActividad(null); setTipo(null) }
  }, [abierto])

  const IconoTipo = tipo?.icono ? obtenerIcono(tipo.icono) : null
  const tipoColor = tipo?.color || '#5b5bd6'
  const checklist = actividad?.checklist || []
  const completados = checklist.filter(i => i.completado).length
  const vinculos = actividad?.vinculos || []
  const asignados = actividad?.asignados || []
  const vencida = estaVencida(actividad?.fecha_vencimiento, actividad?.estado_clave)
  const prio = PRIORIDADES[actividad?.prioridad || 'normal'] || PRIORIDADES.normal
  const estado = ESTADOS[actividad?.estado_clave || 'pendiente']

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={onCerrar}
      titulo=""
      tamano="3xl"
      sinPadding
    >
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-5 border-2 border-texto-terciario/30 border-t-texto-marca rounded-full animate-spin" />
        </div>
      ) : actividad ? (
        <div className="p-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex-1 min-w-0 space-y-3">
              {/* Tipo pill + estado */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tipoColor} 15%, transparent)`,
                    color: tipoColor,
                  }}
                >
                  {IconoTipo && <IconoTipo size={15} />}
                  {tipo?.etiqueta || actividad.tipo_clave || 'Actividad'}
                </span>

                {estado && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${estado.clase}`}>
                    {actividad.estado_clave === 'completada' && <CheckCircle2 size={11} />}
                    {actividad.estado_clave === 'cancelada' && <Ban size={11} />}
                    {estado.etiqueta}
                  </span>
                )}
              </div>

              {/* Título */}
              <h2 className="text-xl font-bold text-texto-primario leading-snug">
                {actividad.titulo}
              </h2>
            </div>

            {/* Botón editar */}
            {onEditar && (
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Pencil size={14} />}
                onClick={() => { onCerrar(); onEditar(actividad.id) }}
              >
                Editar
              </Boton>
            )}
          </div>

          {/* ── Metadatos — fila horizontal con separadores ── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4 border-y border-white/[0.07]">
            {/* Prioridad */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-texto-terciario uppercase tracking-wider font-medium">Prioridad</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${prio.clase}`}>
                {prio.etiqueta}
              </span>
            </div>

            {/* Vencimiento */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-texto-terciario uppercase tracking-wider font-medium">Vence</span>
              {actividad.fecha_vencimiento ? (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${vencida ? 'text-insignia-peligro' : 'text-texto-primario'}`}>
                  {vencida && <AlertTriangle size={13} />}
                  <Calendar size={13} className={vencida ? '' : 'text-texto-terciario'} />
                  {fechaLegible(actividad.fecha_vencimiento)}
                </span>
              ) : (
                <span className="text-sm text-texto-terciario">—</span>
              )}
            </div>

            {/* Responsables */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-texto-terciario uppercase tracking-wider font-medium">Responsable</span>
              {asignados.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {asignados.map(a => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-texto-secundario"
                    >
                      <Users size={10} className="text-texto-terciario" />
                      {a.nombre}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-texto-terciario">Sin asignar</span>
              )}
            </div>
          </div>

          {/* ── Descripción ── */}
          {actividad.descripcion && (
            <div className="mt-5">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Descripción</p>
              <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <p className="text-sm text-texto-primario leading-relaxed whitespace-pre-wrap">
                  {actividad.descripcion}
                </p>
              </div>
            </div>
          )}

          {/* ── Checklist ── */}
          {checklist.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Checklist</p>
                <span className="text-[11px] text-texto-terciario">
                  {completados}/{checklist.length}
                </span>
                {/* Barra de progreso */}
                <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-insignia-exito transition-all"
                    style={{ width: `${checklist.length > 0 ? (completados / checklist.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                {checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-white/[0.02]">
                    {item.completado
                      ? <CheckSquare size={15} className="text-insignia-exito shrink-0" />
                      : <Square size={15} className="text-texto-terciario shrink-0" />
                    }
                    <span className={`text-sm ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                      {item.texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Vínculos ── */}
          {vinculos.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Vinculado a</p>
              <div className="flex flex-wrap gap-2">
                {vinculos.map(v => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-texto-secundario"
                  >
                    <LinkIcon size={11} className="text-texto-terciario" />
                    {v.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer auditoría ── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-6 pt-4 border-t border-white/[0.07] text-[11px] text-texto-terciario">
            {actividad.creado_por_nombre && (
              <span>Creada por {actividad.creado_por_nombre} · {fechaHora(actividad.creado_en)}</span>
            )}
            {actividad.completado_en && (
              <span className="flex items-center gap-1 text-insignia-exito">
                <Clock size={10} />
                Completada {fechaHora(actividad.completado_en)}
              </span>
            )}
          </div>

        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-sm text-texto-terciario">
          Actividad no encontrada
        </div>
      )}
    </ModalAdaptable>
  )
}
