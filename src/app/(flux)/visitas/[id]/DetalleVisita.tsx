'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MapPin, User, Calendar, Clock, CheckCircle, X,
  Navigation, ArrowLeft, RotateCcw, Pencil,
  ExternalLink, CheckSquare, Square, Phone, CalendarClock,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { CabezaloHero } from '@/componentes/entidad/CabezaloHero'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { useModalVisita } from '@/hooks/useModalVisita'
import { useNavegacion } from '@/hooks/useNavegacion'
import { ModalVisita } from '@/app/(flux)/visitas/_componentes/ModalVisita'
import type { Visita } from '@/tipos/visita'
import type { AdjuntoChatter } from '@/tipos/chatter'

/**
 * DetalleVisita — Vista de detalle con toda la info capturada por el visitador.
 * Layout 2 columnas en desktop: datos de la visita (izq) + registro del visitador (der).
 * Mobile: 1 columna, registro del visitador primero.
 * Las fotos abren en un lightbox interno para evitar el bug de PWA con pestañas externas.
 */

const COLORES_ESTADO: Record<string, { color: string; variable: string }> = {
  programada: { color: 'advertencia', variable: 'var(--estado-pendiente)' },
  en_camino: { color: 'exito', variable: 'var(--canal-whatsapp)' },
  en_sitio: { color: 'info', variable: 'var(--insignia-info)' },
  completada: { color: 'exito', variable: 'var(--estado-completado)' },
  cancelada: { color: 'peligro', variable: 'var(--estado-error)' },
  reprogramada: { color: 'advertencia', variable: 'var(--insignia-advertencia)' },
}

const TEMPERATURA: Record<string, { etiqueta: string; color: string }> = {
  frio: { etiqueta: 'Baja', color: 'var(--insignia-peligro)' },
  tibio: { etiqueta: 'Media', color: 'var(--insignia-advertencia)' },
  caliente: { etiqueta: 'Alta', color: 'var(--insignia-exito)' },
}

interface HermanaVisita {
  id: string
  fecha_programada: string
  fecha_completada: string | null
  estado: string
}

interface Props {
  visita: Visita
  adjuntos: AdjuntoChatter[]
  hermanas: HermanaVisita[]
}

export default function DetalleVisita({ visita: visitaInicial, adjuntos, hermanas }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formato = useFormato()
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const { setMigajaDinamica } = useNavegacion()
  const [visita, setVisita] = useState(visitaInicial)
  const [accionando, setAccionando] = useState(false)
  const [fotoAbierta, setFotoAbierta] = useState<number | null>(null)
  const modalEdicion = useModalVisita()

  // Origen de la navegación (para migajas + botón atrás inteligente)
  const desde = searchParams.get('desde') || searchParams.get('origen')

  // Posición en la lista de visitas del contacto (para el paginador)
  const indice = hermanas.findIndex(h => h.id === visita.id)
  const anteriorVisita = indice > 0 ? hermanas[indice - 1] : null
  const siguienteVisita = indice >= 0 && indice < hermanas.length - 1 ? hermanas[indice + 1] : null

  // Registrar migajas dinámicas: nombre del contacto de origen + nombre de la visita actual
  useEffect(() => {
    if (desde && desde.startsWith('/contactos/') && visita.contacto_nombre) {
      setMigajaDinamica(desde, visita.contacto_nombre)
    }
    setMigajaDinamica(`/visitas/${visita.id}`, visita.contacto_nombre || 'Detalle')
  }, [desde, visita.id, visita.contacto_nombre, setMigajaDinamica])

  // Botón atrás: vuelve al origen si existe, sino al listado de visitas
  const volverAtras = () => {
    if (desde) router.push(desde)
    else router.push('/visitas')
  }

  const esActiva = !['completada', 'cancelada'].includes(visita.estado)
  const estadoColor = COLORES_ESTADO[visita.estado]
  const temp = visita.temperatura ? TEMPERATURA[visita.temperatura] : null
  const fotos = adjuntos.filter(a => a.tipo?.startsWith('image/'))
  const completados = visita.checklist?.filter(c => c.completado).length || 0
  const totalChecklist = visita.checklist?.length || 0

  // Detecta si hay algo registrado por el visitador para mostrar la columna derecha
  const hayRegistro = !!(
    visita.notas_registro || visita.resultado || visita.fecha_llegada ||
    visita.duracion_real_min != null || visita.temperatura ||
    totalChecklist > 0 || fotos.length > 0 ||
    (visita.registro_lat && visita.registro_lng)
  )

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

  // Navegación del lightbox con teclas
  const cerrarLightbox = useCallback(() => setFotoAbierta(null), [])
  const anteriorFoto = useCallback(() => {
    setFotoAbierta(i => (i === null ? null : (i - 1 + fotos.length) % fotos.length))
  }, [fotos.length])
  const siguienteFoto = useCallback(() => {
    setFotoAbierta(i => (i === null ? null : (i + 1) % fotos.length))
  }, [fotos.length])

  useEffect(() => {
    if (fotoAbierta === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarLightbox()
      else if (e.key === 'ArrowLeft') anteriorFoto()
      else if (e.key === 'ArrowRight') siguienteFoto()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fotoAbierta, anteriorFoto, siguienteFoto, cerrarLightbox])

  const navegarAHermana = (id: string) =>
    router.push(`/visitas/${id}${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`)

  // Título editorial: botón volver + icono + nombre grande + dirección
  const tituloHero = (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <button
        onClick={volverAtras}
        className="p-1.5 rounded-card hover:bg-white/[0.06] text-texto-terciario hover:text-texto-primario transition-colors shrink-0"
        title="Volver"
      >
        <ArrowLeft size={18} />
      </button>
      <MapPin size={22} style={{ color: estadoColor?.variable }} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-texto-primario truncate">
            {visita.contacto_nombre}
          </h1>
          <Insignia color={estadoColor?.color as 'exito' | 'peligro' | 'advertencia' | 'info'}>
            {t(`visitas.estados.${visita.estado}`)}
          </Insignia>
        </div>
        <p className="text-sm text-texto-terciario truncate mt-0.5">
          {visita.direccion_texto || t('visitas.sin_direccion')}
        </p>
      </div>
    </div>
  )

  // Acción a la derecha del paginador: botón editar
  const accionesHero = (
    <button
      onClick={() => modalEdicion.abrir(visita)}
      className="size-9 flex items-center justify-center rounded-boton border border-borde-sutil text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
      title="Editar visita"
    >
      <Pencil size={16} />
    </button>
  )

  // Controles secundarios: acciones rápidas según estado
  const controlesHero = esActiva ? (
    <div className="flex flex-wrap gap-2">
      {visita.estado === 'programada' && (
        <Boton tamano="sm" variante="secundario" cargando={accionando} onClick={() => ejecutarAccion('en_camino')}>
          <Navigation size={14} className="mr-1.5" />
          {t('visitas.en_camino')}
        </Boton>
      )}
      {(visita.estado === 'en_camino' || visita.estado === 'programada') && (
        <Boton tamano="sm" variante="secundario" cargando={accionando} onClick={() => ejecutarAccion('en_sitio')}>
          <MapPin size={14} className="mr-1.5" />
          {t('visitas.llegue')}
        </Boton>
      )}
      {visita.estado === 'en_sitio' && (
        <Boton tamano="sm" cargando={accionando} onClick={() => ejecutarAccion('completar')}>
          <CheckCircle size={14} className="mr-1.5" />
          {t('visitas.completar')}
        </Boton>
      )}
      <Boton tamano="sm" variante="fantasma" cargando={accionando} onClick={() => ejecutarAccion('cancelar')}>
        <X size={14} className="mr-1.5" />
        {t('comun.cancelar')}
      </Boton>
    </div>
  ) : visita.estado !== 'cancelada' ? (
    <Boton tamano="sm" variante="fantasma" cargando={accionando} onClick={() => ejecutarAccion('reactivar')}>
      <RotateCcw size={14} className="mr-1.5" />
      {t('visitas.reactivar')}
    </Boton>
  ) : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Header hero con paginador integrado entre visitas del contacto */}
      <CabezaloHero
        titulo={tituloHero}
        onAnterior={anteriorVisita ? () => navegarAHermana(anteriorVisita.id) : undefined}
        onSiguiente={siguienteVisita ? () => navegarAHermana(siguienteVisita.id) : undefined}
        mostrarAnterior={indice >= 0}
        mostrarSiguiente={indice >= 0}
        contadorNavegacion={indice >= 0 ? `${indice + 1} de ${hermanas.length}` : undefined}
        slotAcciones={accionesHero}
        slotControles={controlesHero}
      />

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6">

          {/* Sub-header con fecha principal y asignado */}
          <p className="text-sm text-texto-terciario mb-4 md:mb-6">
            {visita.fecha_completada
              ? `Completada · ${formato.fecha(visita.fecha_completada)} ${formato.hora(visita.fecha_completada)}`
              : `Programada · ${formato.fecha(visita.fecha_programada)} ${formato.hora(visita.fecha_programada)}`}
            {visita.asignado_nombre && <> · {visita.asignado_nombre}</>}
          </p>

          {/* Grid 2 columnas */}
          <div className={`grid grid-cols-1 ${hayRegistro ? 'md:grid-cols-[1fr_1fr]' : ''} gap-6`}>

            {/* ── COLUMNA IZQUIERDA: Datos de la visita ── */}
            <div className={`space-y-5 ${hayRegistro ? 'md:order-1 order-2' : ''}`}>
              {/* Detalles */}
              <div className="rounded-card bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  Detalles
                </p>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <label className="text-[11px] text-texto-terciario block mb-1">
                      {t('visitas.contacto')}
                    </label>
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-texto-terciario shrink-0" />
                      <button
                        onClick={() => router.push(`/contactos/${visita.contacto_id}`)}
                        className="text-sm text-texto-marca hover:underline truncate"
                      >
                        {visita.contacto_nombre}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-texto-terciario block mb-1">
                      {t('visitas.asignado')}
                    </label>
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-texto-terciario shrink-0" />
                      <span className="text-sm text-texto-primario truncate">
                        {visita.asignado_nombre || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-texto-terciario block mb-1">
                      {t('visitas.fecha_programada')}
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-texto-terciario shrink-0" />
                      <span className="text-sm text-texto-primario">
                        {formato.fecha(visita.fecha_programada)} · {formato.hora(visita.fecha_programada)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-texto-terciario block mb-1">
                      {t('visitas.prioridad')}
                    </label>
                    <Insignia color={
                      visita.prioridad === 'urgente' || visita.prioridad === 'alta' ? 'peligro'
                      : visita.prioridad === 'baja' ? 'info' : 'neutro' as never
                    }>
                      {t(`visitas.prioridades.${visita.prioridad}`)}
                    </Insignia>
                  </div>
                  {visita.motivo && (
                    <div className="col-span-2">
                      <label className="text-[11px] text-texto-terciario block mb-1">
                        {t('visitas.motivo')}
                      </label>
                      <p className="text-sm text-texto-primario">{visita.motivo}</p>
                    </div>
                  )}
                </div>

                {/* Quién recibió */}
                {visita.recibe_nombre && (
                  <div className="pt-3 border-t border-white/[0.05]">
                    <label className="text-[11px] text-texto-terciario block mb-1">
                      Recibió
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <User size={13} className="text-texto-terciario" />
                      <span className="text-sm text-texto-primario">{visita.recibe_nombre}</span>
                      {visita.recibe_telefono && (
                        <span className="flex items-center gap-1 text-xs text-texto-terciario">
                          <Phone size={11} />
                          {visita.recibe_telefono}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Indicaciones del admin */}
              {visita.notas && (
                <div className="p-3 rounded-card bg-[var(--insignia-info)]/[0.06] border border-[var(--insignia-info)]/15">
                  <p className="text-[10px] font-medium text-[var(--insignia-info)] uppercase tracking-wider mb-1">
                    Indicaciones
                  </p>
                  <p className="text-xs text-texto-secundario whitespace-pre-wrap">{visita.notas}</p>
                </div>
              )}

              {/* Dirección */}
              {visita.direccion_texto && (
                <div>
                  <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                    {t('visitas.direccion')}
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-card border border-white/[0.06] bg-white/[0.03]">
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
                        {t('visitas.navegar')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── COLUMNA DERECHA: Registro del visitador ── */}
            {hayRegistro && (
              <div className="space-y-5 md:order-2 order-1">
                {/* Pills: factibilidad + duración */}
                {(temp || visita.duracion_real_min != null || visita.fecha_llegada) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {temp && (
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          border: `1px solid ${temp.color}`,
                          backgroundColor: `color-mix(in srgb, ${temp.color} 12%, transparent)`,
                          color: temp.color,
                        }}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: temp.color }} />
                        Factibilidad {temp.etiqueta}
                      </span>
                    )}
                    {visita.duracion_real_min != null && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
                        <Clock size={11} />
                        {visita.duracion_real_min} min en sitio
                        {visita.duracion_estimada_min != null && (
                          <span className="text-texto-terciario"> / {visita.duracion_estimada_min} est.</span>
                        )}
                      </span>
                    )}
                    {visita.fecha_llegada && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-texto-secundario">
                        <CalendarClock size={11} />
                        Llegó {formato.hora(visita.fecha_llegada)}
                      </span>
                    )}
                  </div>
                )}

                {/* Notas del visitador */}
                {visita.notas_registro && (
                  <div>
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                      Notas del visitador
                    </label>
                    <p className="text-sm text-texto-primario leading-relaxed whitespace-pre-wrap">
                      {visita.notas_registro}
                    </p>
                  </div>
                )}

                {/* Fotos — abren lightbox interno */}
                {fotos.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                      Fotos ({fotos.length})
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {fotos.map((foto, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFotoAbierta(i)}
                          className="relative aspect-square rounded-card overflow-hidden border border-white/[0.06] hover:border-texto-marca/40 transition-colors"
                        >
                          <Image
                            src={foto.url}
                            alt={foto.nombre}
                            fill
                            sizes="(max-width: 768px) 25vw, 120px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
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

                {/* Checklist */}
                {totalChecklist > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                      {t('visitas.checklist')} ({completados}/{totalChecklist})
                    </label>
                    <div className="space-y-1">
                      {visita.checklist.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-card bg-white/[0.02]"
                        >
                          {item.completado
                            ? <CheckSquare size={14} className="text-[var(--insignia-exito)] shrink-0" />
                            : <Square size={14} className="text-texto-terciario shrink-0" />
                          }
                          <span className={`text-sm ${item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                            {item.texto}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Geolocalización del registro */}
                {visita.registro_lat && visita.registro_lng && (
                  <div>
                    <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                      {t('visitas.registro_ubicacion')}
                    </label>
                    <div className="flex items-center gap-2 p-3 rounded-card border border-white/[0.06] bg-white/[0.03]">
                      <MapPin size={14} className="text-[var(--insignia-exito)] shrink-0" />
                      <span className="text-xs text-texto-primario truncate">
                        {visita.registro_lat.toFixed(6)}, {visita.registro_lng.toFixed(6)}
                      </span>
                      {visita.registro_precision_m && (
                        <span className="text-xs text-texto-terciario">±{visita.registro_precision_m}m</span>
                      )}
                      <a
                        href={`https://www.google.com/maps?q=${visita.registro_lat},${visita.registro_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-texto-marca text-xs flex items-center gap-1 ml-auto shrink-0"
                      >
                        <ExternalLink size={12} />
                        {t('visitas.ver')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox de fotos */}
      {fotoAbierta !== null && fotos[fotoAbierta] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={cerrarLightbox}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cerrarLightbox() }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={20} />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); anteriorFoto() }}
                className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); siguienteFoto() }}
                className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight size={24} />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full">
                {fotoAbierta + 1} / {fotos.length}
              </span>
            </>
          )}

          <div
            className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={fotos[fotoAbierta].url}
              alt={fotos[fotoAbierta].nombre}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Modal de edición */}
      <ModalVisita
        abierto={modalEdicion.abierto}
        visita={modalEdicion.visitaEditando}
        miembros={modalEdicion.miembros}
        config={modalEdicion.config}
        onGuardar={async (datos) => {
          const actualizada = await modalEdicion.guardar(datos)
          if (actualizada) setVisita(actualizada)
          router.refresh()
        }}
        onCompletar={async (id) => {
          await modalEdicion.completarVisita(id)
          router.refresh()
        }}
        onCancelar={async (id) => {
          await modalEdicion.cancelarVisita(id)
          router.refresh()
        }}
        onCerrar={modalEdicion.cerrar}
      />
    </div>
  )
}
