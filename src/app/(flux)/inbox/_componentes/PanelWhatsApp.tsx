'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import {
  Check, CheckCheck, Clock, AlertCircle, Play, Pause,
  Download, FileText, MapPin, User, X, ChevronLeft, ChevronRight,
  Image, Music, StickyNote, Pencil, Trash2, Tag, SmilePlus,
  FileDown, Bot, Sparkles,
} from 'lucide-react'
import { ModalEtiquetas } from './ModalEtiquetas'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { CompositorMensaje, type DatosMensaje } from './CompositorMensaje'
import { PanelIA } from './PanelIA'
import { COLOR_ETIQUETA_DEFECTO } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'
import type { MensajeConAdjuntos, MensajeAdjunto, Conversacion } from '@/tipos/inbox'

/**
 * Panel central de WhatsApp — burbujas de chat con soporte multimedia.
 * Muestra: texto, imágenes, audio, video, stickers, documentos, ubicación.
 * Fecha sticky al scroll, agrupación de imágenes, visor fullscreen.
 */

interface PropiedadesPanelWhatsApp {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  onEnviar: (datos: DatosMensaje) => void
  onAbrirVisor: (url: string) => void
  onEditarNota?: (id: string, texto: string) => void
  onEliminarNota?: (id: string) => void
  /** Si true, muestra el PanelIA con sugerencias/resumen/sentimiento */
  iaHabilitada?: boolean
  /** Callback cuando cambian las etiquetas de la conversación (actualización inmediata) */
  onEtiquetasCambiaron?: (etiquetas: string[]) => void
  cargando: boolean
  enviando: boolean
  /** Callback para cargar mensajes anteriores (scroll infinito) */
  onCargarAnteriores?: () => void
  /** Si hay más mensajes anteriores para cargar */
  hayMasAnteriores?: boolean
  /** Si se están cargando mensajes anteriores */
  cargandoAnteriores?: boolean
}

// Iconos de estado de entrega
// Soporta claves en español (estado) e inglés (wa_status de Meta)
const ICONO_ESTADO: Record<string, React.ReactNode> = {
  sending: <Clock size={12} style={{ color: 'var(--texto-terciario)' }} />,
  enviado: <Check size={12} style={{ color: 'var(--texto-terciario)' }} />,
  sent: <Check size={12} style={{ color: 'var(--texto-terciario)' }} />,
  entregado: <CheckCheck size={12} style={{ color: 'var(--texto-terciario)' }} />,
  delivered: <CheckCheck size={12} style={{ color: 'var(--texto-terciario)' }} />,
  leido: <CheckCheck size={12} style={{ color: 'var(--canal-whatsapp)' }} />,
  read: <CheckCheck size={12} style={{ color: 'var(--canal-whatsapp)' }} />,
  fallido: <AlertCircle size={12} style={{ color: 'var(--insignia-peligro)' }} />,
  failed: <AlertCircle size={12} style={{ color: 'var(--insignia-peligro)' }} />,
}

function formatoHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

// Etiqueta de día estilo WhatsApp: Hoy, Ayer, Lunes..Domingo, o fecha completa
function etiquetaDia(fecha: Date): string {
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, ayer)) return 'Ayer'

  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 6)
  hace7Dias.setHours(0, 0, 0, 0)

  if (fecha >= hace7Dias) {
    return fecha.toLocaleDateString('es', { weekday: 'long' })
      .replace(/^\w/, c => c.toUpperCase())
  }

  return fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Verificar si dos fechas son días distintos
function esDiaDiferente(a: string, b: string): boolean {
  const fa = new Date(a)
  const fb = new Date(b)
  return fa.getFullYear() !== fb.getFullYear() ||
    fa.getMonth() !== fb.getMonth() ||
    fa.getDate() !== fb.getDate()
}

// Detectar si el texto es un placeholder de media (no mostrarlo en burbuja)
function esPlaceholderMedia(texto: string | null): boolean {
  if (!texto) return true
  return /^\[(Imagen|Video|Audio|Sticker|Documento|Ubicación|Contacto)/.test(texto)
}

function textoVisible(texto: string | null): string | null {
  if (!texto || esPlaceholderMedia(texto)) return null
  return texto
}

function formatoDuracion(segundos: number): string {
  const min = Math.floor(segundos / 60)
  const seg = Math.floor(segundos % 60)
  return `${min}:${seg.toString().padStart(2, '0')}`
}

/**
 * Parsear formato WhatsApp (*negrita*, _cursiva_, ~tachado~, ```código```)
 * y convertir a HTML para renderizar en las burbujas de Flux.
 */
function formatoWhatsApp(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code>$1</code>')
}

// ─── Interfaz de media para el visor (imágenes + videos) ───
export interface MediaVisor {
  url: string
  tipo: 'imagen' | 'video'
  caption: string | null
  fecha: string
}

// ─── Tipos de elementos renderizables (pre-procesados) ───
type ElementoChat =
  | { tipo: 'separador'; fecha: Date; key: string }
  | { tipo: 'burbuja'; mensaje: MensajeConAdjuntos; key: string }
  | { tipo: 'grupo_imagenes'; mensajes: MensajeConAdjuntos[]; key: string }

/** Pre-procesa mensajes en elementos renderizables, agrupando imágenes consecutivas */
function prepararElementos(mensajes: MensajeConAdjuntos[]): ElementoChat[] {
  const elementos: ElementoChat[] = []
  let i = 0

  while (i < mensajes.length) {
    const msg = mensajes[i]

    // Separador de día
    if (i === 0 || esDiaDiferente(mensajes[i - 1].creado_en, msg.creado_en)) {
      elementos.push({ tipo: 'separador', fecha: new Date(msg.creado_en), key: `sep-${msg.id}` })
    }

    // Detectar grupo de imágenes consecutivas
    if (msg.tipo_contenido === 'imagen' && msg.adjuntos.length > 0) {
      const grupo: MensajeConAdjuntos[] = [msg]
      let j = i + 1
      while (
        j < mensajes.length &&
        mensajes[j].tipo_contenido === 'imagen' &&
        mensajes[j].es_entrante === msg.es_entrante &&
        mensajes[j].adjuntos.length > 0 &&
        !esDiaDiferente(mensajes[j - 1].creado_en, mensajes[j].creado_en) &&
        new Date(mensajes[j].creado_en).getTime() - new Date(mensajes[j - 1].creado_en).getTime() < 60000
      ) {
        grupo.push(mensajes[j])
        j++
      }

      if (grupo.length >= 2) {
        elementos.push({ tipo: 'grupo_imagenes', mensajes: grupo, key: `grp-${msg.id}` })
        i = j
        continue
      }
    }

    // Todos los mensajes se muestran (media sin adjunto muestra estado de carga)
    const esMediaSinContenido = ['imagen', 'audio', 'video', 'documento', 'sticker'].includes(msg.tipo_contenido)
      && !msg.adjuntos.length && !msg.texto
    // Solo omitir mensajes de texto completamente vacíos
    if (msg.texto || msg.adjuntos.length > 0 || esMediaSinContenido
      || msg.tipo_contenido === 'ubicacion' || msg.tipo_contenido === 'contacto_compartido') {
      elementos.push({ tipo: 'burbuja', mensaje: msg, key: msg.id })
    }

    i++
  }

  return elementos
}

// ═══════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════

export function PanelWhatsApp({
  conversacion,
  mensajes,
  onEnviar,
  onAbrirVisor,
  onEditarNota,
  onEliminarNota,
  iaHabilitada = false,
  onEtiquetasCambiaron,
  cargando,
  enviando,
  onCargarAnteriores,
  hayMasAnteriores = false,
  cargandoAnteriores = false,
}: PropiedadesPanelWhatsApp) {
  const { t } = useTraduccion()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Texto inyectado desde PanelIA hacia el compositor.
  const [textoIA, setTextoIA] = useState('')
  const [contadorTextoIA, setContadorTextoIA] = useState(0)

  // Etiquetas de la empresa (para mostrar colores)
  const [etiquetasEmpresa, setEtiquetasEmpresa] = useState<Record<string, { color: string; icono: string | null }>>({})
  useEffect(() => {
    fetch('/api/inbox/etiquetas')
      .then(res => res.json())
      .then(data => {
        const mapa: Record<string, { color: string; icono: string | null }> = {}
        for (const et of (data.etiquetas || [])) {
          mapa[et.nombre] = { color: et.color, icono: et.icono }
        }
        setEtiquetasEmpresa(mapa)
      })
      .catch(() => {})
  }, [])

  // Edición inline de notas internas
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null)
  const [textoEditandoNota, setTextoEditandoNota] = useState('')

  // Modal de etiquetas
  const [modalEtiquetas, setModalEtiquetas] = useState(false)
  // Etiqueta expandida (muestra X para quitar)
  const [etiquetaExpandida, setEtiquetaExpandida] = useState<string | null>(null)

  // Reacciones: picker de emojis rápidos
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const EMOJIS_RAPIDOS = ['👍', '✅', '🙏', '👀', '📌', '⭐']

  // Cerrar picker al hacer clic fuera
  useEffect(() => {
    if (!pickerMsgId) return
    const cerrar = () => setPickerMsgId(null)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [pickerMsgId])

  // Pre-procesar elementos de chat
  const elementos = useMemo(() => prepararElementos(mensajes), [mensajes])

  // Trackear si el usuario está cerca del fondo (para auto-scroll inteligente)
  const estaCercaDelFondoRef = useRef(true)

  // Auto-scroll al último mensaje, pero solo si estaba cerca del fondo
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (estaCercaDelFondoRef.current) {
      el.scrollTop = el.scrollHeight
      const t = setTimeout(() => { el.scrollTop = el.scrollHeight }, 100)
      return () => clearTimeout(t)
    }
  }, [mensajes])

  // Detectar scroll: si llega al tope → cargar anteriores, trackear posición
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Trackear si está cerca del fondo (dentro de 150px)
    estaCercaDelFondoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    // Si llega al tope, cargar anteriores
    if (el.scrollTop < 50 && hayMasAnteriores && !cargandoAnteriores && onCargarAnteriores) {
      const scrollHeightAntes = el.scrollHeight
      onCargarAnteriores()
      // Preservar posición de scroll después de insertar mensajes arriba
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const diff = el.scrollHeight - scrollHeightAntes
          if (diff > 0) el.scrollTop = diff
        })
      })
    }
  }, [hayMasAnteriores, cargandoAnteriores, onCargarAnteriores])

  if (!conversacion) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--superficie-app)' }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <IconoWhatsApp size={32} style={{ color: 'var(--canal-whatsapp)' }} />
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
          {/* Etiquetas asignadas con color — click para expandir X y quitar */}
          {conversacion.etiquetas && conversacion.etiquetas.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {conversacion.etiquetas.map((et) => {
                const info = etiquetasEmpresa[et]
                const colorEt = info?.color || COLOR_ETIQUETA_DEFECTO
                const expandida = etiquetaExpandida === et
                return (
                  <span
                    key={et}
                    className="text-xxs px-1.5 py-0.5 rounded-full font-medium cursor-pointer inline-flex items-center gap-1 transition-all"
                    style={{
                      background: `color-mix(in srgb, ${colorEt} 15%, transparent)`,
                      color: colorEt,
                    }}
                    onClick={() => setEtiquetaExpandida(expandida ? null : et)}
                  >
                    {info?.icono ? `${info.icono} ` : ''}{et}
                    {expandida && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const nuevas = conversacion.etiquetas.filter(e2 => e2 !== et)
                          // Actualizar inmediatamente
                          onEtiquetasCambiaron?.(nuevas)
                          setEtiquetaExpandida(null)
                          // Persistir en BD
                          fetch(`/api/inbox/conversaciones/${conversacion.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ etiquetas: nuevas }),
                          })
                        }}
                        className="rounded-full flex items-center justify-center"
                        style={{ color: colorEt }}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {/* Acciones del header */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setModalEtiquetas(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--texto-terciario)' }}
            title={t('inbox.etiquetar')}
          >
            <Tag size={16} />
          </button>
          <button
            onClick={() => {
              // Descargar como CSV
              window.open(`/api/inbox/exportar?conversacion_id=${conversacion.id}&formato=csv`, '_blank')
            }}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--texto-terciario)' }}
            title={t('inbox.exportar_conversacion')}
          >
            <FileDown size={16} />
          </button>
        </div>
      </div>

      {/* Modal de etiquetas */}
      <ModalEtiquetas
        abierto={modalEtiquetas}
        onCerrar={() => setModalEtiquetas(false)}
        conversacionId={conversacion.id}
        etiquetasAsignadas={conversacion.etiquetas || []}
        onCambio={(nuevasEtiquetas) => onEtiquetasCambiaron?.(nuevasEtiquetas)}
      />

      {/* Mensajes */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--superficie-hover) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Indicador de carga de mensajes anteriores */}
        {cargandoAnteriores && (
          <div className="flex justify-center py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--texto-terciario)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}
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
          elementos.map((elem) => {
            if (elem.tipo === 'separador') {
              return (
                <div
                  key={elem.key}
                  className="flex items-center justify-center py-2 z-10"
                  style={{ position: 'sticky', top: 0 }}
                >
                  <span
                    className="text-xxs px-3 py-1 rounded-lg shadow-sm"
                    style={{
                      background: 'var(--superficie-elevada)',
                      color: 'var(--texto-terciario)',
                    }}
                  >
                    {etiquetaDia(elem.fecha)}
                  </span>
                </div>
              )
            }

            if (elem.tipo === 'grupo_imagenes') {
              const primerMsg = elem.mensajes[0]
              const esPropio = !primerMsg.es_entrante
              return (
                <motion.div
                  key={elem.key}
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
                    {!esPropio && primerMsg.remitente_nombre && (
                      <p className="text-xxs font-semibold mb-0.5" style={{ color: 'var(--canal-whatsapp)' }}>
                        {primerMsg.remitente_nombre}
                      </p>
                    )}
                    <GrillaImagenes imagenes={elem.mensajes} onAbrirVisor={onAbrirVisor} />
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(elem.mensajes[elem.mensajes.length - 1].creado_en)}
                      </span>
                      {esPropio && ICONO_ESTADO[primerMsg.wa_status || primerMsg.estado]}
                    </div>
                  </div>
                </motion.div>
              )
            }

            // Burbuja individual
            const msg = elem.mensaje
            const esPropio = !msg.es_entrante
            const esNota = msg.es_nota_interna

            // Nota interna: burbuja centrada con estilo diferenciado
            if (esNota) {
              const editandoEsta = editandoNotaId === msg.id
              const esSugerenciaIA = msg.metadata?.tipo === 'sugerencia_ia'
              const esBorradorIA = msg.metadata?.tipo === 'borrador_ia'

              // Sugerencia IA: estilo especial con botones aprobar/rechazar
              if (esSugerenciaIA || esBorradorIA) {
                return (
                  <motion.div
                    key={elem.key}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="flex justify-center"
                  >
                    <div
                      className="max-w-[85%] rounded-lg px-3 py-2 relative"
                      style={{
                        background: 'color-mix(in srgb, var(--texto-marca) 8%, var(--superficie-tarjeta))',
                        border: '1px dashed color-mix(in srgb, var(--texto-marca) 40%, transparent)',
                        boxShadow: 'var(--sombra-sm)',
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles size={10} style={{ color: 'var(--texto-marca)' }} />
                        <span className="text-xxs font-semibold" style={{ color: 'var(--texto-marca)' }}>
                          {esSugerenciaIA ? 'Sugerencia IA' : 'Borrador IA'}
                        </span>
                        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          — {msg.remitente_nombre}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: 'var(--texto-secundario)' }}>
                        {msg.texto}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEnviar({ texto: msg.texto || '', tipo_contenido: 'texto' })}
                          className="text-xxs font-medium px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                          style={{
                            background: 'color-mix(in srgb, var(--insignia-exito) 15%, transparent)',
                            color: 'var(--insignia-exito)',
                          }}
                        >
                          Aprobar y enviar
                        </button>
                        {onEliminarNota && (
                          <button
                            onClick={() => onEliminarNota(msg.id)}
                            className="text-xxs font-medium px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                            style={{
                              background: 'color-mix(in srgb, var(--insignia-peligro) 10%, transparent)',
                              color: 'var(--insignia-peligro)',
                            }}
                          >
                            Descartar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-end mt-1">
                        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          {formatoHora(msg.creado_en)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              }

              return (
                <motion.div
                  key={elem.key}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex justify-center group/nota"
                >
                  <div
                    className="max-w-[85%] rounded-lg px-3 py-2 relative"
                    style={{
                      background: 'color-mix(in srgb, var(--insignia-advertencia) 10%, var(--superficie-tarjeta))',
                      border: '1px dashed color-mix(in srgb, var(--insignia-advertencia) 40%, transparent)',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {/* Header: icono + nombre + acciones */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <StickyNote size={10} style={{ color: 'var(--insignia-advertencia)' }} />
                      <span className="text-xxs font-semibold" style={{ color: 'var(--insignia-advertencia)' }}>
                        Nota interna
                      </span>
                      {msg.remitente_nombre && (
                        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          — {msg.remitente_nombre}
                        </span>
                      )}
                      {/* Botones editar/eliminar (hover) */}
                      {(onEditarNota || onEliminarNota) && !editandoEsta && (
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/nota:opacity-100 transition-opacity">
                          {onEditarNota && (
                            <button
                              onClick={() => {
                                setEditandoNotaId(msg.id)
                                setTextoEditandoNota(msg.texto || '')
                              }}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--texto-terciario)' }}
                              title={t('comun.editar')}
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                          {onEliminarNota && (
                            <button
                              onClick={() => onEliminarNota(msg.id)}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--texto-terciario)' }}
                              title={t('comun.eliminar')}
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contenido: texto o editor inline */}
                    {editandoEsta ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={textoEditandoNota}
                          onChange={(e) => setTextoEditandoNota(e.target.value)}
                          className="w-full text-sm bg-transparent outline-none resize-none rounded p-1"
                          style={{
                            color: 'var(--texto-secundario)',
                            border: '1px solid color-mix(in srgb, var(--insignia-advertencia) 40%, transparent)',
                            minHeight: 40,
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              if (textoEditandoNota.trim() && onEditarNota) {
                                onEditarNota(msg.id, textoEditandoNota.trim())
                                setEditandoNotaId(null)
                              }
                            }
                            if (e.key === 'Escape') {
                              setEditandoNotaId(null)
                            }
                          }}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditandoNotaId(null)}
                            className="text-xxs px-2 py-0.5 rounded"
                            style={{ color: 'var(--texto-terciario)' }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              if (textoEditandoNota.trim() && onEditarNota) {
                                onEditarNota(msg.id, textoEditandoNota.trim())
                                setEditandoNotaId(null)
                              }
                            }}
                            className="text-xxs px-2 py-0.5 rounded font-medium"
                            style={{ color: 'var(--insignia-advertencia)' }}
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--texto-secundario)' }}>
                        {msg.texto}
                      </p>
                    )}

                    {/* Footer: hora + editado */}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {msg.editado_en && (
                        <span className="text-xxs italic" style={{ color: 'var(--texto-terciario)' }}>
                          editada
                        </span>
                      )}
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(msg.creado_en)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            }

            const tieneReacciones = msg.reacciones && Object.keys(msg.reacciones).length > 0
            const pickerAbierto = pickerMsgId === msg.id
            const esBot = msg.remitente_tipo === 'bot'

            // ─── Burbuja de bot: estilo diferenciado con icono ───
            if (esBot) {
              // Detectar líneas con opciones numeradas (1️⃣, 2️⃣ o "1.", "2.")
              const lineas = (msg.texto || '').split('\n')
              const opcionesRegex = /^(\d️⃣|\d+[.)]\s*)/
              const tieneOpciones = lineas.some(l => opcionesRegex.test(l.trim()))

              return (
                <motion.div
                  key={elem.key}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[75%] rounded-lg px-3 py-1.5 relative"
                    style={{
                      background: 'color-mix(in srgb, var(--texto-marca) 8%, var(--superficie-seleccionada))',
                      border: '1px solid color-mix(in srgb, var(--texto-marca) 20%, transparent)',
                      borderTopRightRadius: '4px',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {/* Header bot — mostrar nombre real (Chatbot o nombre del agente IA) */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot size={10} style={{ color: 'var(--texto-marca)' }} />
                      <span className="text-xxs font-semibold" style={{ color: 'var(--texto-marca)' }}>
                        {msg.remitente_nombre || 'Chatbot'}
                      </span>
                    </div>

                    {/* Contenido: si tiene opciones, renderizar como botones */}
                    {tieneOpciones ? (
                      <div className="space-y-1.5">
                        {lineas.map((linea, li) => {
                          const trimmed = linea.trim()
                          if (!trimmed) return null
                          const esOpcion = opcionesRegex.test(trimmed)
                          if (esOpcion) {
                            return (
                              <div
                                key={li}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs"
                                style={{
                                  background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)',
                                  color: 'var(--texto-primario)',
                                }}
                              >
                                <span
                                  dangerouslySetInnerHTML={{ __html: formatoWhatsApp(trimmed) }}
                                />
                              </div>
                            )
                          }
                          return (
                            <p
                              key={li}
                              className="text-sm whitespace-pre-wrap"
                              style={{ color: 'var(--texto-primario)' }}
                              dangerouslySetInnerHTML={{ __html: formatoWhatsApp(trimmed) }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <p
                        className="text-sm whitespace-pre-wrap"
                        style={{ color: 'var(--texto-primario)' }}
                        dangerouslySetInnerHTML={{ __html: formatoWhatsApp(msg.texto || '') }}
                      />
                    )}

                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {formatoHora(msg.creado_en)}
                      </span>
                      {ICONO_ESTADO[msg.wa_status || msg.estado]}
                    </div>
                  </div>
                </motion.div>
              )
            }

            return (
              <motion.div
                key={elem.key}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${esPropio ? 'justify-end' : 'justify-start'} group/burbuja`}
              >
                <div className="relative max-w-[75%]">
                  <div
                    className="rounded-lg px-3 py-1.5 relative"
                    style={{
                      background: esPropio
                        ? 'var(--superficie-seleccionada)'
                        : 'var(--superficie-tarjeta)',
                      borderTopLeftRadius: esPropio ? undefined : '4px',
                      borderTopRightRadius: esPropio ? '4px' : undefined,
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {!esPropio && msg.remitente_nombre && (
                      <p className="text-xxs font-semibold mb-0.5" style={{ color: 'var(--canal-whatsapp)' }}>
                        {msg.remitente_nombre}
                      </p>
                    )}
                    <ContenidoMensaje
                      mensaje={msg}
                      onAbrirVisor={onAbrirVisor}
                      metaHora={
                        <div className="flex items-center gap-1">
                          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                            {formatoHora(msg.creado_en)}
                          </span>
                          {esPropio && ICONO_ESTADO[msg.wa_status || msg.estado]}
                        </div>
                      }
                    />
                    {/* Hora + estado */}
                    {msg.tipo_contenido !== 'audio' && (
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                          {formatoHora(msg.creado_en)}
                        </span>
                        {esPropio && ICONO_ESTADO[msg.wa_status || msg.estado]}
                      </div>
                    )}
                  </div>

                  {/* Reacciones visibles debajo de la burbuja */}
                  {tieneReacciones && (
                    <div className={`flex gap-0.5 mt-0.5 ${esPropio ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reacciones).map(([emoji, usuarios]) => (
                        <span
                          key={emoji}
                          className="text-xs px-1 py-0.5 rounded-full"
                          style={{ background: 'var(--superficie-hover)', fontSize: 'var(--texto-xs)' }}
                        >
                          {emoji}{(usuarios as string[]).length > 1 ? ` ${(usuarios as string[]).length}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Botón reaccionar (hover) — solo mensajes con wa_message_id */}
                  {msg.wa_message_id && (
                    <button
                      onClick={() => setPickerMsgId(pickerAbierto ? null : msg.id)}
                      className={`absolute top-0 p-1 rounded-full opacity-0 group-hover/burbuja:opacity-100 transition-opacity ${esPropio ? '-left-1' : '-right-1'}`}
                      style={{
                        background: 'var(--superficie-elevada)',
                        color: 'var(--texto-terciario)',
                        boxShadow: 'var(--sombra-sm)',
                      }}
                    >
                      <SmilePlus size={12} />
                    </button>
                  )}

                  {/* Picker de emojis rápidos */}
                  <AnimatePresence>
                    {pickerAbierto && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`absolute -top-8 flex items-center gap-0.5 px-1.5 py-1 rounded-full z-10 ${esPropio ? 'right-0' : 'left-0'}`}
                        style={{
                          background: 'var(--superficie-elevada)',
                          boxShadow: 'var(--sombra-md)',
                          border: '1px solid var(--borde-sutil)',
                        }}
                      >
                        {EMOJIS_RAPIDOS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setPickerMsgId(null)
                              fetch('/api/inbox/whatsapp/reaccion', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  conversacion_id: conversacion.id,
                                  mensaje_id: msg.id,
                                  emoji,
                                }),
                              })
                            }}
                            className="text-base hover:scale-125 transition-transform cursor-pointer p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Panel IA — barra colapsable sobre el compositor (solo si la empresa lo habilitó) */}
      {conversacion && iaHabilitada && (
        <PanelIA
          conversacionId={conversacion.id}
          onInsertarTexto={(texto) => {
            setTextoIA(texto)
            setContadorTextoIA(c => c + 1)
          }}
          onEnviarDirecto={(texto) => {
            onEnviar({ texto, tipo_contenido: 'texto' })
          }}
          resumenExistente={conversacion.resumen_ia}
          sentimientoExistente={conversacion.sentimiento}
        />
      )}

      {/* Compositor */}
      <CompositorMensaje
        tipoCanal="whatsapp"
        onEnviar={onEnviar}
        cargando={enviando}
        placeholder="Escribir mensaje..."
        textoInicial={textoIA}
        textoInicialVersion={contadorTextoIA}
        onAbrirPlantillas={() => {}}
        conversacionId={conversacion.id}
        permitirNotasInternas
      />

    </div>
  )
}

// ═══════════════════════════════════════════════════
// VISOR DE MEDIA FULLSCREEN (fotos + videos)
// ═══════════════════════════════════════════════════

export function VisorMedia({
  medias,
  indice,
  abierto,
  onCerrar,
  onCambiarIndice,
}: {
  medias: MediaVisor[]
  indice: number
  abierto: boolean
  onCerrar: () => void
  onCambiarIndice: (i: number) => void
}) {
  const actual = medias[indice]
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pausar video al cambiar de slide o cerrar
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [indice, abierto])

  // Navegación con teclado
  useEffect(() => {
    if (!abierto) return
    const manejar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowLeft' && indice > 0) onCambiarIndice(indice - 1)
      if (e.key === 'ArrowRight' && indice < medias.length - 1) onCambiarIndice(indice + 1)
      // Espacio para play/pause en video
      if (e.key === ' ' && actual?.tipo === 'video' && videoRef.current) {
        e.preventDefault()
        if (videoRef.current.paused) videoRef.current.play()
        else videoRef.current.pause()
      }
    }
    window.addEventListener('keydown', manejar)
    return () => window.removeEventListener('keydown', manejar)
  }, [abierto, indice, medias.length, onCerrar, onCambiarIndice, actual?.tipo])

  return (
    <AnimatePresence>
      {abierto && actual && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0, 0, 0, 0.92)' }}
          onClick={onCerrar}
        >
          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm text-white/70">
              {indice + 1} / {medias.length}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={actual.url}
                download
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <Download size={18} className="text-white/70" />
              </a>
              <button
                onClick={onCerrar}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>
          </div>

          {/* Media principal */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={e => e.stopPropagation()}>
            {/* Flecha izquierda */}
            {indice > 0 && (
              <button
                onClick={() => onCambiarIndice(indice - 1)}
                className="absolute left-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronLeft size={28} className="text-white/70" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {actual.tipo === 'video' ? (
                <motion.video
                  key={actual.url}
                  ref={videoRef}
                  src={actual.url}
                  controls
                  playsInline
                  autoPlay
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-full max-h-full object-contain select-none rounded"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                />
              ) : (
                <motion.img
                  key={actual.url}
                  src={actual.url}
                  alt=""
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                />
              )}
            </AnimatePresence>

            {/* Flecha derecha */}
            {indice < medias.length - 1 && (
              <button
                onClick={() => onCambiarIndice(indice + 1)}
                className="absolute right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronRight size={28} className="text-white/70" />
              </button>
            )}
          </div>

          {/* Caption y fecha */}
          <div className="flex-shrink-0 px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
            {actual.caption && (
              <p className="text-sm text-white mb-1">{actual.caption}</p>
            )}
            <p className="text-xxs text-white/50">
              {new Date(actual.fecha).toLocaleDateString('es', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>

          {/* Miniaturas en la parte inferior */}
          {medias.length > 1 && (
            <div
              className="flex-shrink-0 px-4 pb-4 flex items-center justify-center gap-1.5 overflow-x-auto"
              onClick={e => e.stopPropagation()}
            >
              {medias.map((media, i) => (
                <button
                  key={media.url}
                  onClick={() => onCambiarIndice(i)}
                  className="flex-shrink-0 rounded overflow-hidden transition-all relative"
                  style={{
                    width: 48,
                    height: 48,
                    opacity: i === indice ? 1 : 0.4,
                    border: i === indice ? '2px solid white' : '2px solid transparent',
                  }}
                >
                  {media.tipo === 'video' ? (
                    <>
                      <video src={media.url} preload="metadata" className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play size={12} className="text-white drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════
// REPRODUCTOR DE AUDIO (estilo WhatsApp)
// Safari no soporta OGG/Opus, así que usamos Web Audio API como fallback
// ═══════════════════════════════════════════════════

function ReproductorAudio({ adjunto, children }: { adjunto: MensajeAdjunto; children?: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [duracion, setDuracion] = useState(adjunto.duracion_segundos || 0)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState(false)

  // Detectar si el navegador soporta OGG
  const soportaOgg = useRef<boolean | null>(null)
  useEffect(() => {
    const audio = document.createElement('audio')
    soportaOgg.current = audio.canPlayType('audio/ogg; codecs=opus') !== ''
  }, [])

  // Barras estilo WhatsApp: finas, centradas, con variación orgánica
  const barras = useRef(
    Array.from({ length: 63 }, (_, i) => {
      // Hash pseudo-random estable por índice
      const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      const rand = h - Math.floor(h)
      // Variación rápida (detalle) + envelope suave
      const detalle = rand * 0.7
      const envelope = 0.3 + 0.7 * Math.sin((i / 62) * Math.PI) // sube y baja
      return Math.max(0.08, Math.min(1, detalle * envelope + 0.15))
    })
  ).current

  // Fallback: Web Audio API para navegadores que no soportan OGG nativo
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const startTimeRef = useRef(0)
  const offsetRef = useRef(0)

  const decodificarConWebAudio = useCallback(async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const response = await fetch(adjunto.url)
      const arrayBuffer = await response.arrayBuffer()
      bufferRef.current = await ctx.decodeAudioData(arrayBuffer)
      setDuracion(bufferRef.current.duration)
    } catch {
      setError(true)
    }
  }, [adjunto.url])

  const reproducirWebAudio = useCallback(() => {
    if (!audioCtxRef.current || !bufferRef.current) return
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    source.connect(ctx.destination)
    source.start(0, offsetRef.current)
    sourceRef.current = source
    startTimeRef.current = ctx.currentTime - offsetRef.current
    setReproduciendo(true)

    source.onended = () => {
      setReproduciendo(false)
      setProgreso(0)
      setTiempoActual(0)
      offsetRef.current = 0
    }
  }, [])

  const pausarWebAudio = useCallback(() => {
    if (sourceRef.current && audioCtxRef.current) {
      offsetRef.current = audioCtxRef.current.currentTime - startTimeRef.current
      sourceRef.current.stop()
      sourceRef.current = null
      setReproduciendo(false)
    }
  }, [])

  // Timer para actualizar progreso en modo Web Audio
  useEffect(() => {
    if (!reproduciendo || !audioCtxRef.current || soportaOgg.current !== false) return
    const intervalo = setInterval(() => {
      if (!audioCtxRef.current || !bufferRef.current) return
      const actual = audioCtxRef.current.currentTime - startTimeRef.current
      setTiempoActual(actual)
      setProgreso(actual / bufferRef.current.duration)
    }, 100)
    return () => clearInterval(intervalo)
  }, [reproduciendo])

  // Cargar audio con Web Audio API si no soporta OGG
  useEffect(() => {
    if (soportaOgg.current === false) {
      decodificarConWebAudio()
    }
  }, [soportaOgg.current, decodificarConWebAudio])

  const toggleReproducir = useCallback(() => {
    // Modo nativo
    if (soportaOgg.current) {
      const audio = audioRef.current
      if (!audio) return
      if (reproduciendo) audio.pause()
      else audio.play().catch(() => setError(true))
      return
    }
    // Modo Web Audio (fallback para Safari)
    if (reproduciendo) pausarWebAudio()
    else reproducirWebAudio()
  }, [reproduciendo, reproducirWebAudio, pausarWebAudio])

  const manejarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (soportaOgg.current) {
      const audio = audioRef.current
      if (!audio || !audio.duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      audio.currentTime = x * audio.duration
    } else if (bufferRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      offsetRef.current = x * bufferRef.current.duration
      if (reproduciendo) {
        pausarWebAudio()
        reproducirWebAudio()
      }
    }
  }, [reproduciendo, pausarWebAudio, reproducirWebAudio])

  // Si hay error y no se puede reproducir, mostrar link de descarga
  if (error) {
    return (
      <a
        href={adjunto.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 min-w-[200px] px-2 py-1.5 rounded"
        style={{ background: 'var(--superficie-hover)' }}
      >
        <Music size={16} style={{ color: 'var(--canal-whatsapp)' }} />
        <span className="text-xs" style={{ color: 'var(--texto-primario)' }}>Nota de voz</span>
        <Download size={14} style={{ color: 'var(--texto-terciario)' }} />
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[240px] max-w-[320px]">
      {/* Audio nativo (solo se usa si el navegador soporta OGG) */}
      <audio
        ref={audioRef}
        src={adjunto.url}
        preload="metadata"
        onTimeUpdate={() => {
          const audio = audioRef.current
          if (!audio || !audio.duration) return
          setTiempoActual(audio.currentTime)
          setProgreso(audio.currentTime / audio.duration)
        }}
        onLoadedMetadata={() => {
          const audio = audioRef.current
          if (audio?.duration && isFinite(audio.duration)) setDuracion(audio.duration)
        }}
        onPlay={() => setReproduciendo(true)}
        onPause={() => setReproduciendo(false)}
        onEnded={() => { setReproduciendo(false); setProgreso(0); setTiempoActual(0) }}
        onError={() => {
          if (soportaOgg.current) {
            // Intentar con Web Audio API como fallback
            soportaOgg.current = false
            decodificarConWebAudio()
          }
        }}
      />
      <button
        onClick={toggleReproducir}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
      >
        {reproduciendo ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        {/* Waveform centrada (barras arriba y abajo) + circulito de progreso */}
        <div
          className="relative flex items-center h-9 cursor-pointer"
          onClick={manejarClick}
          onMouseDown={(e) => {
            // Drag del circulito
            const contenedor = e.currentTarget
            const mover = (ev: MouseEvent) => {
              const rect = contenedor.getBoundingClientRect()
              const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
              if (soportaOgg.current && audioRef.current?.duration) {
                audioRef.current.currentTime = x * audioRef.current.duration
              } else if (bufferRef.current) {
                offsetRef.current = x * bufferRef.current.duration
                setProgreso(x)
                setTiempoActual(x * bufferRef.current.duration)
              }
            }
            const soltar = () => {
              document.removeEventListener('mousemove', mover)
              document.removeEventListener('mouseup', soltar)
            }
            document.addEventListener('mousemove', mover)
            document.addEventListener('mouseup', soltar)
          }}
        >
          {/* Waveform centrada — barras verticales simétricas */}
          <div className="flex items-center w-full h-full">
            {barras.map((altura, i) => {
              const activa = (i / barras.length) <= progreso
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height: `${altura * 90}%`,
                    minWidth: 2,
                    marginInline: '0.5px',
                    borderRadius: 1,
                    background: activa
                      ? 'var(--texto-marca)'
                      : 'var(--texto-terciario)',
                    opacity: activa ? 1 : 0.35,
                  }}
                />
              )
            })}
          </div>
          {/* Punto indicador de posición */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: 8,
              height: 8,
              left: `calc(${progreso * 100}% - 4px)`,
              background: 'var(--texto-marca)',
              opacity: progreso > 0 || reproduciendo ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          />
        </div>
        {/* Duración — la hora y estado se inyectan desde la burbuja padre via children */}
        <div className="flex items-center justify-between">
          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            {reproduciendo || tiempoActual > 0
              ? formatoDuracion(tiempoActual)
              : duracion > 0 ? formatoDuracion(duracion) : '0:00'}
          </span>
          {children}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// REPRODUCTOR DE VIDEO
// ═══════════════════════════════════════════════════

function MiniaturVideo({
  adjunto,
  caption,
  onAbrirVisor,
}: {
  adjunto: MensajeAdjunto
  caption: string | null
  onAbrirVisor: (url: string) => void
}) {
  return (
    <div className="space-y-1">
      <button
        onClick={() => onAbrirVisor(adjunto.url)}
        className="relative rounded-md overflow-hidden block"
        style={{ maxWidth: 320 }}
      >
        <video
          src={adjunto.url}
          preload="metadata"
          playsInline
          muted
          className="max-w-full rounded-md"
          style={{ maxHeight: 280 }}
        />
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Play size={22} className="text-white ml-0.5" />
          </div>
        </div>
      </button>
      {caption && (
        <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// GRILLA DE IMÁGENES AGRUPADAS
// ═══════════════════════════════════════════════════

function GrillaImagenes({
  imagenes,
  onAbrirVisor,
}: {
  imagenes: MensajeConAdjuntos[]
  onAbrirVisor: (url: string) => void
}) {
  const total = imagenes.length
  const caption = imagenes.map(m => textoVisible(m.texto)).find(t => t) || null

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-0.5 rounded-md overflow-hidden">
        {imagenes.slice(0, 4).map((msg, i) => {
          const adj = msg.adjuntos[0]
          if (!adj) return null
          const spanFull = total === 3 && i === 0
          return (
            <button
              key={msg.id}
              onClick={() => onAbrirVisor(adj.url)}
              className={`relative block overflow-hidden ${spanFull ? 'col-span-2' : ''}`}
            >
              <img
                src={adj.url}
                alt=""
                className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                style={{ height: spanFull ? 200 : total === 2 ? 180 : 120 }}
              />
              {i === 3 && total > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-white text-lg font-bold">+{total - 4}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
      {caption && (
        <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
      )}
    </div>
  )
}


// Placeholder para media que aún no tiene adjunto (descargando)
const ICONO_MEDIA: Record<string, { icono: React.ReactNode; texto: string }> = {
  imagen: { icono: <Image size={18} />, texto: 'Cargando imagen...' },
  audio: { icono: <Music size={18} />, texto: 'Cargando audio...' },
  video: { icono: <Play size={18} />, texto: 'Cargando video...' },
  documento: { icono: <FileText size={18} />, texto: 'Cargando documento...' },
  sticker: { icono: <Image size={18} />, texto: 'Cargando sticker...' },
}

function MediaCargando({ tipo }: { tipo: string }) {
  const info = ICONO_MEDIA[tipo] || ICONO_MEDIA.documento
  return (
    <div className="flex items-center gap-2 min-w-[160px] py-1">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
      >
        {info.icono}
      </div>
      <span className="text-xs italic" style={{ color: 'var(--texto-terciario)' }}>
        {info.texto}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// CONTENIDO DE MENSAJE INDIVIDUAL
// ═══════════════════════════════════════════════════

function ContenidoMensaje({
  mensaje,
  onAbrirVisor,
  metaHora,
}: {
  mensaje: MensajeConAdjuntos
  onAbrirVisor: (url: string) => void
  metaHora?: React.ReactNode
}) {
  const { tipo_contenido, texto, adjuntos } = mensaje
  const caption = textoVisible(texto)

  switch (tipo_contenido) {
    case 'imagen':
      return adjuntos.length > 0 ? (
        <div className="space-y-1">
          {adjuntos.map((adj) => (
            <button key={adj.id} onClick={() => onAbrirVisor(adj.url)} className="block">
              <img
                src={adj.url}
                alt={caption || ''}
                className="rounded-md max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: 300 }}
              />
            </button>
          ))}
          {caption && (
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: 'var(--texto-primario)' }}
              dangerouslySetInnerHTML={{ __html: formatoWhatsApp(caption) }}
            />
          )}
        </div>
      ) : <MediaCargando tipo="imagen" />

    case 'audio':
      if (adjuntos[0]) return <ReproductorAudio adjunto={adjuntos[0]}>{metaHora}</ReproductorAudio>
      // Audio sin adjunto: mostrar placeholder descriptivo
      if (texto) {
        return (
          <div className="flex items-center gap-2 min-w-[160px] py-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}>
              <Music size={14} />
            </div>
            <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{texto}</span>
          </div>
        )
      }
      return <MediaCargando tipo="audio" />

    case 'video':
      return adjuntos[0] ? (
        <MiniaturVideo adjunto={adjuntos[0]} caption={caption} onAbrirVisor={onAbrirVisor} />
      ) : <MediaCargando tipo="video" />

    case 'documento':
      if (adjuntos.length > 0) {
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
                      {adj.tamano_bytes > 1048576
                        ? `${(adj.tamano_bytes / 1048576).toFixed(1)} MB`
                        : `${(adj.tamano_bytes / 1024).toFixed(0)} KB`}
                    </p>
                  )}
                </div>
                <Download size={14} style={{ color: 'var(--texto-terciario)' }} />
              </a>
            ))}
            {caption && (
              <p className="text-sm" style={{ color: 'var(--texto-primario)' }}>{caption}</p>
            )}
          </div>
        )
      }
      // Documento sin adjunto: mostrar nombre si lo tiene, o estado de carga
      if (texto) {
        return (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'var(--superficie-hover)' }}>
            <FileText size={16} style={{ color: 'var(--texto-terciario)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: 'var(--texto-secundario)' }}>{texto}</p>
              <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Archivo no disponible</p>
            </div>
          </div>
        )
      }
      return <MediaCargando tipo="documento" />

    case 'sticker':
      return adjuntos.length > 0 ? (
        <div>
          {adjuntos.map((adj) => (
            <img key={adj.id} src={adj.url} alt="sticker" className="w-32 h-32 object-contain" />
          ))}
        </div>
      ) : <MediaCargando tipo="sticker" />

    case 'ubicacion':
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <MapPin size={16} style={{ color: 'var(--insignia-peligro)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {caption || 'Ubicación compartida'}
          </span>
        </div>
      )

    case 'contacto_compartido':
      return (
        <div className="flex items-center gap-2">
          <User size={16} style={{ color: 'var(--texto-marca)' }} />
          <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
            {caption || 'Contacto compartido'}
          </span>
        </div>
      )

    default:
      return texto ? (
        <p
          className="text-sm whitespace-pre-wrap break-words"
          style={{ color: 'var(--texto-primario)' }}
          dangerouslySetInnerHTML={{ __html: formatoWhatsApp(texto) }}
        />
      ) : null
  }
}
