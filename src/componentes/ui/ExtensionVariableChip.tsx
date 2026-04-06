/**
 * ExtensionVariableChip — Extensión TipTap que renderiza variables como nodos inline atómicos.
 * Usa un Node inline atom: no se puede editar parcialmente, se borra en bloque al presionar backspace.
 * El texto visible es el valor preview o la clave de la variable.
 * Usa una clase CSS para el resaltado.
 * Se usa en: EditorTexto cuando se pasa habilitarVariables.
 */

import { Node, mergeAttributes } from '@tiptap/core'

// ─── Node atómico de variable ───

export const VariableChip = Node.create({
  name: 'variableChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      entidad: { default: '' },
      campo: { default: '' },
      texto: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
        getAttrs: (el) => {
          const dom = el as HTMLElement
          const clave = dom.getAttribute('data-variable') || ''
          const [entidad, campo] = clave.split('.')
          return { entidad, campo, texto: dom.textContent || '' }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const clave = `${HTMLAttributes.entidad}.${HTMLAttributes.campo}`
    const texto = node.attrs.texto || `{{${clave}}}`
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-variable': clave,
      class: 'variable-resaltada',
      title: `{{${clave}}}`,
      contenteditable: 'false',
    }), texto]
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const clave = `${node.attrs.entidad}.${node.attrs.campo}`
      const texto = node.attrs.texto || `{{${clave}}}`

      const dom = document.createElement('span')
      dom.setAttribute('data-variable', clave)
      dom.className = 'variable-resaltada'
      dom.title = `{{${clave}}}`
      dom.contentEditable = 'false'
      dom.textContent = texto

      // Atributos adicionales de TipTap
      for (const [key, value] of Object.entries(HTMLAttributes)) {
        if (key !== 'class' && key !== 'contenteditable' && value != null) {
          dom.setAttribute(key, String(value))
        }
      }

      return { dom }
    }
  },
})

/**
 * Helper para crear el contenido a insertar en el editor.
 * Inserta un nodo atómico variableChip.
 */
export function crearNodoVariable(entidad: string, campo: string, valorPreview: string) {
  const texto = valorPreview || `{{${entidad}.${campo}}}`
  return {
    type: 'variableChip',
    attrs: { entidad, campo, texto },
  }
}
