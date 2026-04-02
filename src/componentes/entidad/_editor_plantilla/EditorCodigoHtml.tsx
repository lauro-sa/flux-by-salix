'use client'

/**
 * EditorCodigoHtml — Tab de edicion HTML crudo con referencia rapida de etiquetas.
 * Incluye textarea con sintaxis, boton de variables y botones de etiquetas HTML comunes.
 * Se usa en: ModalEditorPlantillaCorreo, tab "Codigo".
 */

import { useRef, useCallback } from 'react'
import { Braces } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'
import { OPCIONES_VISIBILIDAD } from './constantes'

interface PropiedadesEditorCodigoHtml {
  nombre: string
  onNombreChange: (v: string) => void
  asunto: string
  onAsuntoChange: (v: string) => void
  visibilidad: string
  onVisibilidadChange: (v: string) => void
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
  nombre,
  onNombreChange,
  asunto,
  onAsuntoChange,
  visibilidad,
  onVisibilidadChange,
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
    <div className="space-y-4">
      {/* Nombre + Asunto en fila compacta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          etiqueta="Nombre *"
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          placeholder="Nombre de la plantilla"
        />
        <Input
          etiqueta="Asunto"
          value={asunto}
          onChange={(e) => onAsuntoChange(e.target.value)}
          placeholder="Asunto del correo"
        />
      </div>

      {/* Visibilidad (modulos se editan en tab Editar) */}
      <Select
        etiqueta="Quien la puede usar"
        opciones={OPCIONES_VISIBILIDAD.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
        valor={visibilidad}
        onChange={onVisibilidadChange}
      />

      {/* Textarea HTML crudo con boton de variables flotante */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>HTML del correo</label>
        <div className="relative">
          <textarea
            ref={htmlTextareaRef}
            value={htmlCrudo}
            onChange={(e) => onHtmlCrudoChange(e.target.value)}
            placeholder="<p>Hola {{contacto.nombre}},</p>&#10;<p>Adjuntamos el {{presupuesto.numero}}.</p>"
            className="w-full text-xs font-mono bg-transparent outline-none py-3 px-4 pr-10 rounded-lg resize-none"
            style={{
              color: 'var(--texto-primario)',
              border: '1px solid var(--borde-fuerte)',
              minHeight: 280,
              background: 'var(--superficie-app)',
              tabSize: 2,
            }}
            spellCheck={false}
          />
          <div className="absolute top-2 right-2">
            <button
              onClick={onToggleVariablesHtml}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center justify-center size-7 rounded-md transition-colors hover:bg-[var(--superficie-hover)]"
              style={{ color: variablesHtmlAbierto ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}
              type="button"
              title="Insertar variable"
            >
              <Braces size={14} />
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
      </div>

      {/* Referencia rapida HTML — botones con etiqueta visible */}
      <div className="flex flex-wrap items-center gap-1.5 px-1" style={{ color: 'var(--texto-terciario)' }}>
        {ETIQUETAS_HTML.map(({ tag, codigo, desc }) => (
          <button
            key={tag}
            type="button"
            title={`${desc} — ${tag}`}
            onClick={() => insertarEtiqueta(tag)}
            className="flex items-center gap-1 text-xxs px-1.5 py-1 rounded transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto-primario)]"
            style={{ border: '1px solid var(--borde-sutil)' }}
          >
            <span className="font-mono" style={{ color: 'var(--texto-marca)', opacity: 0.7 }}>{codigo}</span>
            <span>{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
