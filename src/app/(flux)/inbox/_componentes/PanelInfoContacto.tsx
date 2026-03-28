'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  X, Phone, Mail, MessageCircle, MapPin, Building2, Briefcase,
  ExternalLink, FileText, Image, Play, ChevronDown, ChevronUp,
  Link2, Download,
} from 'lucide-react'
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
  tipo_contacto?: { etiqueta: string; color: string }
  direccion_principal?: string | null
}

type TabMedia = 'fotos' | 'documentos' | 'enlaces'

export function PanelInfoContacto({ conversacion, mensajes, abierto, onCerrar, onAbrirVisor }: PropiedadesPanelInfo) {
  const [contacto, setContacto] = useState<DatosContacto | null>(null)
  const [seccionAbierta, setSeccionAbierta] = useState<string>('datos')
  const [tabMedia, setTabMedia] = useState<TabMedia>('fotos')

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
              <button
                onClick={onCerrar}
                className="p-1 rounded-md transition-colors"
                style={{ color: 'var(--texto-terciario)' }}
              >
                <X size={16} />
              </button>
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
                </div>

                {/* Acciones rápidas */}
                <div className="flex items-center justify-center gap-2">
                  {conversacion.identificador_externo && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--canal-whatsapp)' }}
                      title="WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                  )}
                  {contacto?.telefono && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
                      title="Llamar"
                    >
                      <Phone size={16} />
                    </button>
                  )}
                  {contacto?.correo && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--canal-correo)' }}
                      title="Correo"
                    >
                      <Mail size={16} />
                    </button>
                  )}
                  <a
                    href={`/contactos/${conversacion.contacto_id}`}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                    title="Ver contacto completo"
                  >
                    <ExternalLink size={16} />
                  </a>
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
                    {contacto?.whatsapp && <DatoContacto icono={<MessageCircle size={12} />} valor={contacto.whatsapp} />}
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
                  titulo="Historial"
                  abierta={seccionAbierta === 'historial'}
                  onToggle={() => toggleSeccion('historial')}
                >
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    Conversaciones anteriores con este contacto aparecerán acá.
                  </p>
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
                  <button
                    key={tab.clave}
                    onClick={() => setTabMedia(tab.clave)}
                    className="flex-1 text-xxs py-1.5 rounded-md transition-colors text-center"
                    style={{
                      background: tabMedia === tab.clave ? 'var(--superficie-hover)' : 'transparent',
                      color: tabMedia === tab.clave ? 'var(--texto-primario)' : 'var(--texto-terciario)',
                      fontWeight: tabMedia === tab.clave ? 600 : 400,
                    }}
                  >
                    {tab.etiqueta} {tab.cantidad > 0 && <span className="opacity-60">({tab.cantidad})</span>}
                  </button>
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
                        <button
                          key={`media-${i}`}
                          onClick={() => onAbrirVisor?.(media.url)}
                          className="aspect-square overflow-hidden relative"
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
                        </button>
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
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-xs font-medium"
        style={{ color: 'var(--texto-secundario)' }}
      >
        {titulo}
        {abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
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
