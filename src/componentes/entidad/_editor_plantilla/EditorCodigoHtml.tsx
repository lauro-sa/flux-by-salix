'use client'

/**
 * EditorCodigoHtml — Tab de edicion HTML crudo con referencia rapida de etiquetas.
 * Incluye textarea con sintaxis, boton de variables y botones de etiquetas HTML comunes.
 * Se usa en: ModalEditorPlantillaCorreo, tab "Codigo".
 */

import { useRef, useCallback } from 'react'
import { Braces } from 'lucide-react'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { Tooltip } from '@/componentes/ui/Tooltip'

interface PropiedadesEditorCodigoHtml {
  htmlCrudo: string
  onHtmlCrudoChange: (v: string) => void
  variablesHtmlAbierto: boolean
  onToggleVariablesHtml: () => void
  onCerrarVariablesHtml: () => void
  onInsertarVariableHtml: (v: string) => void
  contextoVariables: Record<string, Record<string, unknown>>
}

// ─── Referencia rapida de etiquetas HTML ───

const ETIQUETAS_HTML = [
  { tag: '<p>...</p>', codigo: '<p>', desc: 'Parrafo' },
  { tag: '<br/>', codigo: '<br/>', desc: 'Salto' },
  { tag: '<strong>...</strong>', codigo: '<strong>', desc: 'Negrita' },
  { tag: '<em>...</em>', codigo: '<em>', desc: 'Cursiva' },
  { tag: '<u>...</u>', codigo: '<u>', desc: 'Subrayado' },
  { tag: '<a href="">...</a>', codigo: '<a>', desc: 'Enlace' },
  { tag: '<ul><li>...</li></ul>', codigo: '<ul>', desc: 'Lista' },
  { tag: '<ol><li>...</li></ol>', codigo: '<ol>', desc: 'Lista num.' },
  { tag: '<h1>...</h1>', codigo: '<h1>', desc: 'Titulo' },
  { tag: '<h2>...</h2>', codigo: '<h2>', desc: 'Subtitulo' },
  { tag: '<h3>...</h3>', codigo: '<h3>', desc: 'Encabezado' },
  { tag: '<hr/>', codigo: '<hr/>', desc: 'Linea' },
]

export function EditorCodigoHtml({
  htmlCrudo,
  onHtmlCrudoChange,
  variablesHtmlAbierto,
  onToggleVariablesHtml,
  onCerrarVariablesHtml,
  onInsertarVariableHtml,
  contextoVariables,
}: PropiedadesEditorCodigoHtml) {
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Insertar etiqueta HTML envolviendo la seleccion
  const insertarEtiqueta = useCallback((tag: string) => {
    const ta = htmlTextareaRef.current
    if (!ta) return
    const inicio = ta.selectionStart ?? htmlCrudo.length
    const fin = ta.selectionEnd ?? htmlCrudo.length
    const seleccion = htmlCrudo.slice(inicio, fin)
    const insertar = seleccion ? tag.replace('...', seleccion) : tag
    const nuevo = htmlCrudo.slice(0, inicio) + insertar + htmlCrudo.slice(fin)
    onHtmlCrudoChange(nuevo)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = inicio + insertar.length
      ta.setSelectionRange(pos, pos)
    })
  }, [htmlCrudo, onHtmlCrudoChange])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Textarea HTML crudo — ocupa todo el espacio */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <label className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>HTML del correo</label>
          <div className="relative">
            <button
              onClick={onToggleVariablesHtml}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-boton transition-colors hover:bg-[var(--superficie-hover)]"
              style={{ color: variablesHtmlAbierto ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}
              type="button"
            >
              <Braces size={13} />
              <span>Insertar variable</span>
            </button>
            <SelectorVariables
              abierto={variablesHtmlAbierto}
              onCerrar={onCerrarVariablesHtml}
              onSeleccionar={onInsertarVariableHtml}
              posicion="abajo"
              contexto={contextoVariables}
            />
          </div>
        </div>
        <textarea
          ref={htmlTextareaRef}
          value={htmlCrudo}
          onChange={(e) => onHtmlCrudoChange(e.target.value)}
          placeholder={"<p>Hola {{contacto.nombre}},</p>\n<p>Adjuntamos el {{presupuesto.numero}}.</p>"}
          spellCheck={false}
          rows={12}
          className="w-full rounded-boton border border-borde-fuerte bg-superficie-tarjeta px-3 py-2 text-xs font-mono text-texto-primario placeholder:text-texto-placeholder resize-y outline-none focus:border-borde-foco focus:shadow-foco transition-all"
          style={{ tabSize: 2, minHeight: 220 }}
        />
      </div>

      {/* Referencia rapida HTML — botones con etiqueta visible */}
      <div className="flex flex-wrap items-center gap-1.5 px-1" style={{ color: 'var(--texto-terciario)' }}>
        {ETIQUETAS_HTML.map(({ tag, codigo, desc }) => (
          <Tooltip key={tag} contenido={`${desc} — ${tag}`}>
            <button
              type="button"
              onClick={() => insertarEtiqueta(tag)}
              className="flex items-center gap-1 text-xxs px-1.5 py-1 rounded transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto-primario)] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
              style={{ border: '1px solid var(--borde-sutil)' }}
            >
              <span className="font-mono" style={{ color: 'var(--texto-marca)', opacity: 0.7 }}>{codigo}</span>
              <span>{desc}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
