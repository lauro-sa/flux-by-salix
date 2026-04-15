'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import {
  Send, Paperclip, X, Upload, Clock,
  Image, Film, FileText, File, Loader2,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { useTraduccion } from '@/lib/i18n'
import { SelectorRespuestasRapidas } from './SelectorRespuestasRapidas'
import type { Editor } from '@tiptap/react'

/**
 * Compositor de correo rico — UI dedicada para redactar emails.
 * Features: chips con autocomplete de contactos, CC/CCO toggle, TipTap,
 * upload real de adjuntos, drag & drop, firma configurable, deshacer envío.
 * Se usa en: PanelCorreo (responder/reenviar) y page.tsx (correo nuevo).
 */

// ─── Tipos ───

/** Adjunto ya subido a Storage */
interface AdjuntoSubido {
  id: string
  nombre_archivo: string
  tipo_mime: string
  tamano_bytes: number
  url: string
  miniatura_url: string | null
}

/** Resultado de autocomplete de contactos */
interface ContactoSugerido {
  id: string
  nombre: string
  correo: string
}

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
  tipo: 'nuevo' | 'responder' | 'responder_todos' | 'reenviar'
  paraInicial?: string[]
  ccInicial?: string[]
  ccoInicial?: string[]
  asuntoInicial?: string
  htmlInicial?: string
  inReplyTo?: string
  references?: string[]
  adjuntosIdsInicial?: string[]
  canalesCorreo?: { id: string; nombre: string; email: string }[]
  canalSeleccionado?: string
  onCambiarCanal?: (canalId: string) => void
  onEnviar: (datos: DatosCorreo) => void
  onProgramar?: (datos: DatosCorreo, enviarEn: string) => void
  onCancelar?: () => void
  onAdjuntar?: (archivos: File[]) => void
  cargando?: boolean
  compacto?: boolean
  /** Firma HTML a incluir al final del correo */
  firma?: string
}

// ─── Chip de email ───

function ChipEmail({ email, nombre, onRemover }: { email: string; nombre?: string; onRemover: () => void }) {
  const { t } = useTraduccion()
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-[220px]"
      style={{
        background: 'var(--superficie-hover)',
        color: 'var(--texto-secundario)',
      }}
    >
      <span className="truncate">{nombre ? `${nombre} <${email}>` : email}</span>
      <Boton variante="fantasma" tamano="xs" soloIcono titulo={t('comun.eliminar')} icono={<X size={10} />} onClick={onRemover} aria-label={`${t('comun.eliminar')} ${email}`} />
    </span>
  )
}

// ─── Input de emails con chips + autocomplete ───

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
  const [sugerencias, setSugerencias] = useState<ContactoSugerido[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const agregarEmail = useCallback((valor: string) => {
    const email = valor.trim().toLowerCase()
    // Validar formato de email básico
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (email && emailValido && !emails.includes(email)) {
      onChange([...emails, email])
    }
    setInputValor('')
    setSugerencias([])
    setMostrarSugerencias(false)
  }, [emails, onChange])

  // Autocomplete con debounce
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (inputValor.length < 2) {
      setSugerencias([])
      setMostrarSugerencias(false)
      return
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(inputValor)}`)
        const data = await res.json()
        const filtrados = (data.contactos || []).filter(
          (c: ContactoSugerido) => c.correo && !emails.includes(c.correo.toLowerCase())
        )
        setSugerencias(filtrados)
        setMostrarSugerencias(filtrados.length > 0)
      } catch {
        setSugerencias([])
      }
    }, 250)

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [inputValor, emails])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValor.trim()) {
      e.preventDefault()
      agregarEmail(inputValor)
    }
    if (e.key === 'Backspace' && !inputValor && emails.length > 0) {
      onChange(emails.slice(0, -1))
    }
    if (e.key === 'Escape') {
      setMostrarSugerencias(false)
    }
  }

  const handleBlur = () => {
    // Delay para permitir click en sugerencia
    setTimeout(() => {
      if (inputValor.trim()) agregarEmail(inputValor)
      setMostrarSugerencias(false)
    }, 200)
  }

  return (
    <div className="flex items-start gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-[32px] relative">
      <span
        className="text-xs w-8 sm:w-10 flex-shrink-0 pt-1.5 text-right"
        style={{ color: 'var(--texto-terciario)' }}
      >
        {etiqueta}
      </span>
      <div className="flex-1 relative">
        <div
          className="flex flex-wrap items-center gap-1 min-h-[28px] cursor-text"
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
            type="text"
            value={inputValor}
            onChange={(e) => setInputValor(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => { if (sugerencias.length > 0) setMostrarSugerencias(true) }}
            className="flex-1 min-w-[120px] text-xs bg-transparent outline-none py-1"
            style={{ color: 'var(--texto-primario)' }}
            placeholder={emails.length === 0 ? (placeholder || 'correo@ejemplo.com') : ''}
          />
        </div>

        {/* Dropdown de sugerencias */}
        <AnimatePresence>
          {mostrarSugerencias && sugerencias.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 z-50 mt-1 py-1 rounded-lg shadow-lg max-h-[160px] overflow-y-auto"
              style={{
                background: 'var(--superficie-elevada)',
                border: '1px solid var(--borde-sutil)',
              }}
            >
              {sugerencias.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--superficie-hover)]"
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevenir blur
                    agregarEmail(s.correo)
                  }}
                >
                  <span className="font-medium" style={{ color: 'var(--texto-primario)' }}>
                    {s.nombre}
                  </span>
                  <span className="ml-2" style={{ color: 'var(--texto-terciario)' }}>
                    {s.correo}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
  onProgramar,
  onCancelar,
  cargando = false,
  compacto = false,
  firma,
}: PropiedadesCompositorCorreo) {
  const { t } = useTraduccion()
  const [para, setPara] = useState<string[]>(paraInicial)
  const [cc, setCC] = useState<string[]>(ccInicial)
  const [cco, setCCO] = useState<string[]>(ccoInicial)
  const [asunto, setAsunto] = useState(asuntoInicial)
  const [html, setHtml] = useState(htmlInicial)
  const [mostrarCC, setMostrarCC] = useState(ccInicial.length > 0)
  const [mostrarCCO, setMostrarCCO] = useState(ccoInicial.length > 0)

  // Adjuntos: archivos subidos con IDs
  const [adjuntosSubidos, setAdjuntosSubidos] = useState<AdjuntoSubido[]>([])
  const [adjuntosIds, setAdjuntosIds] = useState<string[]>(adjuntosIdsInicial)
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false)

  // Programar envío
  const [mostrarProgramar, setMostrarProgramar] = useState(false)
  const [fechaProgramada, setFechaProgramada] = useState('')

  // Drag & drop
  const [arrastrando, setArrastrando] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Deshacer envío
  const [envioPendiente, setEnvioPendiente] = useState<DatosCorreo | null>(null)
  const [timerDeshacer, setTimerDeshacer] = useState(5)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const inputArchivosRef = useRef<HTMLInputElement>(null)

  // Respuestas rápidas con "/"
  const [rrVisible, setRrVisible] = useState(false)
  const [rrFiltro, setRrFiltro] = useState('')
  const editorRef = useRef<Editor | null>(null)

  // Actualizar si cambian los props
  useEffect(() => {
    setPara(paraInicial)
    setCC(ccInicial)
    setCCO(ccoInicial)
    setAsunto(asuntoInicial)
    setHtml(htmlInicial)
  }, [paraInicial.join(','), ccInicial.join(','), asuntoInicial])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ─── Subida de adjuntos ───

  const MAX_ADJUNTO_MB = 25
  const subirArchivos = useCallback(async (archivos: File[]) => {
    if (archivos.length === 0) return

    // Validar tamaño de archivos
    const maxBytes = MAX_ADJUNTO_MB * 1024 * 1024
    const archivosGrandes = archivos.filter(a => a.size > maxBytes)
    if (archivosGrandes.length > 0) {
      alert(`Archivos demasiado grandes (máx ${MAX_ADJUNTO_MB}MB): ${archivosGrandes.map(a => a.name).join(', ')}`)
      archivos = archivos.filter(a => a.size <= maxBytes)
      if (archivos.length === 0) return
    }

    setSubiendoAdjuntos(true)

    try {
      const formData = new FormData()
      for (const archivo of archivos) {
        formData.append('archivos', archivo)
      }

      const res = await fetch('/api/inbox/correo/adjuntos', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        const nuevos: AdjuntoSubido[] = data.adjuntos || []
        setAdjuntosSubidos(prev => [...prev, ...nuevos])
        setAdjuntosIds(prev => [...prev, ...nuevos.map((a: AdjuntoSubido) => a.id)])
      }
    } catch (err) {
      console.error('Error subiendo adjuntos:', err)
    } finally {
      setSubiendoAdjuntos(false)
    }
  }, [])

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files || [])
    if (nuevos.length > 0) subirArchivos(nuevos)
    e.target.value = ''
  }

  const removerAdjunto = (id: string) => {
    setAdjuntosSubidos(prev => prev.filter(a => a.id !== id))
    setAdjuntosIds(prev => prev.filter(aid => aid !== id))
  }

  // ─── Drag & drop ───

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setArrastrando(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Solo salir si realmente dejó el área
    const rect = dropRef.current?.getBoundingClientRect()
    if (rect) {
      const { clientX, clientY } = e
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setArrastrando(false)
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setArrastrando(false)

    const archivos = Array.from(e.dataTransfer.files)
    if (archivos.length > 0) subirArchivos(archivos)
  }, [subirArchivos])

  // ─── Enviar con deshacer ───

  const prepararEnvio = useCallback(() => {
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

    // Agregar firma al HTML si existe
    let htmlFinal = html
    if (firma) {
      htmlFinal += `<br/><div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 16px; color: #6b7280; font-size: 13px;">${firma}</div>`
    }

    const datos: DatosCorreo = {
      correo_para: para,
      correo_cc: cc.length > 0 ? cc : undefined,
      correo_cco: cco.length > 0 ? cco : undefined,
      correo_asunto: asunto,
      texto: textoPlano,
      html: htmlFinal,
      correo_in_reply_to: inReplyTo,
      correo_references: references,
      adjuntos_ids: adjuntosIds.length > 0 ? adjuntosIds : undefined,
      tipo,
    }

    // Iniciar timer de deshacer (5 segundos)
    setEnvioPendiente(datos)
    setTimerDeshacer(5)

    timerRef.current = setInterval(() => {
      setTimerDeshacer(prev => {
        if (prev <= 1) {
          // Tiempo agotado: enviar
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [para, cc, cco, asunto, html, inReplyTo, references, adjuntosIds, tipo, cargando, firma])

  // Cuando timer llega a 0, enviar
  useEffect(() => {
    if (timerDeshacer === 0 && envioPendiente) {
      onEnviar(envioPendiente)
      setEnvioPendiente(null)
    }
  }, [timerDeshacer, envioPendiente, onEnviar])

  const deshacerEnvio = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setEnvioPendiente(null)
    setTimerDeshacer(5)
  }, [])

  const puedeEnviar = para.length > 0 && !cargando && !subiendoAdjuntos && !envioPendiente

  return (
    <div
      ref={dropRef}
      className="flex flex-col relative"
      style={{
        background: 'var(--superficie-tarjeta)',
        borderTop: compacto ? '1px solid var(--borde-sutil)' : undefined,
        borderRadius: compacto ? 0 : '8px',
        border: compacto ? undefined : '1px solid var(--borde-sutil)',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de drag & drop */}
      <AnimatePresence>
        {arrastrando && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-lg"
            style={{
              background: 'rgba(var(--texto-marca-rgb, 37, 99, 235), 0.08)',
              border: '2px dashed var(--texto-marca)',
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} style={{ color: 'var(--texto-marca)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--texto-marca)' }}>
                Soltar archivos aquí
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner de deshacer envío */}
      <AnimatePresence>
        {envioPendiente && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'var(--texto-marca)', color: 'var(--texto-inverso)' }}
          >
            <span className="text-sm">
              {t('inbox.enviar')} {timerDeshacer}s...
            </span>
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={deshacerEnvio}
              style={{ color: 'var(--texto-inverso)' }}
            >
              {t('inbox.deshacer_envio')}
            </Boton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header con campos de email */}
      {!envioPendiente && (
        <>
          <div
            className="px-3 pt-3 pb-1 space-y-1"
            style={{ borderBottom: '1px solid var(--borde-sutil)' }}
          >
            {/* Selector De: (solo si hay múltiples canales) */}
            {canalesCorreo.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-8 sm:w-10 flex-shrink-0 text-right" style={{ color: 'var(--texto-terciario)' }}>
                  {t('inbox.de')}:
                </span>
                <Select
                  valor={canalSeleccionado || ''}
                  onChange={(v) => onCambiarCanal?.(v)}
                  opciones={canalesCorreo.map(c => ({
                    valor: c.id,
                    etiqueta: `${c.nombre} (${c.email})`,
                  }))}
                  variante="plano"
                  className="text-xs"
                />
              </div>
            )}

            {/* Para */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <InputEmailChips etiqueta={`${t('inbox.para')}:`} emails={para} onChange={setPara} placeholder="destinatario@correo.com" />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                {!mostrarCC && (
                  <Boton variante="fantasma" tamano="xs" onClick={() => setMostrarCC(true)} style={{ color: 'var(--texto-terciario)' }}>CC</Boton>
                )}
                {!mostrarCCO && (
                  <Boton variante="fantasma" tamano="xs" onClick={() => setMostrarCCO(true)} style={{ color: 'var(--texto-terciario)' }}>CCO</Boton>
                )}
              </div>
            </div>

            {/* CC */}
            <AnimatePresence>
              {mostrarCC && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <InputEmailChips etiqueta={`${t('inbox.cc')}:`} emails={cc} onChange={setCC} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CCO */}
            <AnimatePresence>
              {mostrarCCO && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <InputEmailChips etiqueta={`${t('inbox.cco')}:`} emails={cco} onChange={setCCO} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Asunto */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs w-8 sm:w-10 flex-shrink-0 text-right" style={{ color: 'var(--texto-terciario)' }}>{t('inbox.asunto')}:</span>
              <Input
                tipo="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="flex-1 text-xs font-medium"
                placeholder="Asunto del correo"
                variante="plano"
                compacto
              />
            </div>
          </div>

          {/* Cuerpo del correo (TipTap) + respuestas rápidas */}
          <div className="px-3 py-2 relative" style={{ minHeight: compacto ? 120 : 200 }}>
            <SelectorRespuestasRapidas
              visible={rrVisible}
              canal="correo"
              filtro={rrFiltro}
              onSeleccionar={(_texto, htmlRR) => {
                if (editorRef.current && htmlRR) {
                  // Borrar el "/" y filtro del editor, luego insertar HTML
                  const editor = editorRef.current
                  const { from } = editor.state.selection
                  // Buscar la posición del "/" hacia atrás
                  const doc = editor.state.doc.textContent
                  const textoBefore = doc.slice(0, from)
                  const slashPos = textoBefore.lastIndexOf('/')
                  if (slashPos >= 0) {
                    editor.chain().focus()
                      .deleteRange({ from: slashPos + 1, to: from })
                      .insertContent(htmlRR)
                      .run()
                  } else {
                    editor.commands.insertContent(htmlRR)
                  }
                }
                setRrVisible(false)
                setRrFiltro('')
              }}
              onCerrar={() => { setRrVisible(false); setRrFiltro('') }}
            />
            <EditorTexto
              contenido={htmlInicial}
              onChange={(nuevoHtml) => {
                setHtml(nuevoHtml)
                // Detectar "/" para abrir selector de respuestas rápidas
                if (editorRef.current) {
                  const { from } = editorRef.current.state.selection
                  const textContent = editorRef.current.state.doc.textContent
                  const textoBefore = textContent.slice(0, from)
                  const slashIdx = textoBefore.lastIndexOf('/')
                  if (slashIdx >= 0 && from - slashIdx <= 30) {
                    const filtro = textoBefore.slice(slashIdx + 1)
                    if (!filtro.includes(' ') || filtro.length < 20) {
                      setRrVisible(true)
                      setRrFiltro(filtro)
                      return
                    }
                  }
                }
                setRrVisible(false)
                setRrFiltro('')
              }}
              onEditorListo={(editor) => { editorRef.current = editor }}
              placeholder="Escribí tu mensaje... (/ para respuestas rápidas)"
              alturaMinima={compacto ? 100 : 180}
              accionesExtra={
                <Boton variante="fantasma" tamano="xs" soloIcono titulo="Adjuntar archivo" icono={<Paperclip size={14} />} onClick={() => inputArchivosRef.current?.click()} />
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

          {/* Adjuntos subidos */}
          <AnimatePresence>
            {(adjuntosSubidos.length > 0 || subiendoAdjuntos) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 pb-2 flex flex-wrap gap-1.5"
              >
                {adjuntosSubidos.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                  >
                    {adj.miniatura_url ? (
                      <img src={adj.miniatura_url} alt="" className="w-5 h-5 rounded object-cover" />
                    ) : (
                      <ArchivoIcono tipo={adj.tipo_mime} />
                    )}
                    <span className="max-w-[120px] truncate">{adj.nombre_archivo}</span>
                    <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                      {formatoTamano(adj.tamano_bytes)}
                    </span>
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar" icono={<X size={10} />} onClick={() => removerAdjunto(adj.id)} aria-label={`Quitar ${adj.nombre_archivo}`} />
                  </div>
                ))}
                {subiendoAdjuntos && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
                  >
                    <Loader2 size={12} className="animate-spin" />
                    <span>Subiendo...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Firma preview */}
          {firma && (
            <div
              className="px-3 pb-2 text-xs"
              style={{ color: 'var(--texto-terciario)' }}
            >
              <HtmlSeguro
                html={firma}
                className="pt-2 mt-1"
              />
            </div>
          )}

          {/* Picker de programar envío */}
          <AnimatePresence>
            {mostrarProgramar && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 pb-2 flex items-center gap-2"
              >
                <Clock size={14} style={{ color: 'var(--texto-terciario)' }} />
                <input
                  type="datetime-local"
                  value={fechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="text-xs bg-transparent outline-none py-1 px-2 rounded"
                  style={{
                    color: 'var(--texto-primario)',
                    border: '1px solid var(--borde-sutil)',
                  }}
                />
                <Boton
                  variante="primario"
                  tamano="xs"
                  disabled={!fechaProgramada || !puedeEnviar}
                  onClick={() => {
                    if (!fechaProgramada || !onProgramar) return
                    const textoPlano = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
                    let htmlFinal = html
                    if (firma) {
                      htmlFinal += `<br/><div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 16px; color: #6b7280; font-size: 13px;">${firma}</div>`
                    }
                    onProgramar({
                      correo_para: para,
                      correo_cc: cc.length > 0 ? cc : undefined,
                      correo_cco: cco.length > 0 ? cco : undefined,
                      correo_asunto: asunto,
                      texto: textoPlano,
                      html: htmlFinal,
                      correo_in_reply_to: inReplyTo,
                      correo_references: references,
                      adjuntos_ids: adjuntosIds.length > 0 ? adjuntosIds : undefined,
                      tipo,
                    }, new Date(fechaProgramada).toISOString())
                    setMostrarProgramar(false)
                    setFechaProgramada('')
                  }}
                >
                  Programar
                </Boton>
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={12} />} onClick={() => { setMostrarProgramar(false); setFechaProgramada('') }} titulo="Cerrar programador" />
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
                onClick={prepararEnvio}
                cargando={cargando}
                disabled={!puedeEnviar}
              >
                {t('inbox.enviar')}
              </Boton>
              {onProgramar && !compacto && (
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Clock size={14} />}
                  onClick={() => setMostrarProgramar(!mostrarProgramar)}
                >
                  Programar
                </Boton>
              )}
              {onCancelar && (
                <Boton variante="fantasma" tamano="sm" onClick={onCancelar}>
                  Descartar
                </Boton>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<Paperclip size={16} />} onClick={() => inputArchivosRef.current?.click()} titulo="Adjuntar archivo" />
            </div>
          </div>
        </>
      )}
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
