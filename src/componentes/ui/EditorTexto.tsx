'use client'

import { useCallback, useState, useEffect, useRef, type CSSProperties } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontSize } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Link as LinkIcon, Unlink,
  Palette, Type, ChevronDown,
  X, Check,
} from 'lucide-react'
import { useTema } from '@/hooks/useTema'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropiedadesEditorTexto {
  contenido?: string
  onChange?: (html: string) => void
  placeholder?: string
  soloLectura?: boolean
  alturaMinima?: number
  className?: string
  style?: CSSProperties
  /** Colores de marca de la empresa (se muestran como opciones rápidas) */
  coloresMarca?: string[]
  /** Slot extra para acciones custom en el toolbar (ej: botón IA) */
  accionesExtra?: React.ReactNode
  /** Si se define, Enter (sin Shift) llama esto en vez de crear párrafo */
  onEnter?: () => void
  /** Si se define, Backspace en contenido vacío llama esto */
  onBackspaceVacio?: () => void
  /** Callback al recibir foco */
  onFoco?: () => void
  /** Enfocar el editor programáticamente (cambiar para triggear) */
  autoEnfocar?: boolean
}

// ── Tamaños de texto ─────────────────────────────────────────────────────────

const TAMANOS_TEXTO = [
  { id: 'titulo', etiqueta: 'Título', nivel: 1 as const, tipo: 'heading', px: null },
  { id: 'subtitulo', etiqueta: 'Subtítulo', nivel: 2 as const, tipo: 'heading', px: null },
  { id: 'encabezado', etiqueta: 'Encabezado', nivel: 3 as const, tipo: 'heading', px: null },
  { id: 'normal', etiqueta: 'Normal', nivel: null, tipo: 'paragraph', px: null },
  { id: 'pequeno', etiqueta: 'Pequeño', nivel: null, tipo: 'fontSize', px: '12px' },
  { id: 'diminuto', etiqueta: 'Diminuto', nivel: null, tipo: 'fontSize', px: '10px' },
  { id: 'micro', etiqueta: 'Micro', nivel: null, tipo: 'fontSize', px: '8px' },
]

// ── Grilla de colores — 8 columnas, organizada por tono (claro→oscuro) ───────
// Fila 1: saturados puros, Fila 2-4: tints claros, Fila 5-7: shades oscuros
// Columnas: Rojo, Naranja, Amarillo, Verde, Cyan, Azul, Violeta, Rosa

const GRILLA_COLORES = [
  // Negros/grises (fila especial arriba)
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff'],
  // Saturados puros
  ['#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6'],
  // Tints claros 1
  ['#fabec0', '#fcd4b2', '#fff5b1', '#b6e5c0', '#b5edf7', '#b4c7f0', '#d5b3e5', '#f7b5ec'],
  // Tints claros 2
  ['#f4a0a3', '#fab896', '#ffed80', '#8dd8a0', '#89e3f3', '#8baae6', '#c08fd9', '#f291e1'],
  // Medios
  ['#e74c60', '#f69548', '#f2d633', '#52c46a', '#55d8f0', '#5a78de', '#a140c5', '#f050ea'],
  // Shades 1
  ['#b8243d', '#c56928', '#c4a416', '#2d8c3f', '#2aa0bf', '#3350a8', '#711890', '#b820a8'],
  // Shades oscuros
  ['#7a1828', '#84461a', '#846e0f', '#1e5e2a', '#1c6b80', '#223670', '#4b1060', '#7a1570'],
]

// ── Mini picker HSL (vista secundaria, escondida) ────────────────────────────

function PickerHSL({ valorInicial, onAplicar }: {
  valorInicial: string; onAplicar: (c: string) => void; onVolver?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hue, setHue] = useState(220)
  const [sat, setSat] = useState(80)
  const [light, setLight] = useState(50)
  const [hexInput, setHexInput] = useState(valorInicial || '#3b82f6')
  const arrastrando = useRef(false)

  const hslAHex = useCallback((h: number, s: number, l: number): string => {
    const s2 = s / 100, l2 = l / 100
    const a = s2 * Math.min(l2, 1 - l2)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const c = l2 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * Math.max(0, Math.min(1, c))).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }, [])

  // Parsear color inicial
  useEffect(() => {
    if (!valorInicial || valorInicial === 'inherit') return
    try {
      const r = parseInt(valorInicial.slice(1, 3), 16) / 255
      const g = parseInt(valorInicial.slice(3, 5), 16) / 255
      const b = parseInt(valorInicial.slice(5, 7), 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      let h = 0, s = 0
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        else if (max === g) h = ((b - r) / d + 2) / 6
        else h = ((r - g) / d + 4) / 6
      }
      setHue(Math.round(h * 360)); setSat(Math.round(s * 100)); setLight(Math.round(l * 100))
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width, h = canvas.height
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = `hsl(${hue}, ${(x / w) * 100}%, ${100 - (y / h) * 100}%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [hue])

  const manejar = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const ns = Math.round(x * 100), nl = Math.round(100 - y * 100)
    setSat(ns); setLight(nl)
    const hex = hslAHex(hue, ns, nl)
    setHexInput(hex)
  }

  const colorActual = hslAHex(hue, sat, light)

  return (
    <div>
      <div className="p-3 space-y-2.5 min-w-[220px]">
        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef} width={160} height={96}
            className="w-full h-24 rounded-lg cursor-crosshair"
            onMouseDown={(e) => { arrastrando.current = true; manejar(e) }}
            onMouseMove={(e) => { if (arrastrando.current) manejar(e) }}
            onMouseUp={() => arrastrando.current = false}
            onMouseLeave={() => arrastrando.current = false}
          />
          <div
            className="absolute size-3 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${sat}%`, top: `${100 - light}%`, backgroundColor: colorActual }}
          />
        </div>

        {/* Hue slider */}
        <input
          type="range" min={0} max={360} value={hue}
          onChange={(e) => { const h = +e.target.value; setHue(h); setHexInput(hslAHex(h, sat, light)) }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
        />

        {/* Hex input + preview + aplicar */}
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg border border-borde-sutil shrink-0" style={{ backgroundColor: colorActual }} />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const v = e.target.value
              setHexInput(v)
              if (/^#[a-fA-F0-9]{6}$/.test(v)) {
                // Parsear y actualizar sliders
                const r = parseInt(v.slice(1, 3), 16) / 255
                const g = parseInt(v.slice(3, 5), 16) / 255
                const b = parseInt(v.slice(5, 7), 16) / 255
                const max = Math.max(r, g, b), min = Math.min(r, g, b)
                const l = (max + min) / 2
                let h = 0, s = 0
                if (max !== min) {
                  const d = max - min
                  s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                  else if (max === g) h = ((b - r) / d + 2) / 6
                  else h = ((r - g) / d + 4) / 6
                }
                setHue(Math.round(h * 360)); setSat(Math.round(s * 100)); setLight(Math.round(l * 100))
              }
            }}
            className="flex-1 text-xs font-mono bg-superficie-hover/50 text-texto-primario rounded-md px-2 py-1.5 outline-none border border-borde-sutil focus:border-texto-marca min-w-0"
            placeholder="#3b82f6"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAplicar(colorActual)}
            className="text-xs font-medium text-white bg-texto-marca hover:bg-texto-marca/90 rounded-md px-3 py-1.5 transition-colors shrink-0"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

function EditorTexto({
  contenido = '',
  onChange,
  placeholder = '',
  soloLectura = false,
  alturaMinima = 120,
  className = '',
  style,
  coloresMarca = [],
  accionesExtra,
  onEnter,
  onBackspaceVacio,
  onFoco,
  autoEnfocar = false,
}: PropiedadesEditorTexto) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [panelAbierto, setPanelAbierto] = useState<'color' | 'tamano' | 'link' | null>(null)
  const [tabColor, setTabColor] = useState<'solido' | 'picker'>('solido')
  const [urlLink, setUrlLink] = useState('')
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; abreArriba: boolean } | null>(null)
  const [haySeleccion, setHaySeleccion] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const cerrarPaneles = () => { setPanelAbierto(null); setTabColor('solido') }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, FontSize, Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { class: 'text-texto-marca underline cursor-pointer' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: contenido,
    editable: !soloLectura,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection
      if (from !== to) {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect()
          if (rect.width > 0) {
            const alturaToolbar = 44
            const margen = 8
            // Detectar si hay espacio arriba; si no, abrir abajo de la selección
            const hayEspacioArriba = rect.top > alturaToolbar + margen
            const abreArriba = hayEspacioArriba
            const top = abreArriba
              ? Math.max(margen, rect.top - alturaToolbar - margen)
              : rect.bottom + margen
            const left = Math.max(margen, Math.min(
              rect.left + rect.width / 2 - 200,
              window.innerWidth - 420
            ))
            setToolbarPos({ top, left, abreArriba })
            setHaySeleccion(true)
            return
          }
        }
      }
      setHaySeleccion(false)
      cerrarPaneles()
    },
    onFocus: () => onFoco?.(),
    editorProps: {
      attributes: { class: 'tiptap outline-none min-h-full' },
      handleKeyDown: onEnter || onBackspaceVacio ? (_view, evento) => {
        if (onEnter && evento.key === 'Enter' && !evento.shiftKey) {
          evento.preventDefault()
          onEnter()
          return true
        }
        if (onBackspaceVacio && evento.key === 'Backspace') {
          const contenido = _view.state.doc.textContent
          if (contenido === '') {
            evento.preventDefault()
            onBackspaceVacio()
            return true
          }
        }
        return false
      } : undefined,
    },
  })

  // Cerrar toolbar al hacer clic fuera del editor y del toolbar
  useEffect(() => {
    if (!haySeleccion) return
    const manejar = (e: MouseEvent) => {
      const target = e.target as Node
      // No cerrar si hacen clic en el toolbar o sus paneles
      if (toolbarRef.current?.contains(target)) return
      // No cerrar si hacen clic dentro del propio editor TipTap
      if (editor?.view.dom.contains(target)) return
      setHaySeleccion(false)
      cerrarPaneles()
    }
    document.addEventListener('mousedown', manejar)
    return () => document.removeEventListener('mousedown', manejar)
  }, [haySeleccion, editor])

  // Enfocar programáticamente
  useEffect(() => {
    if (autoEnfocar && editor && !editor.isFocused) {
      const t = setTimeout(() => editor.commands.focus('end'), 30)
      return () => clearTimeout(t)
    }
  }, [autoEnfocar, editor])

  const aplicarLink = useCallback(() => {
    if (!editor || !urlLink.trim()) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: urlLink.startsWith('http') ? urlLink : `https://${urlLink}` }).run()
    setUrlLink(''); setPanelAbierto(null)
  }, [editor, urlLink])

  const quitarLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setPanelAbierto(null)
  }, [editor])

  if (!editor) return null

  const estiloSuperficie = esCristal
    ? { backgroundColor: 'var(--superficie-flotante)', backdropFilter: 'blur(32px) saturate(1.5)', WebkitBackdropFilter: 'blur(32px) saturate(1.5)' }
    : { backgroundColor: 'var(--superficie-elevada)' }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const Btn = ({ activo, onClick, titulo, children }: {
    activo?: boolean; onClick: () => void; titulo: string; children: React.ReactNode
  }) => (
    <button
      type="button" onClick={onClick} onMouseDown={(e) => e.preventDefault()}
      className={['flex items-center justify-center size-7 rounded-md transition-all duration-100 cursor-pointer active:scale-90',
        activo ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
      ].join(' ')} title={titulo}
    >{children}</button>
  )

  const Sep = () => <div className="w-px h-4 bg-borde-sutil mx-0.5 shrink-0" />

  const tamanoActivo = TAMANOS_TEXTO.find(t => {
    if (t.tipo === 'heading') return editor.isActive('heading', { level: t.nivel })
    if (t.tipo === 'fontSize') return editor.isActive('textStyle', { fontSize: t.px })
    return t.tipo === 'paragraph' && !editor.isActive('heading') && !editor.getAttributes('textStyle').fontSize
  })

  const colorTextoActual = editor.getAttributes('textStyle').color || null
  const colorFondoActual = editor.getAttributes('highlight').color || null

  // ── Panel de tamaños ───────────────────────────────────────────────────────

  // Tamaños en px para mostrar al usuario
  const pxPorTamano: Record<string, string> = {
    titulo: '24px', subtitulo: '20px', encabezado: '17px', normal: '14px',
    pequeno: '12px', diminuto: '10px', micro: '8px',
  }

  const renderPanelTamano = () => {
    if (panelAbierto !== 'tamano') return null
    return (
      <div className="py-1 min-w-[160px]">
        {TAMANOS_TEXTO.map(t => {
          const activo = t.id === tamanoActivo?.id
          return (
            <button
              key={t.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (t.tipo === 'heading' && t.nivel) editor.chain().focus().unsetFontSize().toggleHeading({ level: t.nivel }).run()
                else if (t.tipo === 'fontSize' && t.px) editor.chain().focus().clearNodes().setFontSize(t.px).run()
                else editor.chain().focus().clearNodes().unsetFontSize().run()
                setPanelAbierto(null)
              }}
              className={['w-full text-left px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-4',
                activo ? 'bg-texto-marca/10 text-texto-marca' : 'text-texto-primario hover:bg-superficie-hover',
              ].join(' ')}
            >
              <span className={
                t.nivel === 1 ? 'text-lg font-bold' : t.nivel === 2 ? 'text-base font-semibold' :
                t.nivel === 3 ? 'text-sm font-semibold' : t.tipo === 'fontSize' ? 'text-xs text-texto-secundario' : 'text-sm'
              }>{t.etiqueta}</span>
              <span className="text-xxs text-texto-terciario font-mono">{pxPorTamano[t.id]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Panel de color con pestañas ─────────────────────────────────────────────

  const pestanasColor: { id: 'solido' | 'picker'; etiqueta: string }[] = [
    { id: 'solido', etiqueta: 'Sólido' },
    { id: 'picker', etiqueta: 'Personalizado' },
  ]

  // Aplicar color: texto o fondo según qué tiene activo
  const aplicarColor = (color: string) => {
    editor.chain().focus().setColor(color).run()
    cerrarPaneles()
  }

  const quitarColor = () => {
    editor.chain().focus().unsetColor().unsetHighlight().run()
    cerrarPaneles()
  }

  const renderPanelColor = () => {
    if (panelAbierto !== 'color') return null

    return (
      <div className="w-fit">
        {/* Pestañas + botón borrar */}
        <div className="flex items-center border-b border-borde-sutil">
          {pestanasColor.map(tab => (
            <button
              key={tab.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTabColor(tab.id as typeof tabColor)}
              className={[
                'px-3 py-2 text-xs font-medium transition-colors cursor-pointer relative',
                tabColor === tab.id
                  ? 'text-texto-primario'
                  : 'text-texto-terciario hover:text-texto-secundario',
              ].join(' ')}
            >
              {tab.etiqueta}
              {tabColor === tab.id && (
                <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-texto-marca rounded-full" />
              )}
            </button>
          ))}
          {/* Borrar color */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={quitarColor}
            className="ml-auto mr-2 flex items-center justify-center size-6 rounded-md text-texto-terciario hover:text-insignia-peligro hover:bg-superficie-hover transition-colors cursor-pointer"
            title="Quitar color"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab: Sólido — grilla + marca */}
        {tabColor === 'solido' && (
          <div className="p-2">
            {/* Mini sección: color Flux + colores de marca/logo */}
            <div className="mb-2 pb-2 border-b border-borde-sutil">
              <span className="text-xxs font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">Tu marca</span>
              <div className="flex items-center gap-1.5">
                {/* Color de Flux siempre */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => aplicarColor('#5b5bd6')}
                  className={[
                    'size-[26px] rounded-md transition-all duration-100 cursor-pointer relative shrink-0',
                    colorTextoActual === '#5b5bd6' ? 'ring-2 ring-texto-marca ring-offset-1' : 'hover:ring-2 hover:ring-borde-fuerte hover:ring-offset-1',
                  ].join(' ')}
                  style={{ backgroundColor: '#5b5bd6' }}
                  title="Flux by Salix"
                >
                  {colorTextoActual === '#5b5bd6' && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                </button>
                {/* Colores de la empresa (marca + logo) */}
                {coloresMarca.map((c, i) => (
                  <button
                    key={i} type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => aplicarColor(c)}
                    className={[
                      'size-[26px] rounded-md transition-all duration-100 cursor-pointer relative shrink-0',
                      colorTextoActual === c ? 'ring-2 ring-texto-marca ring-offset-1' : 'hover:ring-2 hover:ring-borde-fuerte hover:ring-offset-1',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {colorTextoActual === c && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Grilla de colores */}
            <div className="space-y-0.5">
              {GRILLA_COLORES.map((fila, i) => (
                <div key={i} className="flex gap-0.5">
                  {fila.map((color, j) => (
                    <button
                      key={`${i}-${j}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => aplicarColor(color)}
                      className={[
                        'size-[26px] rounded-md transition-all duration-100 cursor-pointer relative',
                        colorTextoActual === color
                          ? 'ring-2 ring-texto-marca ring-offset-1'
                          : 'hover:scale-110 hover:ring-1 hover:ring-borde-fuerte',
                        color === '#ffffff' ? 'border border-borde-sutil' : '',
                      ].join(' ')}
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {colorTextoActual === color && <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Personalizado */}
        {tabColor === 'picker' && (
          <PickerHSL
            valorInicial={colorTextoActual || '#3b82f6'}
            onAplicar={(c) => { editor.chain().focus().setColor(c).run(); cerrarPaneles() }}
          />
        )}
      </div>
    )
  }

  // ── Panel de link ──────────────────────────────────────────────────────────

  const renderPanelLink = () => {
    if (panelAbierto !== 'link') return null
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <LinkIcon size={13} className="text-texto-terciario shrink-0" />
        <input
          type="url" value={urlLink} onChange={(e) => setUrlLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') aplicarLink() }}
          placeholder="https://..."
          className="flex-1 text-xs bg-transparent text-texto-primario placeholder:text-texto-terciario outline-none min-w-0"
          autoFocus
        />
        <button type="button" onClick={aplicarLink} disabled={!urlLink.trim()} onMouseDown={(e) => e.preventDefault()}
          className="text-xxs font-medium text-texto-marca hover:underline disabled:opacity-40 shrink-0">OK</button>
        <button type="button" onClick={() => { setPanelAbierto(null); setUrlLink('') }} onMouseDown={(e) => e.preventDefault()}
          className="text-texto-terciario hover:text-texto-primario"><X size={12} /></button>
      </div>
    )
  }

  // ── Toolbar flotante ───────────────────────────────────────────────────────

  // Posición del sub-dropdown: si el toolbar abre arriba, el panel va arriba del toolbar.
  // Si el toolbar abre abajo, el panel va debajo del toolbar.
  const alturaToolbarPx = 42
  const subDropdownLeft = toolbarPos?.left ?? 0

  const toolbar = haySeleccion && toolbarPos && createPortal(
    <AnimatePresence>
      {/* Barra principal del toolbar */}
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.97 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="fixed z-[9999] rounded-lg shadow-elevada border border-borde-sutil"
        style={{ top: toolbarPos.top, left: toolbarPos.left, ...estiloSuperficie }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-0.5 px-1.5 py-1">
          {/* Tamaño */}
          <button
            type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPanelAbierto(panelAbierto === 'tamano' ? null : 'tamano')}
            className={['flex items-center gap-0.5 px-2 h-7 rounded-md text-xs font-medium transition-all cursor-pointer min-w-[80px]',
              panelAbierto === 'tamano' ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
            ].join(' ')} title="Tamaño de texto"
          >
            <span className="truncate">{tamanoActivo?.etiqueta ?? 'Normal'}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>

          <Sep />

          <Btn activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} titulo="Negrita"><Bold size={14} /></Btn>
          <Btn activo={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} titulo="Itálica"><Italic size={14} /></Btn>
          <Btn activo={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} titulo="Subrayado"><UnderlineIcon size={14} /></Btn>
          <Btn activo={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} titulo="Tachado"><Strikethrough size={14} /></Btn>

          <Sep />

          <Btn activo={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} titulo="Izquierda"><AlignLeft size={14} /></Btn>
          <Btn activo={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} titulo="Centro"><AlignCenter size={14} /></Btn>
          <Btn activo={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} titulo="Derecha"><AlignRight size={14} /></Btn>

          <Sep />

          <Btn activo={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} titulo="Viñetas"><List size={14} /></Btn>
          <Btn activo={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} titulo="Numerada"><ListOrdered size={14} /></Btn>

          <Sep />

          {/* Color */}
          <button
            type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setPanelAbierto(panelAbierto === 'color' ? null : 'color'); setTabColor('solido') }}
            className={['flex flex-col items-center justify-center size-7 rounded-md transition-all duration-100 cursor-pointer',
              panelAbierto === 'color' ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
            ].join(' ')} title="Colores"
          >
            <Palette size={13} />
            <div className="w-3.5 h-1 rounded-full mt-px" style={{ backgroundColor: colorTextoActual || 'var(--texto-primario)' }} />
          </button>

          <Sep />

          {editor.isActive('link')
            ? <Btn onClick={quitarLink} titulo="Quitar enlace"><Unlink size={14} /></Btn>
            : <Btn onClick={() => setPanelAbierto(panelAbierto === 'link' ? null : 'link')} activo={panelAbierto === 'link'} titulo="Enlace"><LinkIcon size={14} /></Btn>
          }

          <Btn onClick={() => { editor.chain().focus().clearNodes().unsetAllMarks().run(); cerrarPaneles() }} titulo="Limpiar formato"><Type size={14} /></Btn>

          {accionesExtra && <><Sep />{accionesExtra}</>}
        </div>
      </motion.div>

      {/* Sub-dropdown independiente (tamaños / colores / link) */}
      {panelAbierto && toolbarPos && (() => {
        // Decidir si el panel va arriba o abajo del toolbar según el espacio
        const espacioDebajo = window.innerHeight - (toolbarPos.top + alturaToolbarPx)
        const alturaEstimadaPanel = panelAbierto === 'color' ? 380 : panelAbierto === 'tamano' ? 260 : 50
        const panelAbajo = espacioDebajo > alturaEstimadaPanel
        return (
        <motion.div
          initial={{ opacity: 0, y: panelAbajo ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: panelAbajo ? -4 : 4 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[9999] rounded-lg shadow-elevada border border-borde-sutil overflow-hidden max-h-[80vh] overflow-y-auto"
          style={{
            ...(panelAbajo
              ? { top: toolbarPos.top + alturaToolbarPx + 4 }
              : { bottom: window.innerHeight - toolbarPos.top + 4 }),
            left: Math.max(8, Math.min(subDropdownLeft, window.innerWidth - 340)),
            ...estiloSuperficie,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {renderPanelTamano()}
          {renderPanelColor()}
          {renderPanelLink()}
        </motion.div>
        )
      })()}
    </AnimatePresence>,
    document.body
  )

  return (
    <div
      className={['rounded-lg border border-borde-sutil bg-superficie-tarjeta overflow-hidden',
        'focus-within:ring-2 focus-within:ring-texto-marca/20 transition-shadow', className].join(' ')}
      style={style}
    >
      {toolbar}
      <EditorContent editor={editor} className="px-4 py-3 text-sm" style={{ minHeight: alturaMinima }} />
    </div>
  )
}

export { EditorTexto, type PropiedadesEditorTexto }
