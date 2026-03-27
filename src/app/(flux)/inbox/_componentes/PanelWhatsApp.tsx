'use client'

import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import {
  Check, CheckCheck, Clock, AlertCircle, Play, Pause,
  Download, FileText, MapPin, User,
} from 'lucide-react'
import { CompositorMensaje, type DatosMensaje } from './CompositorMensaje'
import type { MensajeConAdjuntos, Conversacion } from '@/tipos/inbox'

/**
 * Panel central de WhatsApp — burbujas de chat con soporte multimedia.
 * Muestra: texto, imágenes, audio, video, stickers, documentos, ubicación.
 */

interface PropiedadesPanelWhatsApp {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  onEnviar: (datos: DatosMensaje) => void
  onAdjuntar?: (archivos: File[]) => void
  cargando: boolean
  enviando: boolean
}

// Iconos de estado de entrega
const ICONO_ESTADO: Record<string, React.ReactNode> = {
  enviado: <Check size={12} style={{ color: 'var(--texto-terciario)' }} />,
  entregado: <CheckCheck size={12} style={{ color: 'var(--texto-terciario)' }} />,
  leido: <CheckCheck size={12} style={{ color: '#53bdeb' }} />,
  fallido: <AlertCircle size={12} style={{ color: 'var(--insignia-peligro)' }} />,
}

function formatoHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

export function PanelWhatsApp({
  conversacion,
  mensajes,
  onEnviar,
  onAdjuntar,
  cargando,
  enviando,
}: PropiedadesPanelWhatsApp) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  if (!conversacion) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--superficie-app)' }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--canal-whatsapp)' }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
            Seleccioná una conversación
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--superficie-app)' }}>
      {/* Header de la conversación */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          borderBottom: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-tarjeta)',
        }}
      >
        <Avatar
          nombre={conversacion.contacto_nombre || conversacion.identificador_externo || '?'}
          tamano="sm"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--texto-primario)' }}>
            {conversacion.contacto_nombre || conversacion.identificador_externo || 'Conversación'}
          </h3>
          {conversacion.identificador_externo && (
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {conversacion.identificador_externo}
            </p>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--superficie-hover) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {cargando ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--texto-terciario)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        ) : (
          mensajes.map((msg, idx) => {
            const esPropio = !msg.es_entrante
            const mostrarHora = idx === 0 ||
              new Date(msg.creado_en).getTime() - new Date(mensajes[idx - 1].creado_en).getTime() > 300000

            return (
              <div key={msg.id}>
                {/* Separador de tiempo */}
                {mostrarHora && idx > 0 && (
                  <div className="flex items-center justify-center my-3">
                    <span
                      className="text-xxs px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--superficie-elevada)',
                        color: 'var(--texto-terciario)',
                      }}
                    >
                      {new Date(msg.creado_en).toLocaleDateString('es', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {/* Burbuja */}
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${esPropio ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[75%] rounded-lg px-3 py-1.5 relative"
                    style={{
                      background: esPropio
                        ? 'var(--superficie-seleccionada)'
                        : 'var(--superficie-tarjeta)',
                      borderTopLeftRadius: esPropio ? undefined : '4px',
                      borderTopRightRadius: esPropio ? '4px' : undefined,
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {/* Nombre remitente (mensajes entrantes) */}
                    {!esPropio && msg.remitente_nombre && (
                      <p
                        className="text-xxs font-semibold mb-0.5"
                        style={{ color: 'var(--canal-whatsapp)' }}
                      >
                        {msg.remitente_nombre}
                      </p>
                    )}

                    {/* Contenido del mensaje */}
                    <ContenidoMensaje mensaje={msg} />

                    {/* Hora + estado */}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(msg.creado_en)}
                      </span>
                      {esPropio && ICONO_ESTADO[msg.wa_status || msg.estado]}
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          })
        )}
      </div>

      {/* Compositor */}
      <CompositorMensaje
        tipoCanal="whatsapp"
        onEnviar={onEnviar}
        onAdjuntar={onAdjuntar}
        cargando={enviando}
        placeholder="Escribir mensaje..."
        onAbrirPlantillas={() => {}}
      />
    </div>
  )
}

// Renderizar contenido según tipo
function ContenidoMensaje({ mensaje }: { mensaje: MensajeConAdjuntos }) {
  const { tipo_contenido, texto, adjuntos } = mensaje

  switch (tipo_contenido) {
    case 'imagen':
      return (
        <div className="space-y-1">
          {adjuntos.map((adj) => (
            <img
              key={adj.id}
              src={adj.url}
              alt={adj.nombre_archivo}
              className="rounded-md max-w-full cursor-pointer"
              style={{ maxHeight: 300 }}
            />
          ))}
          {texto && (
            <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>
              {texto}
            </p>
          )}
        </div>
      )

    case 'audio':
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--texto-marca)', color: '#fff' }}
          >
            <Play size={14} />
          </button>
          <div className="flex-1">
            <div
              className="h-1 rounded-full"
              style={{ background: 'var(--borde-sutil)' }}
            >
              <div
                className="h-1 rounded-full w-0"
                style={{ background: 'var(--texto-marca)' }}
              />
            </div>
          </div>
          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            {adjuntos[0]?.duracion_segundos
              ? `${Math.floor(adjuntos[0].duracion_segundos / 60)}:${(adjuntos[0].duracion_segundos % 60).toString().padStart(2, '0')}`
              : '0:00'}
          </span>
        </div>
      )

    case 'video':
      return (
        <div className="space-y-1">
          {adjuntos.map((adj) => (
            <div key={adj.id} className="relative rounded-md overflow-hidden">
              {adj.miniatura_url ? (
                <img src={adj.miniatura_url} alt="" className="max-w-full" style={{ maxHeight: 250 }} />
              ) : (
                <div
                  className="w-full h-40 flex items-center justify-center"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <Play size={32} style={{ color: 'var(--texto-terciario)' }} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50">
                  <Play size={20} className="text-white ml-0.5" />
                </div>
              </div>
            </div>
          ))}
          {texto && (
            <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{texto}</p>
          )}
        </div>
      )

    case 'documento':
      return (
        <div className="space-y-1">
          {adjuntos.map((adj) => (
            <a
              key={adj.id}
              href={adj.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ background: 'var(--superficie-hover)' }}
            >
              <FileText size={16} style={{ color: 'var(--texto-marca)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                  {adj.nombre_archivo}
                </p>
                {adj.tamano_bytes && (
                  <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                    {(adj.tamano_bytes / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
              <Download size={14} style={{ color: 'var(--texto-terciario)' }} />
            </a>
          ))}
          {texto && (
            <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{texto}</p>
          )}
        </div>
      )

    case 'sticker':
      return (
        <div>
          {adjuntos.map((adj) => (
            <img
              key={adj.id}
              src={adj.url}
              alt="sticker"
              className="w-32 h-32 object-contain"
            />
          ))}
        </div>
      )

    case 'ubicacion':
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <MapPin size={16} style={{ color: 'var(--insignia-peligro)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {texto || 'Ubicación compartida'}
          </span>
        </div>
      )

    case 'contacto_compartido':
      return (
        <div className="flex items-center gap-2">
          <User size={16} style={{ color: 'var(--texto-marca)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {texto || 'Contacto compartido'}
          </span>
        </div>
      )

    default:
      return (
        <p
          className="text-sm whitespace-pre-wrap break-words"
          style={{ color: 'var(--texto-primario)' }}
        >
          {texto}
        </p>
      )
  }
}
