'use client'

/**
 * AsuntoConVariables — Campo de asunto con variables resueltas inline (contentEditable).
 * Muestra chips de variables con sus valores de preview dentro del input.
 * Se usa en: ModalEditorPlantillaCorreo, tab de edicion visual.
 */

import { useRef, useMemo, useCallback, useEffect } from 'react'
import { Braces } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorVariables } from '@/componentes/ui/SelectorVariables'

interface PropiedadesAsuntoConVariables {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  contexto?: Record<string, Record<string, unknown>>
  variablesAbierto: boolean
  onToggleVariables: () => void
  onCerrarVariables: () => void
  onInsertarVariable: (v: string) => void
  etiqueta?: string
}

export function AsuntoConVariables({
  valor,
  onChange,
  placeholder,
  contexto,
  variablesAbierto,
  onToggleVariables,
  onCerrarVariables,
  onInsertarVariable,
  etiqueta,
}: PropiedadesAsuntoConVariables) {
  const editableRef = useRef<HTMLDivElement>(null)
  const skipUpdateRef = useRef(false)

  // Parsear texto en segmentos
  const segmentos = useMemo(() => {
    const result: Array<{ tipo: 'texto'; valor: string } | { tipo: 'variable'; entidad: string; campo: string; raw: string }> = []
    const regex = /\{\{(\w+)\.(\w+)\}\}/g
    let ultimo = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(valor)) !== null) {
      if (match.index > ultimo) result.push({ tipo: 'texto', valor: valor.slice(ultimo, match.index) })
      result.push({ tipo: 'variable', entidad: match[1], campo: match[2], raw: match[0] })
      ultimo = regex.lastIndex
    }
    if (ultimo < valor.length) result.push({ tipo: 'texto', valor: valor.slice(ultimo) })
    return result
  }, [valor])

  // Reconstruir valor raw desde el contentEditable
  const handleInput = useCallback(() => {
    if (!editableRef.current || skipUpdateRef.current) return
    let nuevoValor = ''
    editableRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        nuevoValor += node.textContent || ''
      } else if (node instanceof HTMLElement) {
        const raw = node.getAttribute('data-raw')
        nuevoValor += raw || node.textContent || ''
      }
    })
    onChange(nuevoValor)
  }, [onChange])

  // Renderizar contenido cuando cambia el valor o el contexto (datos del contacto/documento)
  useEffect(() => {
    if (!editableRef.current) return

    skipUpdateRef.current = true
    // Guardar posición del cursor si el elemento tiene foco
    const tieneFoco = document.activeElement === editableRef.current

    editableRef.current.innerHTML = ''
    segmentos.forEach(seg => {
      if (seg.tipo === 'texto') {
        editableRef.current!.appendChild(document.createTextNode(seg.valor))
      } else {
        const preview = contexto?.[seg.entidad]?.[seg.campo]
        const textoVisible = (preview !== undefined && preview !== null && preview !== '') ? String(preview) : seg.raw
        const span = document.createElement('span')
        span.setAttribute('data-raw', seg.raw)
        span.setAttribute('contenteditable', 'false')
        span.setAttribute('title', seg.raw)
        span.style.background = 'var(--insignia-primario-fondo)'
        span.style.borderRadius = '3px'
        span.style.padding = '0 3px'
        span.style.cursor = 'default'
        span.textContent = textoVisible
        editableRef.current!.appendChild(span)
      }
    })
    skipUpdateRef.current = false

    // Restaurar foco al final si lo tenía
    if (tieneFoco && editableRef.current) {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editableRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [valor, segmentos, contexto])

  const vacio = !valor

  return (
    <div>
      {etiqueta && (
        <label className="text-xs font-medium text-texto-secundario mb-1.5 block">{etiqueta}</label>
      )}
    <div className="relative rounded-card transition-shadow focus-within:ring-2 focus-within:ring-texto-marca/20" style={{ border: '1px solid var(--borde-fuerte)' }}>
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="w-full text-sm outline-none py-2 px-3 pr-9 min-h-[36px] rounded-card"
        style={{ color: 'var(--texto-primario)' }}
        data-placeholder={placeholder}
      />
      {/* Placeholder manual */}
      {vacio && (
        <div
          className="absolute inset-0 flex items-center px-3 pointer-events-none text-sm"
          style={{ color: 'var(--texto-terciario)' }}
        >
          {placeholder}
        </div>
      )}
      {/* Boton { } */}
      <div className="absolute right-2 inset-y-0 flex items-center">
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<Braces size={14} />}
          titulo="Insertar variable"
          onClick={onToggleVariables}
        />
        <SelectorVariables
          abierto={variablesAbierto}
          onCerrar={onCerrarVariables}
          onSeleccionar={onInsertarVariable}
          posicion="abajo"
          contexto={contexto}
        />
      </div>
    </div>
    </div>
  )
}
