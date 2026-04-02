'use client'

/**
 * Toolbar flotante del EditorTexto.
 * Se renderiza como portal en document.body cuando hay texto seleccionado.
 * Incluye: formato basico, alineacion, listas, color, tamano, links y acciones extra.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
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
import { PickerHSL } from '@/componentes/ui/_editor_texto/PickerHSL'
import {
  TAMANOS_TEXTO, GRILLA_COLORES, PX_POR_TAMANO,
  type TipoPanel,
} from '@/componentes/ui/_editor_texto/tipos'

// ── Props ───────────────────────────────────────────────────────────────────

interface PropiedadesToolbar {
  editor: Editor
  /** Estilo de superficie (cristal o solido) */
  estiloSuperficie: Record<string, string | undefined>
  /** Colores de marca de la empresa */
  coloresMarca: string[]
  /** Slot extra de acciones */
  accionesExtra?: React.ReactNode
}

// ── Helpers internos ────────────────────────────────────────────────────────

/** Boton individual del toolbar */
function Btn({ activo, onClick, titulo, children }: {
  activo?: boolean; onClick: () => void; titulo: string; children: React.ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick} onMouseDown={(e) => e.preventDefault()}
      className={['flex items-center justify-center size-7 rounded-md transition-all duration-100 cursor-pointer active:scale-90',
        activo ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
      ].join(' ')} title={titulo}
    >{children}</button>
  )
}

/** Separador vertical entre grupos de botones */
function Sep() {
  return <div className="w-px h-4 bg-borde-sutil mx-0.5 shrink-0" />
}

// ── Componente principal ────────────────────────────────────────────────────

export function ToolbarEditorTexto({
  editor,
  estiloSuperficie,
  coloresMarca,
  accionesExtra,
}: PropiedadesToolbar) {
  const [panelAbierto, setPanelAbierto] = useState<TipoPanel>(null)
  const panelAbiertoRef = useRef(panelAbierto)
  panelAbiertoRef.current = panelAbierto
  const [tabColor, setTabColor] = useState<'solido' | 'picker'>('solido')
  const [urlLink, setUrlLink] = useState('')
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; abreArriba: boolean } | null>(null)
  const [haySeleccion, setHaySeleccion] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  // Guardar seleccion cuando se abre un panel para poder restaurarla
  const seleccionGuardadaRef = useRef<{ from: number; to: number } | null>(null)

  const cerrarPaneles = useCallback(() => {
    setPanelAbierto(null)
    setTabColor('solido')
    seleccionGuardadaRef.current = null
  }, [])

  const abrirPanel = useCallback((panel: 'color' | 'tamano' | 'link') => {
    if (panelAbiertoRef.current === panel) { cerrarPaneles(); return }
    // Guardar seleccion actual antes de abrir el panel
    if (editor) {
      const { from, to } = editor.state.selection
      seleccionGuardadaRef.current = { from, to }
    }
    setPanelAbierto(panel)
    if (panel === 'color') setTabColor('solido')
  }, [editor, cerrarPaneles])

  /** Restaurar seleccion guardada antes de ejecutar un comando */
  const restaurarSeleccion = useCallback(() => {
    if (editor && seleccionGuardadaRef.current) {
      const { from, to } = seleccionGuardadaRef.current
      editor.commands.setTextSelection({ from, to })
    }
  }, [editor])

  // Escuchar cambios de seleccion en el editor para posicionar el toolbar
  useEffect(() => {
    if (!editor) return

    const manejarSeleccion = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect()
          if (rect.width > 0) {
            const alturaToolbar = 44
            const margen = 8
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
    }

    editor.on('selectionUpdate', manejarSeleccion)
    return () => { editor.off('selectionUpdate', manejarSeleccion) }
  }, [editor, cerrarPaneles])

  // Cerrar toolbar al hacer clic fuera del editor y del toolbar
  useEffect(() => {
    if (!haySeleccion && !panelAbierto) return
    const manejar = (e: MouseEvent) => {
      const target = e.target as Node
      if (toolbarRef.current?.contains(target)) return
      const panelEl = document.querySelector('[data-panel-editor]')
      if (panelEl?.contains(target)) return
      if (editor?.view.dom.contains(target)) return
      setHaySeleccion(false)
      cerrarPaneles()
    }
    document.addEventListener('mousedown', manejar)
    return () => document.removeEventListener('mousedown', manejar)
  }, [haySeleccion, panelAbierto, editor, cerrarPaneles])

  // ── Acciones de link ──────────────────────────────────────────────────────

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

  // ── Acciones de color ─────────────────────────────────────────────────────

  const aplicarColor = useCallback((color: string) => {
    if (editor && seleccionGuardadaRef.current) {
      const { from, to } = seleccionGuardadaRef.current
      editor.chain().focus().setTextSelection({ from, to }).setColor(color).run()
    } else if (editor) {
      editor.chain().focus().setColor(color).run()
    }
    cerrarPaneles()
  }, [editor, cerrarPaneles])

  const quitarColor = useCallback(() => {
    if (editor && seleccionGuardadaRef.current) {
      const { from, to } = seleccionGuardadaRef.current
      editor.chain().focus().setTextSelection({ from, to }).unsetColor().unsetHighlight().run()
    } else if (editor) {
      editor.chain().focus().unsetColor().unsetHighlight().run()
    }
    cerrarPaneles()
  }, [editor, cerrarPaneles])

  // ── Valores derivados ─────────────────────────────────────────────────────

  const tamanoActivo = TAMANOS_TEXTO.find(t => {
    if (t.tipo === 'fontSize') return editor.isActive('textStyle', { fontSize: t.px })
    return t.tipo === 'reset' && !editor.getAttributes('textStyle').fontSize
  })

  const colorTextoActual = editor.getAttributes('textStyle').color || null

  // ── Sub-paneles ───────────────────────────────────────────────────────────

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
                const sel = seleccionGuardadaRef.current
                if (sel && editor) editor.commands.setTextSelection({ from: sel.from, to: sel.to })
                if (t.tipo === 'fontSize' && t.px) {
                  editor.chain().focus().setMark('textStyle', { fontSize: t.px }).run()
                } else {
                  editor.chain().focus().unsetMark('textStyle').run()
                }
                setPanelAbierto(null)
              }}
              className={['w-full text-left px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-4',
                activo ? 'bg-texto-marca/10 text-texto-marca' : 'text-texto-primario hover:bg-superficie-hover',
              ].join(' ')}
            >
              <span style={{ fontSize: t.px || '14px', fontWeight: t.px && parseInt(t.px) >= 18 ? 600 : 400 }}>{t.etiqueta}</span>
              <span className="text-xxs text-texto-terciario font-mono">{PX_POR_TAMANO[t.id]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const pestanasColor: { id: 'solido' | 'picker'; etiqueta: string }[] = [
    { id: 'solido', etiqueta: 'Solido' },
    { id: 'picker', etiqueta: 'Personalizado' },
  ]

  const renderPanelColor = () => {
    if (panelAbierto !== 'color') return null
    return (
      <div className="w-fit">
        {/* Pestanas + boton borrar */}
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

        {/* Tab: Solido — grilla + marca */}
        {tabColor === 'solido' && (
          <div className="p-2">
            {/* Mini seccion: color Flux + colores de marca/logo */}
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

  const renderPanelLink = () => {
    if (panelAbierto !== 'link') return null
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <LinkIcon size={13} className="text-texto-terciario shrink-0" />
        <input
          type="url" value={urlLink} onChange={(e) => setUrlLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') aplicarLink() }}
          placeholder="https://..."
          className="flex-1 text-xs bg-transparent text-texto-primario placeholder:text-texto-placeholder outline-none min-w-0"
          autoFocus
        />
        <button type="button" onClick={aplicarLink} disabled={!urlLink.trim()} onMouseDown={(e) => e.preventDefault()}
          className="text-xxs font-medium text-texto-marca hover:underline disabled:opacity-40 shrink-0">OK</button>
        <button type="button" onClick={() => { setPanelAbierto(null); setUrlLink('') }} onMouseDown={(e) => e.preventDefault()}
          className="text-texto-terciario hover:text-texto-primario"><X size={12} /></button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if ((!haySeleccion && !panelAbierto) || !toolbarPos) return null

  const alturaToolbarPx = 42
  const subDropdownLeft = toolbarPos.left

  return createPortal(
    <AnimatePresence>
      {/* Barra principal del toolbar */}
      <motion.div
        key="toolbar-principal"
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
          {/* Tamano */}
          <button
            type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => abrirPanel('tamano')}
            className={['flex items-center gap-0.5 px-2 h-7 rounded-md text-xs font-medium transition-all cursor-pointer min-w-[80px]',
              panelAbierto === 'tamano' ? 'bg-texto-marca/15 text-texto-marca' : 'text-texto-secundario hover:text-texto-primario hover:bg-superficie-hover',
            ].join(' ')} title="Tamano de texto"
          >
            <span className="truncate">{tamanoActivo?.etiqueta ?? 'Normal'}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>

          <Sep />

          <Btn activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} titulo="Negrita"><Bold size={14} /></Btn>
          <Btn activo={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} titulo="Italica"><Italic size={14} /></Btn>
          <Btn activo={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} titulo="Subrayado"><UnderlineIcon size={14} /></Btn>
          <Btn activo={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} titulo="Tachado"><Strikethrough size={14} /></Btn>

          <Sep />

          <Btn activo={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} titulo="Izquierda"><AlignLeft size={14} /></Btn>
          <Btn activo={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} titulo="Centro"><AlignCenter size={14} /></Btn>
          <Btn activo={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} titulo="Derecha"><AlignRight size={14} /></Btn>

          <Sep />

          <Btn activo={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} titulo="Vinetas"><List size={14} /></Btn>
          <Btn activo={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} titulo="Numerada"><ListOrdered size={14} /></Btn>

          <Sep />

          {/* Color */}
          <button
            type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => abrirPanel('color')}
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
            : <Btn onClick={() => abrirPanel('link')} activo={panelAbierto === 'link'} titulo="Enlace"><LinkIcon size={14} /></Btn>
          }

          <Btn onClick={() => { editor.chain().focus().clearNodes().unsetAllMarks().run(); cerrarPaneles() }} titulo="Limpiar formato"><Type size={14} /></Btn>

          {accionesExtra && <><Sep />{accionesExtra}</>}
        </div>
      </motion.div>

      {/* Sub-dropdown independiente (tamanos / colores / link) */}
      {panelAbierto && toolbarPos && (() => {
        const espacioDebajo = window.innerHeight - (toolbarPos.top + alturaToolbarPx)
        const alturaEstimadaPanel = panelAbierto === 'color' ? 380 : panelAbierto === 'tamano' ? 260 : 50
        const panelAbajo = espacioDebajo > alturaEstimadaPanel
        return (
          <motion.div
            key="toolbar-panel"
            initial={{ opacity: 0, y: panelAbajo ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: panelAbajo ? -4 : 4 }}
            transition={{ duration: 0.1 }}
            data-panel-editor="true"
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
}
