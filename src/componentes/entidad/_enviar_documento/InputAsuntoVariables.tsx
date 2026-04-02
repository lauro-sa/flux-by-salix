'use client'

/**
 * InputAsuntoVariables — Input de asunto que renderiza variables {{entidad.campo}} como chips inline.
 * Si no tiene variables, funciona como un input normal para mayor fluidez.
 * Se usa en: ModalEnviarDocumento (campo Asunto).
 */

import { useRef, useCallback } from 'react'
import { X } from 'lucide-react'

// ─── Parser de segmentos ───

/** Parsea un string con {{entidad.campo}} y lo divide en segmentos de texto y variables */
export function parsearSegmentos(texto: string): Array<{ tipo: 'texto'; valor: string } | { tipo: 'variable'; entidad: string; campo: string; raw: string }> {
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

// ─── Componente ───

interface PropiedadesInputAsuntoVariables {
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  contexto?: Record<string, Record<string, unknown>>
  onAbrirVariables: () => void
}

export function InputAsuntoVariables({
  valor,
  onChange,
  placeholder,
  contexto,
}: PropiedadesInputAsuntoVariables) {
  const editableRef = useRef<HTMLDivElement>(null)
  const segmentos = parsearSegmentos(valor)
  const tieneVariables = segmentos.some(s => s.tipo === 'variable')

  // Reconstruir el valor raw desde el contentEditable
  const handleInput = useCallback(() => {
    if (!editableRef.current) return
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
