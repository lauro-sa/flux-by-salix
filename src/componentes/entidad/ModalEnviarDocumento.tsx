'use client'

/**
 * ModalEnviarDocumento — Modal completo para enviar documentos (presupuestos, facturas, etc.) por correo.
 * Cabezal fijo (De, Para, CC/CCO, Asunto, Plantilla), cuerpo con scroll (editor rico),
 * pie fijo (adjuntos en chips compactos + botones de acción con popover de programación).
 * Se usa en: EditorPresupuesto.tsx, y potencialmente en cualquier módulo de documentos.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { EditorTexto } from '@/componentes/ui/EditorTexto'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import {
  Send, X, Paperclip, FileText, Image, Film, File, Loader2,
  ChevronDown, Link2, Upload, Sun, Coffee, Moon, Calendar,
  SendHorizonal, Braces, BookmarkPlus, Save, Star,
} from 'lucide-react'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { crearNodoVariable } from '@/componentes/ui/ExtensionVariableChip'
import { useTraduccion } from '@/lib/i18n'

// ─── Tipos ───

/** Canal de correo configurado para la empresa */
export interface CanalCorreoEmpresa {
  id: string
  nombre: string
  email: string
  /** Es el canal predeterminado para este tipo de documento */
  predeterminado?: boolean
}

/** Plantilla de correo disponible */
export interface PlantillaCorreo {
  id: string
  nombre: string
  asunto: string
  contenido_html: string
  /** Canal por el que se envía (null = cualquiera) */
  canal_id?: string | null
}

/** Adjunto del documento (PDF generado automáticamente) */
export interface AdjuntoDocumento {
  id: string
  nombre_archivo: string
  tipo_mime: string
  tamano_bytes: number
  url: string
  miniatura_url?: string | null
  /** Si es el PDF principal del documento (auto-adjuntado) */
  es_documento_principal?: boolean
}

/** Datos que emite el modal al enviar */
export interface DatosEnvioDocumento {
  canal_id: string
  correo_para: string[]
  correo_cc: string[]
  correo_cco: string[]
  asunto: string
  html: string
  texto: string
  adjuntos_ids: string[]
  incluir_enlace_portal: boolean
  /** Si es programado, la fecha ISO */
  programado_para?: string
  /** Snapshot del estado del modal para restaurar al deshacer — uso interno */
  _snapshot?: SnapshotCorreo
}

interface ContactoSugerido {
  id: string
  nombre: string
  correo: string
}

/** Datos del borrador para guardar/restaurar */
export interface DatosBorradorCorreo {
  canal_id: string
  correo_para: string[]
  correo_cc: string[]
  correo_cco: string[]
  asunto: string
  html: string
  adjuntos_ids: string[]
  incluir_enlace_portal: boolean
}

/** Datos para guardar como plantilla */
export interface DatosPlantillaCorreo {
  nombre: string
  asunto: string
  contenido_html: string
  canal_id?: string
}

/** Snapshot completo del estado del modal para restaurar al deshacer envío */
export interface SnapshotCorreo {
  canal_id: string
  para: string[]
  cc: string[]
  cco: string[]
  mostrarCC: boolean
  mostrarCCO: boolean
  asunto: string
  html: string
  plantilla_id: string
  incluir_pdf: boolean
  incluir_enlace_portal: boolean
  adjuntos: AdjuntoDocumento[]
}

interface PropiedadesModalEnviarDocumento {
  abierto: boolean
  onCerrar: () => void
  onEnviar: (datos: DatosEnvioDocumento) => void | Promise<void>
  canales: CanalCorreoEmpresa[]
  plantillas?: PlantillaCorreo[]
  correosDestinatario?: string[]
  nombreDestinatario?: string
  asuntoPredeterminado?: string
  htmlInicial?: string
  adjuntoDocumento?: AdjuntoDocumento | null
  urlPortal?: string | null
  enviando?: boolean
  tipoDocumento?: string
  /** Guardar como borrador (si no se pasa, el botón no aparece) */
  onGuardarBorrador?: (datos: DatosBorradorCorreo) => void | Promise<void>
  /** Guardar como plantilla (si no se pasa, el botón no aparece) */
  onGuardarPlantilla?: (datos: DatosPlantillaCorreo) => void | Promise<void>
  /** Datos reales para preview de variables (contacto, presupuesto, empresa, etc.) */
  contextoVariables?: Record<string, Record<string, unknown>>
  /** Snapshot para restaurar al deshacer envío (si se pasa, se usa en vez de los defaults) */
  snapshotRestaurar?: SnapshotCorreo | null
  /** ID de la plantilla marcada como predeterminada para este tipo de documento */
  plantillaPredeterminadaId?: string | null
  /** Callback para cambiar la plantilla predeterminada (solo admins). Si no se pasa, no se muestra el botón */
  onCambiarPredeterminada?: (plantillaId: string | null) => void | Promise<void>
}

// ─── Helpers ───

function iconoArchivo(tipo: string) {
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

/** Nombre corto del día siguiente: "lun", "mar", etc. */
function diaSiguienteCorto(): string {
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  return manana.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
}

// ─── Chip de email ───

function ChipEmail({ email, onRemover }: { email: string; onRemover: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs max-w-[220px]"
      style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
    >
      <span className="truncate">{email}</span>
      <button onClick={onRemover} className="flex-shrink-0 hover:opacity-70" type="button">
        <X size={10} />
      </button>
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
    if (email && !emails.includes(email)) onChange([...emails, email])
    setInputValor('')
    setSugerencias([])
    setMostrarSugerencias(false)
  }, [emails, onChange])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (inputValor.length < 2) { setSugerencias([]); setMostrarSugerencias(false); return }
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contactos/buscar?q=${encodeURIComponent(inputValor)}`)
        const data = await res.json()
        const filtrados = (data.contactos || []).filter(
          (c: ContactoSugerido) => c.correo && !emails.includes(c.correo.toLowerCase())
        )
        setSugerencias(filtrados)
        setMostrarSugerencias(filtrados.length > 0)
      } catch { setSugerencias([]) }
    }, 250)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [inputValor, emails])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputValor.trim()) {
      e.preventDefault()
      agregarEmail(inputValor)
    }
    if (e.key === 'Backspace' && !inputValor && emails.length > 0) onChange(emails.slice(0, -1))
    if (e.key === 'Escape') setMostrarSugerencias(false)
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (inputValor.trim()) agregarEmail(inputValor)
      setMostrarSugerencias(false)
    }, 200)
  }

  return (
    <div className="flex items-start gap-2 min-h-[36px] relative">
      <span className="text-sm w-14 flex-shrink-0 pt-2 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>
        {etiqueta}
      </span>
      <div className="flex-1 relative">
        <div className="flex flex-wrap items-center gap-1 min-h-[32px] cursor-text" onClick={() => inputRef.current?.focus()}>
          {emails.map((email, i) => (
            <ChipEmail key={`${email}-${i}`} email={email} onRemover={() => onChange(emails.filter((_, j) => j !== i))} />
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValor}
            onChange={(e) => setInputValor(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => { if (sugerencias.length > 0) setMostrarSugerencias(true) }}
            className="flex-1 min-w-[120px] text-sm bg-transparent outline-none py-1.5"
            style={{ color: 'var(--texto-primario)' }}
            placeholder={emails.length === 0 ? (placeholder || 'correo@ejemplo.com') : ''}
          />
        </div>
        <AnimatePresence>
          {mostrarSugerencias && sugerencias.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 z-50 mt-1 py-1 rounded-lg shadow-lg max-h-[160px] overflow-y-auto"
              style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
            >
              {sugerencias.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--superficie-hover)]"
                  onMouseDown={(e) => { e.preventDefault(); agregarEmail(s.correo) }}
                >
                  <span className="font-medium" style={{ color: 'var(--texto-primario)' }}>{s.nombre}</span>
                  <span className="ml-2" style={{ color: 'var(--texto-terciario)' }}>{s.correo}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Input de asunto con chips de variables inline ───

/** Parsea un string con {{entidad.campo}} y lo divide en segmentos de texto y variables */
function parsearSegmentos(texto: string): Array<{ tipo: 'texto'; valor: string } | { tipo: 'variable'; entidad: string; campo: string; raw: string }> {
  const segmentos: Array<{ tipo: 'texto'; valor: string } | { tipo: 'variable'; entidad: string; campo: string; raw: string }> = []
  const regex = /\{\{(\w+)\.(\w+)\}\}/g
  let ultimo = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimo) segmentos.push({ tipo: 'texto', valor: texto.slice(ultimo, match.index) })
    segmentos.push({ tipo: 'variable', entidad: match[1], campo: match[2], raw: match[0] })
    ultimo = regex.lastIndex
  }
  if (ultimo < texto.length) segmentos.push({ tipo: 'texto', valor: texto.slice(ultimo) })
  return segmentos
}

function InputAsuntoVariables({
  valor,
  onChange,
  placeholder,
  contexto,
  onAbrirVariables,
}: {
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  contexto?: Record<string, Record<string, unknown>>
  onAbrirVariables: () => void
}) {
  const editableRef = useRef<HTMLDivElement>(null)
  const segmentos = parsearSegmentos(valor)
  const tieneVariables = segmentos.some(s => s.tipo === 'variable')

  // Reconstruir el valor raw desde el contentEditable
  const handleInput = useCallback(() => {
    if (!editableRef.current) return
    // Reconstruir: chips tienen data-raw, texto es text nodes
    let nuevoValor = ''
    editableRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        nuevoValor += node.textContent || ''
      } else if (node instanceof HTMLElement) {
        const raw = node.getAttribute('data-raw')
        if (raw) {
          nuevoValor += raw
        } else {
          nuevoValor += node.textContent || ''
        }
      }
    })
    onChange(nuevoValor)
  }, [onChange])

  // Eliminar una variable chip
  const eliminarVariable = useCallback((raw: string) => {
    onChange(valor.replace(raw, ''))
  }, [valor, onChange])

  // Si no tiene variables, usar un input normal (más fluido para escribir)
  if (!tieneVariables) {
    return (
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-sm bg-transparent outline-none py-1.5"
        style={{ color: 'var(--texto-primario)' }}
        placeholder={placeholder}
      />
    )
  }

  // Con variables: renderizar mix de texto editable y chips
  return (
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      className="flex-1 text-sm outline-none py-1.5 min-h-[28px] whitespace-pre-wrap"
      style={{ color: 'var(--texto-primario)' }}
      data-placeholder={placeholder}
    >
      {segmentos.map((seg, i) => {
        if (seg.tipo === 'texto') {
          return <span key={i}>{seg.valor}</span>
        }
        const preview = contexto?.[seg.entidad]?.[seg.campo]
        const valorPreview = (preview !== undefined && preview !== null && preview !== '') ? String(preview) : null
        return (
          <span
            key={i}
            contentEditable={false}
            data-raw={seg.raw}
            className="inline cursor-default group/vchip"
            style={{
              color: valorPreview ? 'var(--texto-marca)' : 'var(--texto-terciario)',
              borderBottom: `1.5px dashed ${valorPreview ? 'var(--texto-marca)' : 'var(--texto-terciario)'}`,
              paddingBottom: '0.5px',
            }}
            title={`${seg.raw}${valorPreview ? ` → ${valorPreview}` : ''}`}
          >
            {valorPreview || seg.raw}
            <button
              type="button"
              onClick={() => eliminarVariable(seg.raw)}
              className="hidden group-hover/vchip:inline-flex items-center justify-center size-3.5 rounded-full align-middle ml-0.5"
              style={{ background: 'var(--insignia-peligro)', color: 'white' }}
              contentEditable={false}
            >
              <X size={8} />
            </button>
          </span>
        )
      })}
    </div>
  )
}

// ─── Popover de programación ───

function PopoverProgramar({
  abierto,
  onCerrar,
  onProgramar,
  disabled,
}: {
  abierto: boolean
  onCerrar: () => void
  onProgramar: (fecha: string) => void
  disabled?: boolean
}) {
  const [fechaCustom, setFechaCustom] = useState<string | null>(null)
  const [horaCustom, setHoraCustom] = useState<string | null>(null)
  const [mostrarCustom, setMostrarCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, onCerrar])

  // Resetear al abrir
  useEffect(() => {
    if (abierto) { setFechaCustom(null); setHoraCustom(null); setMostrarCustom(false) }
  }, [abierto])

  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  const dia = diaSiguienteCorto()

  const formatear = (hora: number) => {
    const d = new Date(manana)
    d.setHours(hora, 0, 0, 0)
    return d.toISOString()
  }

  const puedeConfirmarCustom = fechaCustom && horaCustom

  const confirmarCustom = () => {
    if (!fechaCustom || !horaCustom) return
    const [h, m] = horaCustom.split(':').map(Number)
    const d = new Date(fechaCustom + 'T00:00:00')
    d.setHours(h, m, 0, 0)
    onProgramar(d.toISOString())
    onCerrar()
  }

  const opciones = [
    { etiqueta: 'Mañana a la mañana', hora: `${dia}, 08:00`, icono: <Sun size={15} />, valor: formatear(8) },
    { etiqueta: 'Mañana a la tarde', hora: `${dia}, 13:00`, icono: <Coffee size={15} />, valor: formatear(13) },
    { etiqueta: 'Mañana a la noche', hora: `${dia}, 20:00`, icono: <Moon size={15} />, valor: formatear(20) },
  ]

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full right-0 mb-2 rounded-xl shadow-elevada overflow-visible z-50"
          style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)', width: mostrarCustom ? 340 : 280 }}
        >
          {/* Título */}
          <div className="px-4 pt-3 pb-2">
            <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
              Programar envío
            </span>
          </div>

          {/* Opciones rápidas */}
          <div>
            {opciones.map((op) => (
              <button
                key={op.valor}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                onClick={() => { onProgramar(op.valor); onCerrar() }}
                disabled={disabled}
              >
                <span style={{ color: 'var(--texto-terciario)' }}>{op.icono}</span>
                <span className="flex-1 text-sm" style={{ color: 'var(--texto-primario)' }}>{op.etiqueta}</span>
                <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{op.hora}</span>
              </button>
            ))}
          </div>

          {/* Elegir fecha y hora — con SelectorFecha + SelectorHora */}
          <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
            {!mostrarCustom ? (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                onClick={() => setMostrarCustom(true)}
              >
                <span style={{ color: 'var(--texto-terciario)' }}><Calendar size={15} /></span>
                <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>Elegir fecha y hora...</span>
              </button>
            ) : (
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SelectorFecha
                      valor={fechaCustom}
                      onChange={setFechaCustom}
                      placeholder="Fecha"
                      limpiable={false}
                      anioMin={new Date().getFullYear()}
                      anioMax={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div className="w-[110px]">
                    <SelectorHora
                      valor={horaCustom}
                      onChange={setHoraCustom}
                      placeholder="Hora"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => { setMostrarCustom(false); setFechaCustom(null); setHoraCustom(null) }}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    variante="primario"
                    tamano="xs"
                    disabled={!puedeConfirmarCustom || disabled}
                    onClick={confirmarCustom}
                  >
                    Programar
                  </Boton>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Componente principal ───

export function ModalEnviarDocumento({
  abierto,
  onCerrar,
  onEnviar,
  canales,
  plantillas = [],
  correosDestinatario = [],
  nombreDestinatario,
  asuntoPredeterminado = '',
  htmlInicial = '',
  adjuntoDocumento,
  urlPortal,
  enviando = false,
  tipoDocumento = 'Documento',
  onGuardarBorrador,
  onGuardarPlantilla,
  contextoVariables,
  snapshotRestaurar,
  plantillaPredeterminadaId,
  onCambiarPredeterminada,
}: PropiedadesModalEnviarDocumento) {
  const { t } = useTraduccion()

  // ─── Estado del formulario ───
  const canalPredeterminado = canales.find(c => c.predeterminado) || canales[0]
  const [canalId, setCanalId] = useState(canalPredeterminado?.id || '')
  const [para, setPara] = useState<string[]>(correosDestinatario)
  const [cc, setCC] = useState<string[]>([])
  const [cco, setCCO] = useState<string[]>([])
  const [mostrarCC, setMostrarCC] = useState(false)
  const [mostrarCCO, setMostrarCCO] = useState(false)
  const [asunto, setAsunto] = useState(asuntoPredeterminado)
  const [html, setHtml] = useState(htmlInicial)
  const [plantillaId, setPlantillaId] = useState('')

  // Adjuntos
  const [adjuntos, setAdjuntos] = useState<AdjuntoDocumento[]>([])
  const [incluirPdf, setIncluirPdf] = useState(true)
  const [incluirEnlacePortal, setIncluirEnlacePortal] = useState(!!urlPortal)
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false)
  const inputArchivosRef = useRef<HTMLInputElement>(null)

  // Programar (popover)
  const [mostrarProgramar, setMostrarProgramar] = useState(false)

  // Cursor del editor — para el { } flotante
  const [cursorEditorPos, setCursorEditorPos] = useState<{ top: number; left: number } | null>(null)
  const editorConFoco = useRef(false)
  const [editorListo, setEditorListo] = useState(false)

  // Dropdown de canal
  const [mostrarCanales, setMostrarCanales] = useState(false)

  // Variables
  const [variablesAsuntoAbierto, setVariablesAsuntoAbierto] = useState(false)
  const [variablesCuerpoAbierto, setVariablesCuerpoAbierto] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const asuntoInputRef = useRef<HTMLInputElement>(null)

  // Guardar como plantilla
  const [mostrarGuardarPlantilla, setMostrarGuardarPlantilla] = useState(false)
  const [nombrePlantilla, setNombrePlantilla] = useState('')

  // Drag & drop
  const [arrastrando, setArrastrando] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Resetear estado al abrir — si hay snapshot (deshacer envío), restaurar todo
  useEffect(() => {
    if (abierto) {
      if (snapshotRestaurar) {
        // Restaurar desde snapshot (deshacer envío)
        setCanalId(snapshotRestaurar.canal_id)
        setPara(snapshotRestaurar.para)
        setCC(snapshotRestaurar.cc)
        setCCO(snapshotRestaurar.cco)
        setMostrarCC(snapshotRestaurar.mostrarCC)
        setMostrarCCO(snapshotRestaurar.mostrarCCO)
        setAsunto(snapshotRestaurar.asunto)
        setHtml(snapshotRestaurar.html)
        setPlantillaId(snapshotRestaurar.plantilla_id)
        setAdjuntos(snapshotRestaurar.adjuntos)
        setIncluirPdf(snapshotRestaurar.incluir_pdf)
        setIncluirEnlacePortal(snapshotRestaurar.incluir_enlace_portal)
      } else {
        // Reset normal (nuevo envío)
        const canalDef = canales.find(c => c.predeterminado) || canales[0]
        setCanalId(canalDef?.id || '')
        setPara(correosDestinatario)
        setCC([])
        setCCO([])
        setMostrarCC(false)
        setMostrarCCO(false)
        setAsunto(asuntoPredeterminado)
        setHtml(htmlInicial)
        setPlantillaId('')
        setAdjuntos([])
        setIncluirPdf(!!adjuntoDocumento)
        setIncluirEnlacePortal(!!urlPortal)
      }
      setMostrarProgramar(false)
      setMostrarCanales(false)
      setCursorEditorPos(null)
      editorConFoco.current = false
      setEditorListo(false)
    } else {
      setCursorEditorPos(null)
      editorConFoco.current = false
    }
  }, [abierto])

  const canalActivo = canales.find(c => c.id === canalId) || canales[0]

  // ─── Resolver variables {{entidad.campo}} con datos reales del contexto ───
  const resolverVariables = useCallback((texto: string): string => {
    if (!contextoVariables || !texto) return texto
    return texto.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, entidad: string, campo: string) => {
      const valor = contextoVariables[entidad]?.[campo]
      return (valor !== undefined && valor !== null && valor !== '') ? String(valor) : ''
    })
  }, [contextoVariables])

  // ─── Auto-aplicar plantilla predeterminada al abrir (si hay editor y no es snapshot) ───
  const predeterminadaAplicadaRef = useRef(false)
  useEffect(() => {
    if (!abierto) { predeterminadaAplicadaRef.current = false; return }
    if (snapshotRestaurar || predeterminadaAplicadaRef.current) return
    if (!editorListo || !plantillaPredeterminadaId) return
    const pl = plantillas.find(p => p.id === plantillaPredeterminadaId)
    if (!pl) return
    predeterminadaAplicadaRef.current = true
    setPlantillaId(pl.id)
    if (pl.asunto) setAsunto(resolverVariables(pl.asunto))
    if (pl.contenido_html) {
      const htmlResuelto = resolverVariables(pl.contenido_html)
      setHtml(htmlResuelto)
      const editor = editorRef.current
      if (editor) editor.commands.setContent(htmlResuelto)
    }
    if (pl.canal_id) setCanalId(pl.canal_id)
  }, [abierto, editorListo, plantillaPredeterminadaId, plantillas, snapshotRestaurar, resolverVariables])

  // ─── Aplicar plantilla ───
  const aplicarPlantilla = useCallback((id: string) => {
    setPlantillaId(id)
    const pl = plantillas.find(p => p.id === id)
    if (pl) {
      if (pl.asunto) setAsunto(resolverVariables(pl.asunto))
      if (pl.contenido_html) {
        const htmlResuelto = resolverVariables(pl.contenido_html)
        setHtml(htmlResuelto)
        const editor = editorRef.current
        if (editor) editor.commands.setContent(htmlResuelto)
      }
      if (pl.canal_id) setCanalId(pl.canal_id)
    }
  }, [plantillas, resolverVariables])

  // ─── Insertar variable en asunto ───
  const insertarVariableAsunto = useCallback((variable: string) => {
    const input = asuntoInputRef.current
    if (input) {
      const inicio = input.selectionStart ?? asunto.length
      const fin = input.selectionEnd ?? asunto.length
      const nuevo = asunto.slice(0, inicio) + variable + asunto.slice(fin)
      setAsunto(nuevo)
      // Reposicionar cursor después de la variable
      requestAnimationFrame(() => {
        input.focus()
        const pos = inicio + variable.length
        input.setSelectionRange(pos, pos)
      })
    } else {
      setAsunto(prev => prev + variable)
    }
    setVariablesAsuntoAbierto(false)
  }, [asunto])

  // ─── Insertar variable en el cuerpo (editor TipTap) ───
  const insertarVariableCuerpo = useCallback((variable: string) => {
    const editor = editorRef.current
    if (!editor) return
    // Parsear {{entidad.campo}} para insertar como nodo chip
    const match = variable.match(/^\{\{(\w+)\.(\w+)\}\}$/)
    if (match) {
      const [, entidad, campo] = match
      const preview = contextoVariables?.[entidad]?.[campo]
      const valorPreview = (preview !== undefined && preview !== null && preview !== '') ? String(preview) : ''
      editor.chain().focus().insertContent(crearNodoVariable(entidad, campo, valorPreview)).run()
    } else {
      editor.chain().focus().insertContent(variable).run()
    }
    setVariablesCuerpoAbierto(false)
  }, [contextoVariables])

  // ─── Guardar como borrador ───
  const handleGuardarBorrador = useCallback(() => {
    if (!onGuardarBorrador) return
    onGuardarBorrador({
      canal_id: canalId,
      correo_para: para,
      correo_cc: cc,
      correo_cco: cco,
      asunto,
      html,
      adjuntos_ids: adjuntos.map(a => a.id),
      incluir_enlace_portal: incluirEnlacePortal,
    })
  }, [onGuardarBorrador, canalId, para, cc, cco, asunto, html, adjuntos, incluirEnlacePortal])

  // ─── Guardar como plantilla ───
  const handleGuardarPlantilla = useCallback(() => {
    if (!onGuardarPlantilla || !nombrePlantilla.trim()) return
    onGuardarPlantilla({
      nombre: nombrePlantilla.trim(),
      asunto,
      contenido_html: html,
      canal_id: canalId,
    })
    setMostrarGuardarPlantilla(false)
    setNombrePlantilla('')
  }, [onGuardarPlantilla, nombrePlantilla, asunto, html, canalId])

  // ─── Subir archivos ───
  const subirArchivos = useCallback(async (archivos: File[]) => {
    if (archivos.length === 0) return
    setSubiendoAdjuntos(true)
    try {
      const formData = new FormData()
      for (const archivo of archivos) formData.append('archivos', archivo)
      const res = await fetch('/api/inbox/correo/adjuntos', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        const nuevos: AdjuntoDocumento[] = (data.adjuntos || []).map((a: AdjuntoDocumento) => ({
          ...a, es_documento_principal: false,
        }))
        setAdjuntos(prev => [...prev, ...nuevos])
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

  // ─── Drag & drop ───
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setArrastrando(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const rect = dropRef.current?.getBoundingClientRect()
    if (rect) {
      const { clientX, clientY } = e
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) setArrastrando(false)
    }
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setArrastrando(false)
    const archivos = Array.from(e.dataTransfer.files)
    if (archivos.length > 0) subirArchivos(archivos)
  }, [subirArchivos])

  // ─── Rastrear posición del cursor en el editor TipTap ───
  const actualizarCursorEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editorConFoco.current) { setCursorEditorPos(null); return }
    try {
      const { from, to } = editor.state.selection
      // No mostrar si hay selección de texto o si el editor está vacío
      if (from !== to) { setCursorEditorPos(null); return }
      if (editor.isEmpty) { setCursorEditorPos(null); return }
      const coords = editor.view.coordsAtPos(from)
      // Descartar coordenadas inválidas (editor aún no pintado o fuera de viewport)
      if (coords.top <= 0 || coords.left <= 0 || coords.top > window.innerHeight) {
        setCursorEditorPos(null)
        return
      }
      setCursorEditorPos({ top: coords.top, left: coords.right })
    } catch {
      setCursorEditorPos(null)
    }
  }, [])

  // Suscribir a transacciones del editor para actualizar la posición
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editorListo) return
    const handler = () => actualizarCursorEditor()
    const onFocus = () => { editorConFoco.current = true; handler() }
    const onBlur = () => {
      // Delay para permitir click en el botón { }
      setTimeout(() => {
        if (!variablesCuerpoAbierto) {
          editorConFoco.current = false
          setCursorEditorPos(null)
        }
      }, 200)
    }
    editor.on('transaction', handler)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    // Si el editor ya tiene foco (autoEnfocar), esperar a que el layout se pinte
    if (editor.isFocused) {
      editorConFoco.current = true
      setTimeout(handler, 300)
    }
    return () => {
      editor.off('transaction', handler)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
    }
  }, [editorListo, actualizarCursorEditor, variablesCuerpoAbierto])

  // ─── Construir datos de envío ───
  const construirDatos = useCallback((programadoPara?: string): DatosEnvioDocumento | null => {
    if (para.length === 0 || !canalId) return null
    const textoPlano = html
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

    const todosAdjuntosIds: string[] = []
    if (incluirPdf && adjuntoDocumento) todosAdjuntosIds.push(adjuntoDocumento.id)
    todosAdjuntosIds.push(...adjuntos.map(a => a.id))

    return {
      canal_id: canalId, correo_para: para, correo_cc: cc, correo_cco: cco,
      asunto, html, texto: textoPlano, adjuntos_ids: todosAdjuntosIds,
      incluir_enlace_portal: incluirEnlacePortal, programado_para: programadoPara,
      _snapshot: {
        canal_id: canalId, para, cc, cco,
        mostrarCC: mostrarCC, mostrarCCO: mostrarCCO,
        asunto, html, plantilla_id: plantillaId,
        incluir_pdf: incluirPdf, incluir_enlace_portal: incluirEnlacePortal,
        adjuntos,
      },
    }
  }, [para, cc, cco, asunto, html, canalId, incluirPdf, adjuntoDocumento, adjuntos, incluirEnlacePortal, mostrarCC, mostrarCCO, plantillaId])

  const handleEnviar = useCallback(async () => {
    const datos = construirDatos()
    if (!datos) return
    await onEnviar(datos)
  }, [construirDatos, onEnviar])

  const handleProgramar = useCallback(async (fecha: string) => {
    const datos = construirDatos(fecha)
    if (!datos) return
    await onEnviar(datos)
    setMostrarProgramar(false)
  }, [construirDatos, onEnviar])

  const puedeEnviar = para.length > 0 && canalId && !enviando && !subiendoAdjuntos

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tamano="3xl" sinPadding>
      <div
        ref={dropRef}
        className="flex flex-col h-full max-h-[80vh] relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay drag & drop */}
        <AnimatePresence>
          {arrastrando && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(var(--texto-marca-rgb, 37, 99, 235), 0.08)', border: '2px dashed var(--texto-marca)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} style={{ color: 'var(--texto-marca)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--texto-marca)' }}>Soltar archivos aquí</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════ CABEZAL FIJO ══════════ */}
        <div className="shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          {/* Título + cerrar */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Enviar documento
            </h2>
            <button
              onClick={onCerrar}
              className="flex items-center justify-center size-9 rounded-full transition-colors hover:bg-[var(--superficie-hover)]"
              type="button"
            >
              <X size={18} style={{ color: 'var(--texto-terciario)' }} />
            </button>
          </div>

          {/* Campos del correo */}
          <div className="px-6 pb-3 space-y-0.5">
            {/* De: con dropdown */}
            {canales.length > 0 && (
              <div className="flex items-center gap-2 min-h-[36px] relative">
                <span className="text-sm w-14 flex-shrink-0 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>De:</span>
                <div className="flex-1">
                  {canales.length === 1 ? (
                    <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
                      {canalActivo?.nombre} &lt;{canalActivo?.email}&gt;
                    </span>
                  ) : (
                    <div className="relative">
                      <button
                        className="flex items-center gap-1.5 text-sm py-1 transition-colors hover:opacity-80"
                        style={{ color: 'var(--texto-primario)' }}
                        onClick={() => setMostrarCanales(!mostrarCanales)}
                        type="button"
                      >
                        {canalActivo?.nombre} &lt;{canalActivo?.email}&gt;
                        <ChevronDown size={14} style={{ color: 'var(--texto-terciario)' }} />
                      </button>
                      <AnimatePresence>
                        {mostrarCanales && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 top-full z-50 mt-1 py-1 rounded-lg shadow-lg min-w-[280px]"
                            style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
                          >
                            {canales.map(c => (
                              <button
                                key={c.id}
                                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--superficie-hover)]"
                                style={{ color: c.id === canalId ? 'var(--texto-marca)' : 'var(--texto-primario)' }}
                                onClick={() => { setCanalId(c.id); setMostrarCanales(false) }}
                              >
                                {c.nombre} &lt;{c.email}&gt;
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Para + botones CC/CCO */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <InputEmailChips etiqueta="Para:" emails={para} onChange={setPara} placeholder={nombreDestinatario || 'destinatario@correo.com'} />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0 pt-2">
                {!mostrarCC && (
                  <button
                    onClick={() => setMostrarCC(true)}
                    className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)]"
                    style={{ color: 'var(--texto-terciario)' }}
                    type="button"
                  >
                    +CC
                  </button>
                )}
                {!mostrarCCO && (
                  <>
                    {!mostrarCC && <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>/</span>}
                    <button
                      onClick={() => setMostrarCCO(true)}
                      className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--superficie-hover)]"
                      style={{ color: 'var(--texto-terciario)' }}
                      type="button"
                    >
                      CCO
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CC */}
            <AnimatePresence>
              {mostrarCC && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="flex items-start gap-0">
                    <div className="flex-1">
                      <InputEmailChips etiqueta="CC:" emails={cc} onChange={setCC} />
                    </div>
                    <button
                      onClick={() => { setMostrarCC(false); setCC([]) }}
                      className="flex-shrink-0 p-1 mt-1.5 rounded transition-colors hover:bg-[var(--superficie-hover)]"
                      style={{ color: 'var(--texto-terciario)' }}
                      type="button"
                      title="Quitar CC"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CCO */}
            <AnimatePresence>
              {mostrarCCO && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="flex items-start gap-0">
                    <div className="flex-1">
                      <InputEmailChips etiqueta="CCO:" emails={cco} onChange={setCCO} />
                    </div>
                    <button
                      onClick={() => { setMostrarCCO(false); setCCO([]) }}
                      className="flex-shrink-0 p-1 mt-1.5 rounded transition-colors hover:bg-[var(--superficie-hover)]"
                      style={{ color: 'var(--texto-terciario)' }}
                      type="button"
                      title="Quitar CCO"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Asunto + botón de variables */}
            <div className="flex items-center gap-2 min-h-[36px]">
              <span className="text-sm w-14 flex-shrink-0 text-right font-medium" style={{ color: 'var(--texto-terciario)' }}>Asunto:</span>
              <InputAsuntoVariables
                valor={asunto}
                onChange={setAsunto}
                placeholder="Asunto del correo"
                contexto={contextoVariables}
                onAbrirVariables={() => setVariablesAsuntoAbierto(true)}
              />
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setVariablesAsuntoAbierto(!variablesAsuntoAbierto)}
                  className="flex items-center justify-center size-7 rounded transition-colors hover:bg-[var(--superficie-hover)]"
                  style={{ color: 'var(--texto-terciario)' }}
                  type="button"
                  title="Insertar variable"
                >
                  <Braces size={14} />
                </button>
                <SelectorVariables
                  abierto={variablesAsuntoAbierto}
                  onCerrar={() => setVariablesAsuntoAbierto(false)}
                  onSeleccionar={insertarVariableAsunto}
                  posicion="abajo"
                  contexto={contextoVariables}
                />
              </div>
            </div>
          </div>

          {/* Fila de plantilla + indicador de canal — fondo ligeramente diferente */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-2.5"
            style={{ borderTop: '1px solid var(--borde-sutil)', background: 'var(--superficie-hover)' }}
          >
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: 'var(--texto-terciario)' }} />
              {plantillas.length > 0 ? (
                <>
                  <select
                    value={plantillaId}
                    onChange={(e) => aplicarPlantilla(e.target.value)}
                    className="text-sm bg-transparent outline-none cursor-pointer"
                    style={{ color: 'var(--texto-primario)' }}
                  >
                    <option value="">Sin plantilla</option>
                    {plantillas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{p.id === plantillaPredeterminadaId ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                  {onCambiarPredeterminada && plantillaId && (
                    <button
                      type="button"
                      onClick={() => {
                        onCambiarPredeterminada(
                          plantillaId === plantillaPredeterminadaId ? null : plantillaId
                        )
                      }}
                      className="p-1 rounded transition-colors hover:scale-110"
                      title={plantillaId === plantillaPredeterminadaId
                        ? 'Quitar como predeterminada'
                        : 'Usar como predeterminada para este tipo de documento'
                      }
                      style={{ color: plantillaId === plantillaPredeterminadaId ? 'var(--insignia-advertencia)' : 'var(--texto-terciario)' }}
                    >
                      <Star
                        size={14}
                        fill={plantillaId === plantillaPredeterminadaId ? 'currentColor' : 'none'}
                      />
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm" style={{ color: 'var(--texto-terciario)' }}>Sin plantillas configuradas</span>
              )}
            </div>
            {canalActivo && (
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                vía {canalActivo.email}
              </span>
            )}
          </div>
        </div>

        {/* ══════════ CUERPO CON SCROLL ══════════ */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 200 }}>
          <EditorTexto
            contenido={snapshotRestaurar ? snapshotRestaurar.html : htmlInicial}
            onChange={setHtml}
            placeholder="Escribí tu mensaje..."
            alturaMinima={280}
            autoEnfocar
            habilitarVariables
            onEditorListo={(editor) => { editorRef.current = editor; setEditorListo(true) }}
          />
        </div>

        {/* Botón { } flotante que sigue al cursor del editor */}
        {abierto && cursorEditorPos && !variablesCuerpoAbierto && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-auto"
            style={{
              top: cursorEditorPos.top - 3,
              left: cursorEditorPos.left + 24,
              zIndex: 99999,
            }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault() // No quitar foco del editor
                e.stopPropagation()
                setVariablesCuerpoAbierto(true)
              }}
              className="flex items-center justify-center size-6 rounded-md transition-all hover:bg-[var(--superficie-hover)] hover:opacity-100"
              style={{ color: 'var(--texto-terciario)', opacity: 0.35 }}
              type="button"
              title="Insertar variable"
            >
              <Braces size={13} />
            </button>
          </div>,
          document.body
        )}

        {/* Selector de variables del cuerpo (siempre montado para el portal) */}
        <div className="relative">
          <SelectorVariables
            abierto={variablesCuerpoAbierto}
            onCerrar={() => setVariablesCuerpoAbierto(false)}
            onSeleccionar={insertarVariableCuerpo}
            posicion="abajo"
            contexto={contextoVariables}
          />
        </div>


        {/* ══════════ PIE FIJO ══════════ */}
        <div className="shrink-0" style={{ borderTop: '1px solid var(--borde-sutil)' }}>

          {/* Fila de adjuntos — chips compactos en línea */}
          <div className="flex items-center gap-2 px-6 py-2.5 flex-wrap">
            {/* PDF chip */}
            {adjuntoDocumento && incluirPdf && (
              <span
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
              >
                <FileText size={13} style={{ color: 'var(--insignia-peligro)' }} />
                <span className="max-w-[160px] truncate">{adjuntoDocumento.nombre_archivo}</span>
                <button
                  onClick={() => setIncluirPdf(false)}
                  className="p-0.5 rounded hover:bg-[var(--superficie-activa)] transition-colors"
                  type="button"
                >
                  <X size={11} style={{ color: 'var(--texto-terciario)' }} />
                </button>
              </span>
            )}

            {/* Adjuntos extra como chips */}
            {adjuntos.map((adj) => (
              <span
                key={adj.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
              >
                {iconoArchivo(adj.tipo_mime)}
                <span className="max-w-[120px] truncate">{adj.nombre_archivo}</span>
                <button
                  onClick={() => setAdjuntos(prev => prev.filter(a => a.id !== adj.id))}
                  className="p-0.5 rounded hover:bg-[var(--superficie-activa)] transition-colors"
                  type="button"
                >
                  <X size={11} style={{ color: 'var(--texto-terciario)' }} />
                </button>
              </span>
            ))}

            {subiendoAdjuntos && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs" style={{ color: 'var(--texto-terciario)' }}>
                <Loader2 size={12} className="animate-spin" /> Subiendo...
              </span>
            )}

            {/* Checkbox portal */}
            {urlPortal && (
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none ml-1" style={{ color: 'var(--texto-secundario)' }}>
                <input
                  type="checkbox"
                  checked={incluirEnlacePortal}
                  onChange={(e) => setIncluirEnlacePortal(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: 'var(--texto-marca)' }}
                />
                <Link2 size={13} />
                Portal
              </label>
            )}

            {/* Adjuntar archivo */}
            <button
              onClick={() => inputArchivosRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--superficie-hover)]"
              style={{ color: 'var(--texto-terciario)' }}
              type="button"
            >
              <Paperclip size={13} />
              Adjuntar archivo
            </button>
            <input
              ref={inputArchivosRef}
              type="file"
              multiple
              onChange={handleArchivos}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
          </div>

          {/* Botones de acción */}
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{ borderTop: '1px solid var(--borde-sutil)' }}
          >
            {/* Izquierda: Enviar + Descartar */}
            <div className="flex items-center gap-2">
              <Boton
                variante="primario"
                tamano="sm"
                icono={<Send size={14} />}
                onClick={handleEnviar}
                cargando={enviando}
                disabled={!puedeEnviar}
              >
                Enviar
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
                Descartar
              </Boton>
            </div>

            {/* Derecha: iconos de programar + borrador + plantilla */}
            <div className="flex items-center gap-1 relative">
              {/* Popover de programación */}
              <PopoverProgramar
                abierto={mostrarProgramar}
                onCerrar={() => setMostrarProgramar(false)}
                onProgramar={handleProgramar}
                disabled={!puedeEnviar}
              />
              <button
                onClick={() => setMostrarProgramar(!mostrarProgramar)}
                className="flex items-center justify-center size-9 rounded-lg transition-colors hover:bg-[var(--superficie-hover)]"
                style={{ color: 'var(--texto-terciario)' }}
                type="button"
                title="Programar envío"
              >
                <SendHorizonal size={18} />
              </button>
              {onGuardarBorrador && (
                <button
                  onClick={handleGuardarBorrador}
                  className="flex items-center justify-center size-9 rounded-lg transition-colors hover:bg-[var(--superficie-hover)]"
                  style={{ color: 'var(--texto-terciario)' }}
                  type="button"
                  title="Guardar como borrador"
                >
                  <Save size={18} />
                </button>
              )}
              {onGuardarPlantilla && (
                <div className="relative">
                  <button
                    onClick={() => setMostrarGuardarPlantilla(!mostrarGuardarPlantilla)}
                    className="flex items-center justify-center size-9 rounded-lg transition-colors hover:bg-[var(--superficie-hover)]"
                    style={{ color: 'var(--texto-terciario)' }}
                    type="button"
                    title="Guardar como plantilla"
                  >
                    <BookmarkPlus size={18} />
                  </button>
                  {/* Popover para nombre de plantilla */}
                  <AnimatePresence>
                    {mostrarGuardarPlantilla && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-2 w-[280px] rounded-xl shadow-elevada p-4 z-50 space-y-3"
                        style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
                      >
                        <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                          Guardar como plantilla
                        </span>
                        <input
                          type="text"
                          value={nombrePlantilla}
                          onChange={(e) => setNombrePlantilla(e.target.value)}
                          className="w-full text-sm bg-transparent outline-none py-1.5 px-2 rounded-md"
                          style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
                          placeholder="Nombre de la plantilla"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarPlantilla() }}
                        />
                        <div className="flex justify-end gap-2">
                          <Boton variante="fantasma" tamano="xs" onClick={() => { setMostrarGuardarPlantilla(false); setNombrePlantilla('') }}>
                            Cancelar
                          </Boton>
                          <Boton variante="primario" tamano="xs" disabled={!nombrePlantilla.trim()} onClick={handleGuardarPlantilla}>
                            Guardar
                          </Boton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
