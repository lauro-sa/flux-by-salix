'use client'

import { useState } from 'react'
import { Pencil, Clock, FileText, Plus } from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { Avatar } from '@/componentes/ui/Avatar'

/**
 * IndicadorEditado — Mini avatar con popover de ciclo de vida del registro.
 *
 * Muestra un avatar pequeño con las iniciales de quien creó o editó el registro.
 * Al hacer click abre un popover con:
 *   1. Quién creó el registro, cuándo y con qué método
 *   2. Si fue editado: quién, cuándo, qué campos cambió (historial completo)
 *
 * El avatar muestra al último editor si fue editado, o al creador si no.
 *
 * Reutilizable en cualquier módulo con tabla de auditoría:
 * asistencias, contactos, ordenes, actividades, etc.
 *
 * Se usa en: tablas, tarjetas, modales — cualquier lugar donde haya un registro.
 */

interface CambioAuditoria {
  id: string
  campo_modificado: string
  valor_anterior: string | null
  valor_nuevo: string | null
  motivo: string | null
  creado_en: string
  editor_nombre?: string
}

interface PropiedadesIndicador {
  /** ID del registro */
  entidadId: string
  /** Nombre de quien creó el registro */
  nombreCreador?: string | null
  /** Fecha de creación (ISO) */
  fechaCreacion?: string | null
  /** Método de creación (ej: 'Manual', 'Automático', 'Sistema') */
  metodoCreacion?: string | null
  /** Nombre del último editor (si fue editado) */
  nombreEditor?: string | null
  /** Fecha de última edición (ISO) */
  fechaEdicion?: string | null
  /** Foto del editor o creador (opcional) */
  fotoAvatar?: string | null
  /** Tabla de auditoría a consultar (si tiene historial de ediciones) */
  tablaAuditoria?: string
  /** Campo FK en la tabla de auditoría (ej: 'asistencia_id') */
  campoReferencia?: string
  /** Mapeo opcional de nombre_campo → etiqueta legible */
  etiquetasCampos?: Record<string, string>
}

// Etiquetas por defecto para campos comunes
const ETIQUETAS_DEFAULT: Record<string, string> = {
  hora_entrada: 'Hora de entrada',
  hora_salida: 'Hora de salida',
  estado: 'Estado',
  tipo: 'Tipo',
  notas: 'Notas',
  inicio_almuerzo: 'Inicio almuerzo',
  fin_almuerzo: 'Fin almuerzo',
  salida_particular: 'Salida particular',
  vuelta_particular: 'Vuelta particular',
  nombre: 'Nombre',
  apellido: 'Apellido',
  correo: 'Correo',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
  metodo_registro: 'Método',
  puntualidad_min: 'Puntualidad',
  cargo: 'Cargo',
  rubro: 'Rubro',
  direccion: 'Dirección',
  descripcion: 'Descripción',
  monto: 'Monto',
  precio: 'Precio',
  cantidad: 'Cantidad',
}

/** Mini avatar neutro para la tabla — sin colores, solo iniciales con borde sutil */
function MiniAvatar({ nombre }: { nombre: string }) {
  const limpio = nombre.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').trim()
  const partes = limpio.split(/\s+/).filter(Boolean)
  const iniciales = partes.length >= 2
    ? (partes[0][0] + partes[1][0]).toUpperCase()
    : limpio.slice(0, 2).toUpperCase()

  return (
    <div
      className="size-5 rounded-full flex items-center justify-center border border-borde-sutil
        text-texto-terciario text-[9px] font-medium leading-none
        hover:text-texto-secundario hover:border-borde-fuerte transition-colors cursor-pointer"
    >
      {iniciales || '?'}
    </div>
  )
}

function fmtFecha(iso: string): string {
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${fecha}, ${hora}`
}

function IndicadorEditado({
  entidadId,
  nombreCreador,
  fechaCreacion,
  metodoCreacion,
  nombreEditor,
  fechaEdicion,
  fotoAvatar,
  tablaAuditoria,
  campoReferencia,
  etiquetasCampos,
}: PropiedadesIndicador) {
  const [cambios, setCambios] = useState<CambioAuditoria[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargado, setCargado] = useState(false)

  const etiquetas = { ...ETIQUETAS_DEFAULT, ...etiquetasCampos }
  const fueEditado = !!nombreEditor
  const nombreAvatar = nombreEditor || nombreCreador || '?'

  const cargarAuditoria = async () => {
    if (cargado || !tablaAuditoria || !campoReferencia) {
      setCargado(true)
      return
    }
    setCargando(true)
    try {
      const res = await fetch(
        `/api/auditoria?tabla=${tablaAuditoria}&campo=${campoReferencia}&id=${entidadId}`
      )
      if (res.ok) {
        const data = await res.json()
        setCambios(data.cambios || [])
      }
    } finally {
      setCargando(false)
      setCargado(true)
    }
  }

  // Agrupar cambios por editor + timestamp (misma edición = < 5s diferencia)
  const gruposEdicion = cambios.reduce<{ editor: string; fecha: string; campos: CambioAuditoria[] }[]>((acc, c) => {
    const ultimoGrupo = acc[acc.length - 1]
    if (
      ultimoGrupo &&
      ultimoGrupo.editor === (c.editor_nombre || 'Admin') &&
      Math.abs(new Date(ultimoGrupo.fecha).getTime() - new Date(c.creado_en).getTime()) < 5000
    ) {
      ultimoGrupo.campos.push(c)
    } else {
      acc.push({
        editor: c.editor_nombre || 'Admin',
        fecha: c.creado_en,
        campos: [c],
      })
    }
    return acc
  }, [])

  return (
    <div onClick={(e) => e.stopPropagation()}>
    <Popover
      alineacion="fin"
      ancho={320}
      contenido={
        <div className="p-3 space-y-3">

          {/* ── Creación ── */}
          <div className="space-y-1.5">
            <div className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">
              Creación
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar nombre={nombreCreador || '?'} tamano="xs" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-texto-primario truncate">
                  {nombreCreador || 'Sistema'}
                </p>
                <div className="flex items-center gap-2 text-xxs text-texto-terciario">
                  {fechaCreacion && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {fmtFecha(fechaCreacion)}
                    </span>
                  )}
                  {metodoCreacion && (
                    <span className="px-1.5 py-0.5 rounded bg-superficie-elevada text-texto-terciario">
                      {metodoCreacion}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Ediciones ── */}
          {fueEditado && (
            <>
              <div className="border-t border-borde-sutil" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">
                    Ediciones
                  </span>
                  {fechaEdicion && (
                    <span className="text-xxs text-texto-terciario flex items-center gap-1">
                      <Clock size={10} />
                      Última: {fmtFecha(fechaEdicion)}
                    </span>
                  )}
                </div>

                {cargando && (
                  <p className="text-xs text-texto-terciario py-1">Cargando historial...</p>
                )}

                {!cargando && gruposEdicion.length === 0 && cargado && (
                  <div className="flex items-center gap-2">
                    <Avatar nombre={nombreEditor || '?'} tamano="xs" />
                    <p className="text-xs text-texto-secundario">
                      Editado por <span className="font-medium">{nombreEditor}</span>
                    </p>
                  </div>
                )}

                {gruposEdicion.length > 0 && (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {gruposEdicion.map((grupo, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-superficie-app/50 border border-borde-sutil p-2.5 space-y-2"
                      >
                        {/* Encabezado: avatar + nombre + fecha */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar nombre={grupo.editor} tamano="xs" />
                            <span className="text-xs font-medium text-texto-primario truncate">
                              {grupo.editor}
                            </span>
                          </div>
                          <span className="text-xxs text-texto-terciario whitespace-nowrap flex items-center gap-1">
                            <Clock size={10} />
                            {fmtFecha(grupo.fecha)}
                          </span>
                        </div>

                        {/* Campos modificados */}
                        <div className="space-y-1.5">
                          {grupo.campos.map((c) => (
                            <div key={c.id} className="space-y-0.5">
                              <div className="text-xxs text-texto-terciario font-medium">
                                {etiquetas[c.campo_modificado] || c.campo_modificado}
                              </div>
                              <div className="flex items-center gap-1.5 text-xxs">
                                <span
                                  className="text-texto-terciario line-through truncate max-w-[120px]"
                                  title={c.valor_anterior || '—'}
                                >
                                  {c.valor_anterior || '—'}
                                </span>
                                <span className="text-texto-terciario">→</span>
                                <span
                                  className="text-texto-primario font-medium truncate max-w-[120px]"
                                  title={c.valor_nuevo || '—'}
                                >
                                  {c.valor_nuevo || '—'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {grupo.campos[0]?.motivo && (
                          <p className="text-xxs text-texto-terciario italic flex items-start gap-1">
                            <FileText size={10} className="shrink-0 mt-0.5" />
                            {grupo.campos[0].motivo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Si no fue editado y no hay auditoría, no mostrar sección de ediciones */}
        </div>
      }
      onCambio={(abierto) => { if (abierto) cargarAuditoria() }}
    >
      <MiniAvatar nombre={nombreAvatar} />
    </Popover>
    </div>
  )
}

export { IndicadorEditado }
export type { PropiedadesIndicador }
