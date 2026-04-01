/**
 * ExtensionVariableChip — Extensión TipTap que renderiza variables como texto con marca inline.
 * Usa un Mark (no un Node atómico), así se puede combinar con bold, italic, color, tamaño, etc.
 * El texto visible es el valor resuelto; la marca guarda la clave de la variable.
 * Usa una clase CSS para el resaltado — NO style inline (para no pisar color/fontSize de otras marcas).
 * Se usa en: EditorTexto cuando se pasa habilitarVariables.
 */

import { Mark, mergeAttributes } from '@tiptap/core'

// ─── Mark de variable ───

export const VariableChip = Mark.create({
  name: 'variableChip',
  // Prioridad baja para que sea la marca más externa — las demás (bold, color, etc.) quedan dentro
  priority: 50,
  // Permitir que todas las demás marcas coexistan dentro
  excludes: '',

  addAttributes() {
    return {
      entidad: { default: '' },
      campo: { default: '' },
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
          return { entidad, campo }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const clave = `${HTMLAttributes.entidad}.${HTMLAttributes.campo}`
    // Solo atributos HTML, NO style inline — el estilo va por CSS con la clase
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-variable': clave,
      class: 'variable-resaltada',
      title: `{{${clave}}}`,
    }), 0]
  },
})

/**
 * Helper para crear el contenido a insertar en el editor.
 * Inserta texto con la marca variableChip aplicada.
 */
export function crearNodoVariable(entidad: string, campo: string, valorPreview: string) {
  const texto = valorPreview || `{{${entidad}.${campo}}}`
  return {
    type: 'text',
    text: texto,
    marks: [
      {
        type: 'variableChip',
        attrs: { entidad, campo },
      },
    ],
  }
}
