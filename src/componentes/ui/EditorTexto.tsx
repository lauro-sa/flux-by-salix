'use client'

/**
 * EditorTexto — Editor de texto rico basado en TipTap.
 * Este archivo es el orquestador: configura TipTap, renderiza el contenido
 * y delega el toolbar flotante al sub-componente ToolbarEditorTexto.
 *
 * Sub-componentes en: @/componentes/ui/_editor_texto/
 */

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { VariableChip } from '@/componentes/ui/ExtensionVariableChip'
import { useTema } from '@/hooks/useTema'
import { FontSizeInline } from '@/componentes/ui/_editor_texto/extensiones'
import { ToolbarEditorTexto } from '@/componentes/ui/_editor_texto/ToolbarEditorTexto'
import type { PropiedadesEditorTexto } from '@/componentes/ui/_editor_texto/tipos'

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
  onEditorListo,
  habilitarVariables = false,
  sinMarco = false,
}: PropiedadesEditorTexto) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'

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
      TextStyle, FontSizeInline, Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { class: 'text-texto-marca underline cursor-pointer' } }),
      Placeholder.configure({ placeholder }),
      // Checklist al estilo Apple Notes / Notion: cada ítem renderiza como un
      // <li data-checked="true|false"> con un checkbox real clickeable. El
      // estado se persiste dentro del HTML, así que sobrevive al guardado
      // tal cual. El estilo visual del checkbox vive en globals.css (`.tiptap
      // ul[data-type="taskList"]`) usando tokens dark/light.
      TaskList,
      TaskItem.configure({ nested: true }),
      ...(habilitarVariables ? [VariableChip] : []),
    ],
    content: contenido,
    editable: !soloLectura,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
    onFocus: () => onFoco?.(),
    editorProps: {
      attributes: { class: 'tiptap outline-none h-full' },
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

  // Emitir instancia del editor al padre si lo necesita
  useEffect(() => {
    if (editor && onEditorListo) onEditorListo(editor)
  }, [editor, onEditorListo])

  // Enfocar programaticamente
  useEffect(() => {
    if (autoEnfocar && editor && !editor.isFocused) {
      const t = setTimeout(() => editor.commands.focus('end'), 30)
      return () => clearTimeout(t)
    }
  }, [autoEnfocar, editor])

  if (!editor) return null

  // Estilo de superficie para el toolbar flotante (cristal o solido)
  const estiloSuperficie: Record<string, string | undefined> = esCristal
    ? { backgroundColor: 'var(--superficie-flotante)', backdropFilter: 'blur(32px) saturate(1.5)', WebkitBackdropFilter: 'blur(32px) saturate(1.5)' }
    : { backgroundColor: 'var(--superficie-elevada)' }

  // Modo "sinMarco": el wrapper no aporta chrome propio (sin border, sin
  // fondo, sin rounded). Se asume que el consumidor maneja el contenedor
  // exterior. También sacamos `overflow-hidden` para que el padre pueda
  // scrollear el contenido cuando crece.
  const wrapperClassName = sinMarco
    ? ['flex flex-col', className].join(' ')
    : ['rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden',
       'focus-within:ring-2 focus-within:ring-texto-marca/20 transition-shadow', className].join(' ')

  // Sin marco = sin padding interno tampoco (el padre lo decide); con
  // marco mantenemos el padding default del contenido.
  const contentClassName = sinMarco
    ? 'text-sm flex flex-col flex-1 [&>div]:flex-1 [&>div>div]:flex-1'
    : 'px-4 py-3 text-sm flex flex-col flex-1 [&>div]:flex-1 [&>div>div]:flex-1'

  return (
    <div className={wrapperClassName} style={style}>
      <ToolbarEditorTexto
        editor={editor}
        estiloSuperficie={estiloSuperficie}
        coloresMarca={coloresMarca}
        accionesExtra={accionesExtra}
      />
      <EditorContent editor={editor} className={contentClassName} style={sinMarco ? undefined : { minHeight: alturaMinima }} />
    </div>
  )
}

export { EditorTexto, type PropiedadesEditorTexto }
