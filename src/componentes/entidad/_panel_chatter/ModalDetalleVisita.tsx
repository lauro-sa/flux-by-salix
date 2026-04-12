'use client'

/**
 * ModalDetalleVisita — Modal de solo lectura con toda la info de una visita completada.
 * Reutilizable desde: EntradaVisita (chatter) y listado de visitas archivadas.
 * Se usa en: EntradaVisita, ContenidoVisitas (archivo).
 */

import {
  MapPin, Clock, Thermometer, CheckSquare, Square,
  Navigation, CalendarClock, User, FileText, Target,
  ImageIcon, X,
} from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import type { EntradaChatter, AdjuntoChatter, MetadataChatter } from '@/tipos/chatter'

// ─── Colores de temperatura ───
const COLORES_TEMPERATURA: Record<string, { bg: string; texto: string; etiqueta: string; icono: string }> = {
  frio: { bg: 'bg-blue-500/10', texto: 'text-blue-400', etiqueta: 'Frío', icono: '❄️' },
  tibio: { bg: 'bg-amber-500/10', texto: 'text-amber-400', etiqueta: 'Tibio', icono: '🌤️' },
  caliente: { bg: 'bg-red-500/10', texto: 'text-red-400', etiqueta: 'Caliente', icono: '🔥' },
}

// ─── Props para uso desde visita archivada (sin entrada de chatter) ───
export interface DatosVisitaDetalle {
  resultado?: string | null
  notas?: string | null
  temperatura?: string | null
  checklist?: { id: string; texto: string; completado: boolean }[]
  direccion_texto?: string | null
  duracion_real_min?: number | null
  duracion_estimada_min?: number | null
  fecha_completada?: string | null
  fecha_programada?: string | null
  motivo?: string | null
  contacto_nombre?: string | null
  contacto_id?: string | null
  asignado_nombre?: string | null
  editado_por_nombre?: string | null
  registro_lat?: number | null
  registro_lng?: number | null
  registro_precision_m?: number | null
  prioridad?: string | null
  recibe_nombre?: string | null
  recibe_telefono?: string | null
  adjuntos?: AdjuntoChatter[]
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Desde chatter: usa la entrada para extraer metadata */
  entrada?: EntradaChatter
  /** Desde archivo: datos directos de la visita */
  datosVisita?: DatosVisitaDetalle
}

// ─── Formatear fecha legible ───
function formatearFecha(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Sección con etiqueta ───
function Seccion({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">{etiqueta}</h4>
      {children}
    </div>
  )
}

// ─── Fila info ───
function FilaInfo({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: React.ReactNode }) {
  if (!valor) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-texto-terciario shrink-0 mt-0.5">{icono}</span>
      <div className="min-w-0">
        <p className="text-xxs text-texto-terciario">{etiqueta}</p>
        <div className="text-sm text-texto-primario">{valor}</div>
      </div>
    </div>
  )
}

export function ModalDetalleVisita({ abierto, onCerrar, entrada, datosVisita }: Props) {
  // Extraer datos — priorizar datosVisita si viene, sino extraer de metadata de la entrada
  const m = entrada?.metadata
  const resultado = datosVisita?.resultado ?? m?.visita_resultado
  const notas = datosVisita?.notas ?? m?.visita_notas
  const temperatura = datosVisita?.temperatura ?? m?.visita_temperatura
  const checklist = datosVisita?.checklist ?? m?.visita_checklist ?? []
  const direccion = datosVisita?.direccion_texto ?? m?.visita_direccion
  const duracionReal = datosVisita?.duracion_real_min ?? m?.visita_duracion_real
  const duracionEstimada = datosVisita?.duracion_estimada_min ?? m?.visita_duracion_estimada
  const fechaCompletada = datosVisita?.fecha_completada ?? m?.visita_fecha_completada
  const fechaProgramada = datosVisita?.fecha_programada ?? m?.visita_fecha_programada
  const motivo = datosVisita?.motivo ?? m?.visita_motivo
  const contactoNombre = datosVisita?.contacto_nombre ?? m?.visita_contacto_nombre
  const visitador = datosVisita?.editado_por_nombre ?? datosVisita?.asignado_nombre ?? entrada?.autor_nombre
  const recibe = datosVisita?.recibe_nombre
  const recibeTel = datosVisita?.recibe_telefono
  const registroLat = datosVisita?.registro_lat ?? m?.visita_registro_lat
  const registroLng = datosVisita?.registro_lng ?? m?.visita_registro_lng
  const registroPrecision = datosVisita?.registro_precision_m ?? m?.visita_registro_precision

  const adjuntos = datosVisita?.adjuntos ?? entrada?.adjuntos ?? []
  const fotos = adjuntos.filter(a => a.tipo?.startsWith('image/'))
  const otrosArchivos = adjuntos.filter(a => !a.tipo?.startsWith('image/'))

  const completados = checklist.filter(i => i.completado).length
  const totalChecklist = checklist.length
  const tempConfig = temperatura ? COLORES_TEMPERATURA[temperatura] : null

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Detalle de visita"
      tamano="4xl"
    >
      <div className="space-y-5">
        {/* Header: contacto + estado */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center justify-center size-10 rounded-full bg-texto-marca/10 text-texto-marca">
            <MapPin size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-texto-primario">{contactoNombre || 'Visita'}</h3>
            <p className="text-xs text-texto-terciario">
              Completada por {visitador}
              {fechaCompletada && <> · {formatearFecha(fechaCompletada)}</>}
            </p>
          </div>
          {tempConfig && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tempConfig.bg} ${tempConfig.texto}`}>
              {tempConfig.icono} {tempConfig.etiqueta}
            </span>
          )}
        </div>

        {/* Grid 2 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-5">
          {/* Columna izquierda — Resultado y datos */}
          <div className="space-y-4">
            {resultado && (
              <Seccion etiqueta="Resultado">
                <p className="text-sm text-texto-primario leading-relaxed">{resultado}</p>
              </Seccion>
            )}

            {notas && notas !== resultado && (
              <Seccion etiqueta="Notas">
                <p className="text-sm text-texto-secundario leading-relaxed whitespace-pre-wrap">{notas}</p>
              </Seccion>
            )}

            <Seccion etiqueta="Información">
              <div className="space-y-0.5">
                <FilaInfo
                  icono={<Target size={14} />}
                  etiqueta="Motivo"
                  valor={motivo}
                />
                <FilaInfo
                  icono={<Navigation size={14} />}
                  etiqueta="Dirección"
                  valor={direccion}
                />
                <FilaInfo
                  icono={<CalendarClock size={14} />}
                  etiqueta="Fecha programada"
                  valor={fechaProgramada ? formatearFecha(fechaProgramada) : null}
                />
                <FilaInfo
                  icono={<Clock size={14} />}
                  etiqueta="Duración"
                  valor={duracionReal != null ? (
                    <span>
                      {duracionReal} min
                      {duracionEstimada != null && (
                        <span className="text-texto-terciario"> (estimada: {duracionEstimada} min)</span>
                      )}
                    </span>
                  ) : null}
                />
                {recibe && (
                  <FilaInfo
                    icono={<User size={14} />}
                    etiqueta="Recibió"
                    valor={<span>{recibe}{recibeTel && <span className="text-texto-terciario"> · {recibeTel}</span>}</span>}
                  />
                )}
                {registroLat != null && registroLng != null && (
                  <FilaInfo
                    icono={<MapPin size={14} />}
                    etiqueta="Ubicación GPS"
                    valor={
                      <span className="text-xs">
                        {registroLat.toFixed(5)}, {registroLng.toFixed(5)}
                        {registroPrecision != null && (
                          <span className="text-texto-terciario"> (±{registroPrecision}m)</span>
                        )}
                      </span>
                    }
                  />
                )}
              </div>
            </Seccion>
          </div>

          {/* Divisor vertical */}
          <div className="hidden md:block bg-white/[0.07]" />

          {/* Columna derecha — Checklist y fotos */}
          <div className="space-y-4">
            {/* Checklist completo */}
            {totalChecklist > 0 && (
              <Seccion etiqueta={`Checklist (${completados}/${totalChecklist})`}>
                <div className="space-y-1">
                  {checklist.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 py-1 px-2 rounded ${
                        item.completado ? 'bg-insignia-exito/5' : 'bg-superficie-hover/30'
                      }`}
                    >
                      {item.completado
                        ? <CheckSquare size={14} className="text-insignia-exito shrink-0" />
                        : <Square size={14} className="text-texto-terciario shrink-0" />
                      }
                      <span className={`text-sm ${
                        item.completado ? 'text-texto-secundario line-through' : 'text-texto-primario'
                      }`}>
                        {item.texto}
                      </span>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}

            {/* Galería completa de fotos */}
            {fotos.length > 0 && (
              <Seccion etiqueta={`Fotos (${fotos.length})`}>
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((foto, i) => (
                    <a
                      key={i}
                      href={foto.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border border-white/[0.06] hover:border-texto-marca/40 transition-colors"
                    >
                      <img
                        src={foto.url}
                        alt={foto.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </Seccion>
            )}

            {/* Otros archivos */}
            {otrosArchivos.length > 0 && (
              <Seccion etiqueta="Archivos">
                <div className="space-y-1">
                  {otrosArchivos.map((archivo, i) => (
                    <a
                      key={i}
                      href={archivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-superficie-hover transition-colors"
                    >
                      <FileText size={14} className="text-texto-terciario shrink-0" />
                      <span className="text-sm text-texto-primario truncate">{archivo.nombre}</span>
                      {archivo.tamano != null && (
                        <span className="text-xxs text-texto-terciario shrink-0 ml-auto">
                          {(archivo.tamano / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </Seccion>
            )}

            {/* Sin datos en la columna derecha */}
            {totalChecklist === 0 && fotos.length === 0 && otrosArchivos.length === 0 && (
              <div className="flex items-center justify-center py-8 text-texto-terciario text-sm">
                Sin checklist ni archivos adjuntos
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalAdaptable>
  )
}
