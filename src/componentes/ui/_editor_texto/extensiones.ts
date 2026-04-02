/**
 * Extensiones custom de TipTap para el EditorTexto.
 * Por ahora solo FontSizeInline — aplica font-size via TextStyle (mark inline, no global).
 */

import { Extension } from '@tiptap/core'

// ── Extension: FontSizeInline ───────────────────────────────────────────────
// Permite setear fontSize como atributo inline sobre textStyle.

export const FontSizeInline = Extension.create({
  name: 'fontSizeInline',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => (el as HTMLElement).style.fontSize || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}` }
          },
        },
      },
    }]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFontSize: (size: string) => ({ commands }: any) => commands.setMark('textStyle', { fontSize: size }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsetFontSize: () => ({ commands }: any) => commands.unsetMark('textStyle'),
    }
  },
})
