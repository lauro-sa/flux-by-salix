'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import {
  Send, Paperclip, Mic, MicOff, Smile, FileText,
  X, Image, Film, File, StopCircle,
} from 'lucide-react'
import type { TipoCanal, TipoContenido } from '@/tipos/inbox'

/**
 * Compositor de mensajes — barra inferior del chat.
 * Adaptable a WhatsApp (audio + stickers), correo (asunto + CC), interno (hilos).
 */

interface PropiedadesCompositor {
  tipoCanal: TipoCanal
  onEnviar: (datos: DatosMensaje) => void
  onAdjuntar?: (archivos: File[]) => void
  cargando?: boolean
  placeholder?: string
  // Correo
  mostrarCamposCorreo?: boolean
  asuntoInicial?: string
  // Hilo interno
  respondiendo?: { id: string; texto: string; autor: string } | null
  onCancelarRespuesta?: () => void
  // Plantillas
  onAbrirPlantillas?: () => void
}

export interface DatosMensaje {
  texto: string
  tipo_contenido: TipoContenido
  // Correo
  correo_para?: string[]
  correo_cc?: string[]
  correo_asunto?: string
  html?: string
  // Hilo
  respuesta_a_id?: string
}

export function CompositorMensaje({
  tipoCanal,
  onEnviar,
  onAdjuntar,
  cargando = false,
  placeholder,
  mostrarCamposCorreo = false,
  asuntoInicial = '',
  respondiendo = null,
  onCancelarRespuesta,
  onAbrirPlantillas,
}: PropiedadesCompositor) {
  const [texto, setTexto] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([])

  // Campos de correo
  const [correoPara, setCorreoPara] = useState('')
  const [correoCC, setCorreoCC] = useState('')
  const [correoAsunto, setCorreoAsunto] = useState(asuntoInicial)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputArchivosRef = useRef<HTMLInputElement>(null)
  const intervalGrabacionRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-resize textarea
  const ajustarAltura = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`
    }
  }, [])

  const handleEnviar = () => {
    if ((!texto.trim() && archivosSeleccionados.length === 0) || cargando) return

    const datos: DatosMensaje = {
      texto: texto.trim(),
      tipo_contenido: 'texto',
    }

    // Campos de correo
    if (tipoCanal === 'correo' && mostrarCamposCorreo) {
      datos.correo_para = correoPara.split(',').map(e => e.trim()).filter(Boolean)
      datos.correo_cc = correoCC ? correoCC.split(',').map(e => e.trim()).filter(Boolean) : undefined
      datos.correo_asunto = correoAsunto || undefined
    }

    // Respuesta a hilo
    if (respondiendo) {
      datos.respuesta_a_id = respondiendo.id
    }

    onEnviar(datos)
    setTexto('')
    setArchivosSeleccionados([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || [])
    if (archivos.length > 0) {
      setArchivosSeleccionados(prev => [...prev, ...archivos])
      onAdjuntar?.(archivos)
    }
    e.target.value = ''
  }

  const removerArchivo = (index: number) => {
    setArchivosSeleccionados(prev => prev.filter((_, i) => i !== index))
  }

  const toggleGrabacion = () => {
    if (grabando) {
      setGrabando(false)
      if (intervalGrabacionRef.current) {
        clearInterval(intervalGrabacionRef.current)
      }
      setTiempoGrabacion(0)
      // TODO: enviar audio grabado
    } else {
      setGrabando(true)
      setTiempoGrabacion(0)
      intervalGrabacionRef.current = setInterval(() => {
        setTiempoGrabacion(t => t + 1)
      }, 1000)
    }
  }

  const formatoTiempo = (s: number) => {
    const min = Math.floor(s / 60)
    const seg = s % 60
    return `${min}:${seg.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="flex-shrink-0"
      style={{
        borderTop: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Respondiendo a (hilos internos) */}
      <AnimatePresence>
        {respondiendo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2 flex items-center gap-2"
          >
            <div
              className="flex-1 px-2 py-1 rounded text-xs truncate"
              style={{
                borderLeft: '2px solid var(--texto-marca)',
                background: 'var(--superficie-hover)',
                color: 'var(--texto-secundario)',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--texto-marca)' }}>
                {respondiendo.autor}
              </span>
              <span className="ml-1">{respondiendo.texto}</span>
            </div>
            <button onClick={onCancelarRespuesta}>
              <X size={14} style={{ color: 'var(--texto-terciario)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campos de correo (solo si es email y redactando) */}
      {tipoCanal === 'correo' && mostrarCamposCorreo && (
        <div className="px-3 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>Para:</span>
            <input
              type="text"
              value={correoPara}
              onChange={(e) => setCorreoPara(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="destinatario@correo.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>CC:</span>
            <input
              type="text"
              value={correoCC}
              onChange={(e) => setCorreoCC(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="cc@correo.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-10" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
            <input
              type="text"
              value={correoAsunto}
              onChange={(e) => setCorreoAsunto(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none font-medium"
              style={{ color: 'var(--texto-primario)' }}
              placeholder="Asunto del correo"
            />
          </div>
          <div style={{ borderBottom: '1px solid var(--borde-sutil)' }} />
        </div>
      )}

      {/* Archivos seleccionados */}
      <AnimatePresence>
        {archivosSeleccionados.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2 flex flex-wrap gap-1.5"
          >
            {archivosSeleccionados.map((archivo, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded text-xxs"
                style={{
                  background: 'var(--superficie-hover)',
                  color: 'var(--texto-secundario)',
                }}
              >
                <ArchivoIcono tipo={archivo.type} />
                <span className="max-w-[120px] truncate">{archivo.name}</span>
                <button onClick={() => removerArchivo(i)}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de input */}
      <div className="flex items-end gap-2 p-3">
        {/* Botón adjuntar */}
        <button
          onClick={() => inputArchivosRef.current?.click()}
          className="p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: 'var(--texto-terciario)' }}
          title="Adjuntar archivo"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={inputArchivosRef}
          type="file"
          multiple
          onChange={handleArchivos}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Plantillas */}
        {onAbrirPlantillas && (
          <button
            onClick={onAbrirPlantillas}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--texto-terciario)' }}
            title="Plantillas"
          >
            <FileText size={18} />
          </button>
        )}

        {/* Grabando audio */}
        {grabando ? (
          <div className="flex-1 flex items-center gap-3">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--insignia-peligro)' }}
            />
            <span className="text-sm font-mono" style={{ color: 'var(--texto-primario)' }}>
              {formatoTiempo(tiempoGrabacion)}
            </span>
            <button
              onClick={toggleGrabacion}
              className="p-2 rounded-lg"
              style={{ background: 'var(--insignia-peligro)', color: '#fff' }}
            >
              <StopCircle size={18} />
            </button>
          </div>
        ) : (
          <>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                ajustarAltura()
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || 'Escribir mensaje...'}
              rows={1}
              className="flex-1 resize-none text-sm bg-transparent outline-none py-2"
              style={{
                color: 'var(--texto-primario)',
                maxHeight: 150,
              }}
            />

            {/* Botón grabar audio (solo WhatsApp) */}
            {tipoCanal === 'whatsapp' && !texto.trim() && (
              <button
                onClick={toggleGrabacion}
                className="p-2 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--texto-terciario)' }}
                title="Grabar audio"
              >
                <Mic size={18} />
              </button>
            )}

            {/* Botón enviar */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEnviar}
              disabled={(!texto.trim() && archivosSeleccionados.length === 0) || cargando}
              className="p-2 rounded-lg flex-shrink-0 transition-colors"
              style={{
                background: texto.trim() || archivosSeleccionados.length > 0
                  ? 'var(--texto-marca)'
                  : 'var(--superficie-hover)',
                color: texto.trim() || archivosSeleccionados.length > 0
                  ? '#fff'
                  : 'var(--texto-terciario)',
                opacity: cargando ? 0.5 : 1,
              }}
            >
              <Send size={18} />
            </motion.button>
          </>
        )}
      </div>
    </div>
  )
}

// Icono según tipo de archivo
function ArchivoIcono({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <Image size={10} />
  if (tipo.startsWith('video/')) return <Film size={10} />
  return <File size={10} />
}
