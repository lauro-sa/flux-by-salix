/**
 * Tipos, interfaces y constantes del EditorTexto.
 * Se usan en el componente principal y en los sub-componentes (Toolbar, PickerHSL, etc.).
 */

import type { CSSProperties } from 'react'
import type { useEditor } from '@tiptap/react'

// ── Propiedades del editor ──────────────────────────────────────────────────

export interface PropiedadesEditorTexto {
  contenido?: string
  onChange?: (html: string) => void
  placeholder?: string
  soloLectura?: boolean
  alturaMinima?: number
  className?: string
  style?: CSSProperties
  /** Colores de marca de la empresa (se muestran como opciones rapidas) */
  coloresMarca?: string[]
  /** Slot extra para acciones custom en el toolbar (ej: boton IA) */
  accionesExtra?: React.ReactNode
  /** Si se define, Enter (sin Shift) llama esto en vez de crear parrafo */
  onEnter?: () => void
  /** Si se define, Backspace en contenido vacio llama esto */
  onBackspaceVacio?: () => void
  /** Callback al recibir foco */
  onFoco?: () => void
  /** Enfocar el editor programaticamente (cambiar para triggear) */
  autoEnfocar?: boolean
  /** Callback con la instancia del editor TipTap para control externo (insertar contenido, etc.) */
  onEditorListo?: (editor: ReturnType<typeof useEditor>) => void
  /** Si se pasa, habilita la extension VariableChip para renderizar variables como chips inline */
  habilitarVariables?: boolean
}

// ── Tipo de panel abierto en el toolbar ─────────────────────────────────────

export type TipoPanel = 'color' | 'tamano' | 'link' | null

// ── Tamanos de texto ────────────────────────────────────────────────────────

export interface TamanoTexto {
  id: string
  etiqueta: string
  tipo: string
  px: string | null
}

export const TAMANOS_TEXTO: TamanoTexto[] = [
  { id: 'titulo', etiqueta: 'Titulo', tipo: 'fontSize', px: '24px' },
  { id: 'subtitulo', etiqueta: 'Subtitulo', tipo: 'fontSize', px: '20px' },
  { id: 'encabezado', etiqueta: 'Encabezado', tipo: 'fontSize', px: '18px' },
  { id: 'grande', etiqueta: 'Grande', tipo: 'fontSize', px: '16px' },
  { id: 'normal', etiqueta: 'Normal', tipo: 'reset', px: null },
  { id: 'pequeno', etiqueta: 'Pequeno', tipo: 'fontSize', px: '12px' },
  { id: 'diminuto', etiqueta: 'Diminuto', tipo: 'fontSize', px: '10px' },
  { id: 'micro', etiqueta: 'Micro', tipo: 'fontSize', px: '8px' },
]

// ── Grilla de colores — 8 columnas, organizada por tono (claro->oscuro) ─────
// Fila 1: saturados puros, Fila 2-4: tints claros, Fila 5-7: shades oscuros
// Columnas: Rojo, Naranja, Amarillo, Verde, Cyan, Azul, Violeta, Rosa

export const GRILLA_COLORES = [
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

// ── Mapa de px por tamano (para mostrar en el panel) ────────────────────────

export const PX_POR_TAMANO: Record<string, string> = {
  titulo: '24px',
  subtitulo: '20px',
  encabezado: '18px',
  grande: '16px',
  normal: '14px (base)',
  pequeno: '12px',
  diminuto: '10px',
  micro: '8px',
}
