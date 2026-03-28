'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import {
  Send, Paperclip, X, ChevronDown, ChevronUp,
  Image, Film, FileText, File, Trash2, Minus,
} from 'lucide-react'

/**
 * Compositor de correo rico — UI dedicada para redactar emails.
 * Usa EditorTexto (TipTap) para cuerpo HTML, chips para destinatarios, CCO toggle.
 * Se usa en: PanelCorreo (responder/reenviar) y page.tsx (correo nuevo).
 */

// ─── Tipos ───

export interface DatosCorreo {
  correo_para: string[]
  correo_cc?: string[]
  correo_cco?: string[]
  correo_asunto: string
  texto: string
  html: string
  correo_in_reply_to?: string
  correo_references?: string[]
  adjuntos_ids?: string[]
  tipo: 'nuevo' | 'responder' | 'responder_todos' | 'reenviar'
}

interface PropiedadesCompositorCorreo {
  /** Tipo de acción */
  tipo: 'nuevo' | 'responder' | 'responder_todos' | 'reenviar'
  /** Datos pre-llenados */
  paraInicial?: string[]
  ccInicial?: string[]
  ccoInicial?: string[]
  asuntoInicial?: string
  htmlInicial?: string
  inReplyTo?: string
  references?: string[]
  adjuntosIdsInicial?: string[]
  /** Canales de correo disponibles para selector "De:" */
  canalesCorreo?: { id: string; nombre: string; email: string }[]
  canalSeleccionado?: string
  onCambiarCanal?: (canalId: string) => void
  /** Callbacks */
  onEnviar: (datos: DatosCorreo) => void
  onCancelar?: () => void
  onAdjuntar?: (archivos: File[]) => void
  cargando?: boolean
  /** Modo compacto (inline en PanelCorreo) vs completo (correo nuevo) */
  compacto?: boolean
}

// ─── Componente de Chip de email ───

function ChipEmail({ email, onRemover }: { email: string; onRemover: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-[200px]"
      style={{
        background: 'var(--superficie-hover)',
        color: 'var(--texto-secundario)',
      }}
    >
      <span className="truncate">{email}</span>
      <button
        onClick={onRemover}
        className="flex-shrink-0 hover:opacity-70"
      >
        <X size={10} />
      </button>
    </span>
  )
}

// ─── Input de emails con chips ───

function InputEmailChips({
  etiqueta,
  emails,
  onChange,
  placeholder,
}: {
  etiqueta: string
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
}) {
  const [inputValor, setInputValor] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const agregarEmail = useCallback((valor: string) => {
    const email = valor.trim().toLowerCase()
    if (email && !emails.includes(email)) {
      onChange([...emails, email])
    }
    setInputValor('')
  }, [emails, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValor.trim()) {
      e.preventDefault()
      agregarEmail(inputValor)
    }
    if (e.key === 'Backspace' && !inputValor && emails.length > 0) {
      onChange(emails.slice(0, -1))
    }
  }

  const handleBlur = () => {
    if (inputValor.trim()) {
      agregarEmail(inputValor)
    }
  }

  return (
    <div className="flex items-start gap-2 min-h-[32px]">
      <span
        className="text-xs w-10 flex-shrink-0 pt-1.5 text-right"
        style={{ color: 'var(--texto-terciario)' }}
      >
        {etiqueta}
      </span>
      <div
        className="flex-1 flex flex-wrap items-center gap-1 min-h-[28px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, i) => (
          <ChipEmail
            key={`${email}-${i}`}
            email={email}
            onRemover={() => onChange(emails.filter((_, j) => j !== i))}
          />
        ))}
        <input
          ref={inputRef}
          type="email"
          value={inputValor}
          onChange={(e) => setInputValor(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 min-w-[120px] text-xs bg-transparent outline-none py-1"
          style={{ color: 'var(--texto-primario)' }}
          placeholder={emails.length === 0 ? (placeholder || 'correo@ejemplo.com') : ''}
        />
      </div>
    </div>
  )
}

// ─── Compositor principal ───

export function CompositorCorreo({
  tipo,
  paraInicial = [],
  ccInicial = [],
  ccoInicial = [],
  asuntoInicial = '',
  htmlInicial = '',
  inReplyTo,
  references,
  adjuntosIdsInicial = [],
  canalesCorreo = [],
  canalSeleccionado,
  onCambiarCanal,
  onEnviar,
  onCancelar,
  onAdjuntar,
  cargando = false,
  compacto = false,
}: PropiedadesCompositorCorreo) {
  const [para, setPara] = useState<string[]>(paraInicial)
  const [cc, setCC] = useState<string[]>(ccInicial)
  const [cco, setCCO] = useState<string[]>(ccoInicial)
  const [asunto, setAsunto] = useState(asuntoInicial)
  const [html, setHtml] = useState(htmlInicial)
  const [mostrarCC, setMostrarCC] = useState(ccInicial.length > 0)
  const [mostrarCCO, setMostrarCCO] = useState(ccoInicial.length > 0)
  const [archivos, setArchivos] = useState<File[]>([])
  const [adjuntosIds] = useState<string[]>(adjuntosIdsInicial)

  const inputArchivosRef = useRef<HTMLInputElement>(null)

  // Actualizar si cambian los props (ej: cambiar de conversación)
  useEffect(() => {
    setPara(paraInicial)
    setCC(ccInicial)
    setCCO(ccoInicial)
    setAsunto(asuntoInicial)
    setHtml(htmlInicial)
  }, [paraInicial.join(','), ccInicial.join(','), asuntoInicial])

  const handleEnviar = useCallback(() => {
    if (para.length === 0 || cargando) return

    // Extraer texto plano del HTML
    const textoPlano = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

    onEnviar({
      correo_para: para,
      correo_cc: cc.length > 0 ? cc : undefined,
      correo_cco: cco.length > 0 ? cco : undefined,
      correo_asunto: asunto,
      texto: textoPlano,
      html,
      correo_in_reply_to: inReplyTo,
      correo_references: references,
      adjuntos_ids: adjuntosIds.length > 0 ? adjuntosIds : undefined,
      tipo,
    })
  }, [para, cc, cco, asunto, html, inReplyTo, references, adjuntosIds, tipo, cargando, onEnviar])

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files || [])
    if (nuevos.length > 0) {
      setArchivos(prev => [...prev, ...nuevos])
      onAdjuntar?.(nuevos)
    }
    e.target.value = ''
  }

  const puedeEnviar = para.length > 0 && !cargando

  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--superficie-tarjeta)',
        borderTop: compacto ? '1px solid var(--borde-sutil)' : undefined,
        borderRadius: compacto ? 0 : '8px',
        border: compacto ? undefined : '1px solid var(--borde-sutil)',
      }}
    >
      {/* Header con campos de email */}
      <div
        className="px-3 pt-3 pb-1 space-y-1"
        style={{ borderBottom: '1px solid var(--borde-sutil)' }}
      >
        {/* Selector De: (solo si hay múltiples canales) */}
        {canalesCorreo.length > 1 && (
          <div className="flex items-center gap-2">
            <span
              className="text-xs w-10 flex-shrink-0 text-right"
              style={{ color: 'var(--texto-terciario)' }}
            >
              De:
            </span>
            <select
              value={canalSeleccionado || ''}
              onChange={(e) => onCambiarCanal?.(e.target.value)}
              className="text-xs bg-transparent outline-none cursor-pointer py-1"
              style={{ color: 'var(--texto-primario)' }}
            >
              {canalesCorreo.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>
              ))}
            </select>
          </div>
        )}

        {/* Para */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <InputEmailChips
              etiqueta="Para:"
              emails={para}
              onChange={setPara}
              placeholder="destinatario@correo.com"
            />
          </div>
          {/* Toggle CC/CCO */}
          <div className="flex items-center gap-1 flex-shrink-0 pt-1">
            {!mostrarCC && (
              <button
                onClick={() => setMostrarCC(true)}
                className="text-xxs px-1.5 py-0.5 rounded transition-colors"
                style={{ color: 'var(--texto-terciario)' }}
              >
                CC
              </button>
            )}
            {!mostrarCCO && (
              <button
                onClick={() => setMostrarCCO(true)}
                className="text-xxs px-1.5 py-0.5 rounded transition-colors"
                style={{ color: 'var(--texto-terciario)' }}
              >
                CCO
              </button>
            )}
          </div>
        </div>

        {/* CC */}
        <AnimatePresence>
          {mostrarCC && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <InputEmailChips
                etiqueta="CC:"
                emails={cc}
                onChange={setCC}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* CCO */}
        <AnimatePresence>
          {mostrarCCO && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <InputEmailChips
                etiqueta="CCO:"
                emails={cco}
                onChange={setCCO}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Asunto */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs w-10 flex-shrink-0 text-right"
            style={{ color: 'var(--texto-terciario)' }}
          >
            Asunto:
          </span>
          <input
            type="text"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none py-1 font-medium"
            style={{ color: 'var(--texto-primario)' }}
            placeholder="Asunto del correo"
          />
        </div>
      </div>

      {/* Cuerpo del correo (TipTap) */}
      <div className="px-3 py-2" style={{ minHeight: compacto ? 120 : 200 }}>
        <EditorTexto
          contenido={htmlInicial}
          onChange={setHtml}
          placeholder="Escribí tu mensaje..."
          alturaMinima={compacto ? 100 : 180}
          accionesExtra={
            <button
              onClick={() => inputArchivosRef.current?.click()}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--texto-terciario)' }}
              title="Adjuntar archivo"
            >
              <Paperclip size={14} />
            </button>
          }
        />
        <input
          ref={inputArchivosRef}
          type="file"
          multiple
          onChange={handleArchivos}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
        />
      </div>

      {/* Archivos adjuntos */}
      <AnimatePresence>
        {archivos.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 flex flex-wrap gap-1.5"
          >
            {archivos.map((archivo, i) => (
              <div
                key={`${archivo.name}-${i}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                style={{
                  background: 'var(--superficie-hover)',
                  color: 'var(--texto-secundario)',
                }}
              >
                <ArchivoIcono tipo={archivo.type} />
                <span className="max-w-[120px] truncate">{archivo.name}</span>
                <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                  {formatoTamano(archivo.size)}
                </span>
                <button onClick={() => setArchivos(prev => prev.filter((_, j) => j !== i))}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: acciones */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderTop: '1px solid var(--borde-sutil)' }}
      >
        <div className="flex items-center gap-2">
          <Boton
            variante="primario"
            tamano="sm"
            icono={<Send size={14} />}
            onClick={handleEnviar}
            cargando={cargando}
            disabled={!puedeEnviar}
          >
            Enviar
          </Boton>
          {onCancelar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={onCancelar}
            >
              Descartar
            </Boton>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => inputArchivosRef.current?.click()}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--texto-terciario)' }}
            title="Adjuntar archivo"
          >
            <Paperclip size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───

function ArchivoIcono({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <Image size={12} />
  if (tipo.startsWith('video/')) return <Film size={12} />
  if (tipo.includes('pdf')) return <FileText size={12} />
  return <File size={12} />
}

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
