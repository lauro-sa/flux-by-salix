'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tooltip } from '@/componentes/ui/Tooltip'
import {
  X, Phone, Mail, Hash, MapPin, Building2, Briefcase,
  ExternalLink, FileText, Image, Play, ChevronDown, ChevronUp,
  Link2, Download, UserCheck, Trash2, Clock,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { Conversacion, MensajeConAdjuntos } from '@/tipos/inbox'
import type { MediaVisor } from './PanelWhatsApp'

/**
 * Panel derecho colapsable — info del contacto + galería de medios.
 * Muestra: datos de contacto, historial, y archivos compartidos
 * organizados por tipo (fotos, videos, documentos, audio, enlaces).
 */

interface PropiedadesPanelInfo {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  abierto: boolean
  onCerrar: () => void
  onAbrirVisor?: (url: string) => void
}

interface DatosContacto {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  cargo: string | null
  rubro: string | null
  avatar_url: string | null
  es_provisorio: boolean
  origen: string | null
  tipo_contacto?: { etiqueta: string; color: string }
  direccion_principal?: string | null
}

/** Conversación previa del historial del contacto */
interface ConversacionHistorial {
  id: string
  estado: string
  tipo_canal: string
  creado_en: string
  ultimo_mensaje_texto: string | null
}

type TabMedia = 'fotos' | 'documentos' | 'enlaces'

export function PanelInfoContacto({ conversacion, mensajes, abierto, onCerrar, onAbrirVisor }: PropiedadesPanelInfo) {
  const [contacto, setContacto] = useState<DatosContacto | null>(null)
  const [historial, setHistorial] = useState<ConversacionHistorial[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [seccionAbierta, setSeccionAbierta] = useState<string>('datos')
  const [tabMedia, setTabMedia] = useState<TabMedia>('fotos')

  // Obtener datos del contacto via API route (bypasa RLS)
  useEffect(() => {
    setContacto(null)

    if (!conversacion?.contacto_id) return

    const obtenerContacto = async () => {
      try {
        const res = await fetch(`/api/contactos/${conversacion.contacto_id}`)
        if (!res.ok) {
          // Contacto fue eliminado — desvincular la conversación
          await fetch(`/api/inbox/conversaciones/${conversacion.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacto_id: null }),
          }).catch(() => {})
          return
        }
        const data = await res.json()
        if (data?.id) setContacto(data as DatosContacto)
      } catch (err) {
        console.error('Error al obtener contacto:', err)
      }
    }

    obtenerContacto()
  }, [conversacion?.contacto_id])

  // Obtener historial de conversaciones previas con este contacto
  useEffect(() => {
    setHistorial([])

    if (!conversacion?.contacto_id) return

    const obtenerHistorial = async () => {
      setCargandoHistorial(true)
      try {
        const res = await fetch(`/api/inbox/conversaciones?contacto_id=${conversacion.contacto_id}&por_pagina=10`)
        if (!res.ok) { setCargandoHistorial(false); return }
        const data = await res.json()
        const convs = (data.conversaciones || [])
          .filter((c: ConversacionHistorial) => c.id !== conversacion.id)
        setHistorial(convs as ConversacionHistorial[])
      } catch (err) {
        console.error('Error al obtener historial:', err)
      } finally {
        setCargandoHistorial(false)
      }
    }

    obtenerHistorial()
  }, [conversacion?.contacto_id, conversacion?.id])

  const [accionandoProvisorio, setAccionandoProvisorio] = useState(false)

  // Aceptar contacto provisorio → convertir en contacto real
  const aceptarProvisorio = async () => {
    if (!contacto?.id) return
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${contacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_provisorio: false }),
      })
      if (res.ok) {
        setContacto(prev => prev ? { ...prev, es_provisorio: false } : prev)
      }
    } catch (err) {
      console.error('Error aceptando contacto:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }

  // Descartar contacto provisorio → enviar a papelera
  const descartarProvisorio = async () => {
    if (!contacto?.id) return
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${contacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: true }),
      })
      if (res.ok) {
        setContacto(prev => prev ? { ...prev, es_provisorio: false } : prev)
      }
    } catch (err) {
      console.error('Error descartando contacto:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }

  const toggleSeccion = (seccion: string) => {
    setSeccionAbierta(seccionAbierta === seccion ? '' : seccion)
  }

  // Organizar medios por tipo
  const medios = useMemo(() => {
    const fotos: { url: string; fecha: string; tipo: 'imagen' | 'video' }[] = []
    const videos: { url: string; nombre: string; fecha: string }[] = []
    const audios: { url: string; nombre: string; fecha: string; tamano: number | null }[] = []
    const documentos: { url: string; nombre: string; fecha: string; tamano: number | null; mime: string }[] = []
    const enlaces: { url: string; texto: string; fecha: string }[] = []

    for (const msg of mensajes) {
      // Fotos y videos van juntos en la grilla visual
      if (msg.tipo_contenido === 'imagen') {
        for (const adj of msg.adjuntos) {
          fotos.push({ url: adj.url, fecha: msg.creado_en, tipo: 'imagen' })
        }
      }
      if (msg.tipo_contenido === 'video') {
        for (const adj of msg.adjuntos) {
          fotos.push({ url: adj.url, fecha: msg.creado_en, tipo: 'video' })
        }
      }
      // Audio
      if (msg.tipo_contenido === 'audio') {
        for (const adj of msg.adjuntos) {
          audios.push({ url: adj.url, nombre: adj.nombre_archivo, fecha: msg.creado_en, tamano: adj.tamano_bytes })
        }
      }
      // Documentos
      if (msg.tipo_contenido === 'documento') {
        for (const adj of msg.adjuntos) {
          documentos.push({ url: adj.url, nombre: adj.nombre_archivo, fecha: msg.creado_en, tamano: adj.tamano_bytes, mime: adj.tipo_mime })
        }
      }
      // Enlaces en texto
      if (msg.tipo_contenido === 'texto' && msg.texto) {
        const urlRegex = /https?:\/\/[^\s]+/g
        const urls = msg.texto.match(urlRegex)
        if (urls) {
          for (const url of urls) {
            enlaces.push({ url, texto: msg.texto, fecha: msg.creado_en })
          }
        }
      }
    }

    return { fotos, videos, audios, documentos, enlaces }
  }, [mensajes])

  const totalFotos = medios.fotos.length
  const totalDocs = medios.documentos.length
  const totalEnlaces = medios.enlaces.length

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full overflow-hidden flex-shrink-0"
          style={{
            borderLeft: '1px solid var(--borde-sutil)',
            background: 'var(--superficie-tarjeta)',
          }}
        >
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between p-3"
              style={{ borderBottom: '1px solid var(--borde-sutil)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                Info del contacto
              </span>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo="Cerrar"
                icono={<X size={16} />}
                onClick={onCerrar}
              />
            </div>

            {!conversacion?.contacto_id ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <Link2 size={20} style={{ color: 'var(--texto-terciario)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                  Sin contacto vinculado
                </p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--texto-terciario)' }}>
                  Vinculá esta conversación a un contacto existente.
                </p>
                <Boton variante="secundario" tamano="sm">
                  Vincular contacto
                </Boton>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {/* Avatar y nombre */}
                <div className="flex flex-col items-center text-center pt-2">
                  <Avatar nombre={conversacion.contacto_nombre || '?'} tamano="lg" />
                  <h3 className="text-sm font-semibold mt-2" style={{ color: 'var(--texto-primario)' }}>
                    {conversacion.contacto_nombre || 'Sin nombre'}
                  </h3>
                  {contacto?.cargo && (
                    <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{contacto.cargo}</p>
                  )}
                  {contacto?.tipo_contacto && (
                    <Insignia color={contacto.tipo_contacto.color as 'primario'} tamano="sm">
                      {contacto.tipo_contacto.etiqueta}
                    </Insignia>
                  )}

                  {/* Badge provisorio + acciones */}
                  {contacto?.es_provisorio && (
                    <div className="mt-2 w-full">
                      <div
                        className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md mb-2"
                        style={{ background: 'var(--insignia-advertencia-fondo)', color: 'var(--insignia-advertencia-texto)' }}
                      >
                        <Clock size={12} />
                        <span className="text-xs font-medium">Contacto provisorio</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Boton
                          variante="primario"
                          tamano="sm"
                          icono={<UserCheck size={14} />}
                          onClick={aceptarProvisorio}
                          disabled={accionandoProvisorio}
                          className="flex-1"
                        >
                          Aceptar
                        </Boton>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Trash2 size={14} />}
                          onClick={descartarProvisorio}
                          disabled={accionandoProvisorio}
                          className="flex-1 text-[var(--insignia-peligro)]"
                        >
                          Descartar
                        </Boton>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones rápidas */}
                <div className="flex items-center justify-center gap-2">
                  {conversacion.identificador_externo && (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      soloIcono
                      icono={<IconoWhatsApp size={16} />}
                      titulo="WhatsApp"
                    />
                  )}
                  {contacto?.telefono && (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      soloIcono
                      icono={<Phone size={16} />}
                      titulo="Llamar"
                    />
                  )}
                  {contacto?.correo && (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      soloIcono
                      icono={<Mail size={16} />}
                      titulo="Correo"
                    />
                  )}
                  <Tooltip contenido="Ver contacto completo">
                  <a
                    href={`/contactos/${conversacion.contacto_id}`}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                  >
                    <ExternalLink size={16} />
                  </a>
                  </Tooltip>
                </div>

                {/* Sección: Datos */}
                <SeccionColapsable
                  titulo="Datos de contacto"
                  abierta={seccionAbierta === 'datos'}
                  onToggle={() => toggleSeccion('datos')}
                >
                  <div className="space-y-2">
                    {contacto?.correo && <DatoContacto icono={<Mail size={12} />} valor={contacto.correo} />}
                    {contacto?.telefono && <DatoContacto icono={<Phone size={12} />} valor={contacto.telefono} />}
                    {contacto?.whatsapp && <DatoContacto icono={<IconoWhatsApp size={12} />} valor={contacto.whatsapp} />}
                    {contacto?.rubro && <DatoContacto icono={<Building2 size={12} />} valor={contacto.rubro} />}
                    {contacto?.cargo && <DatoContacto icono={<Briefcase size={12} />} valor={contacto.cargo} />}
                    {contacto?.direccion_principal && <DatoContacto icono={<MapPin size={12} />} valor={contacto.direccion_principal} />}
                    {!contacto && (
                      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando datos...</p>
                    )}
                  </div>
                </SeccionColapsable>

                {/* Sección: Historial */}
                <SeccionColapsable
                  titulo={`Historial${historial.length > 0 ? ` (${historial.length})` : ''}`}
                  abierta={seccionAbierta === 'historial'}
                  onToggle={() => toggleSeccion('historial')}
                >
                  {cargandoHistorial ? (
                    <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando historial...</p>
                  ) : historial.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                      Sin conversaciones anteriores.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {historial.map((conv) => {
                        // Icono según tipo de canal
                        const iconoCanal = conv.tipo_canal === 'whatsapp'
                          ? <IconoWhatsApp size={12} style={{ color: 'var(--canal-whatsapp)' }} />
                          : conv.tipo_canal === 'correo'
                            ? <Mail size={12} style={{ color: 'var(--canal-correo)' }} />
                            : <Hash size={12} style={{ color: 'var(--canal-interno)' }} />

                        // Color de insignia según estado
                        const colorEstado: Record<string, 'exito' | 'advertencia' | 'info' | 'neutro' | 'peligro'> = {
                          abierta: 'info',
                          pendiente: 'advertencia',
                          cerrada: 'neutro',
                          resuelta: 'exito',
                          archivada: 'neutro',
                        }

                        return (
                          <a
                            key={conv.id}
                            href={`/inbox?id=${conv.id}`}
                            className="flex items-start gap-2 px-2 py-1.5 rounded transition-colors hover:opacity-80"
                            style={{ background: 'var(--superficie-hover)' }}
                          >
                            <span className="mt-0.5 flex-shrink-0">{iconoCanal}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate" style={{ color: 'var(--texto-primario)' }}>
                                {conv.ultimo_mensaje_texto || 'Sin mensajes'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                                  {new Date(conv.creado_en).toLocaleDateString('es', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </span>
                                <Insignia color={colorEstado[conv.estado] || 'neutro'} tamano="sm">
                                  {conv.estado}
                                </Insignia>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </SeccionColapsable>
              </div>
            )}

            {/* ═══ Galería de Medios ═══ */}
            <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
              {/* Tabs de medios */}
              <div className="flex px-3 pt-2 gap-1">
                {[
                  { clave: 'fotos' as TabMedia, etiqueta: 'Fotos', cantidad: totalFotos },
                  { clave: 'documentos' as TabMedia, etiqueta: 'Docs', cantidad: totalDocs },
                  { clave: 'enlaces' as TabMedia, etiqueta: 'Enlaces', cantidad: totalEnlaces },
                ].map(tab => (
                  <Boton
                    key={tab.clave}
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => setTabMedia(tab.clave)}
                    className="flex-1 text-center"
                    style={{
                      background: tabMedia === tab.clave ? 'var(--superficie-hover)' : 'transparent',
                      color: tabMedia === tab.clave ? 'var(--texto-primario)' : 'var(--texto-terciario)',
                      fontWeight: tabMedia === tab.clave ? 600 : 400,
                    }}
                  >
                    {tab.etiqueta} {tab.cantidad > 0 && <span className="opacity-60">({tab.cantidad})</span>}
                  </Boton>
                ))}
              </div>

              {/* Contenido de la tab */}
              <div className="p-3 min-h-[120px]">
                {tabMedia === 'fotos' && (
                  totalFotos === 0 ? (
                    <EstadoVacioMedia icono={<Image size={20} />} texto="Sin fotos ni videos" />
                  ) : (
                    <div className="grid grid-cols-3 gap-1 rounded-md overflow-hidden">
                      {medios.fotos.map((media, i) => (
                        <Boton
                          key={`media-${i}`}
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => onAbrirVisor?.(media.url)}
                          className="aspect-square overflow-hidden relative p-0"
                        >
                          {media.tipo === 'video' ? (
                            <>
                              <video
                                src={media.url}
                                preload="metadata"
                                muted
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-black/50">
                                  <Play size={12} className="text-white ml-px" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img
                              src={media.url}
                              alt=""
                              className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          )}
                        </Boton>
                      ))}
                    </div>
                  )
                )}

                {tabMedia === 'documentos' && (
                  totalDocs === 0 ? (
                    <EstadoVacioMedia icono={<FileText size={20} />} texto="Sin documentos" />
                  ) : (
                    <div className="space-y-1">
                      {/* Documentos */}
                      {medios.documentos.map((doc, i) => (
                        <a
                          key={`doc-${i}`}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
                          style={{ background: 'var(--superficie-hover)' }}
                        >
                          <FileText size={14} style={{ color: 'var(--texto-marca)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate" style={{ color: 'var(--texto-primario)' }}>
                              {doc.nombre}
                            </p>
                            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                              {doc.tamano ? (doc.tamano > 1048576 ? `${(doc.tamano / 1048576).toFixed(1)} MB` : `${(doc.tamano / 1024).toFixed(0)} KB`) : ''}
                              {doc.tamano ? ' · ' : ''}
                              {new Date(doc.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <Download size={12} style={{ color: 'var(--texto-terciario)' }} />
                        </a>
                      ))}
                    </div>
                  )
                )}

                {tabMedia === 'enlaces' && (
                  totalEnlaces === 0 ? (
                    <EstadoVacioMedia icono={<Link2 size={20} />} texto="Sin enlaces compartidos" />
                  ) : (
                    <div className="space-y-1">
                      {medios.enlaces.map((enlace, i) => (
                        <a
                          key={`link-${i}`}
                          href={enlace.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 px-2 py-1.5 rounded transition-colors"
                          style={{ background: 'var(--superficie-hover)' }}
                        >
                          <ExternalLink size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--texto-marca)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate" style={{ color: 'var(--texto-marca)' }}>
                              {enlace.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </p>
                            <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                              {enlace.texto.length > 60 ? enlace.texto.slice(0, 60) + '...' : enlace.texto}
                            </p>
                          </div>
                          <span className="text-xxs flex-shrink-0" style={{ color: 'var(--texto-terciario)' }}>
                            {new Date(enlace.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        </a>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Estado vacío para las tabs de media
function EstadoVacioMedia({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
      >
        {icono}
      </div>
      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{texto}</p>
    </div>
  )
}

// Sección colapsable
function SeccionColapsable({
  titulo,
  abierta,
  onToggle,
  children,
}: {
  titulo: string
  abierta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
      <Boton
        variante="fantasma"
        tamano="sm"
        anchoCompleto
        onClick={onToggle}
        iconoDerecho={abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        className="justify-between py-2 text-xs font-medium"
        style={{ color: 'var(--texto-secundario)' }}
      >
        {titulo}
      </Boton>
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Línea de dato de contacto
function DatoContacto({ icono, valor }: { icono: React.ReactNode; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--texto-terciario)' }}>{icono}</span>
      <span className="text-xs truncate" style={{ color: 'var(--texto-secundario)' }}>{valor}</span>
    </div>
  )
}
