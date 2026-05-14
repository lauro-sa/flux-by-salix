'use client'

/**
 * EditorTextoLazy — Wrapper de EditorTexto con code-split dinámico.
 *
 * Carga TipTap y sus extensiones (~7 MB sin minificar) sólo cuando este
 * componente se monta. Mientras tanto muestra un placeholder con la altura
 * mínima del editor para evitar layout shift.
 *
 * Importar este wrapper desde:
 * - Compositor de correo (inbox)
 * - Configuración de canales
 * - Panel de notas rápidas
 * - Vitrina (showcase)
 *
 * El componente real `EditorTexto` queda accesible para casos donde la
 * carga inmediata sea necesaria.
 */

import dynamic from 'next/dynamic'
import type { PropiedadesEditorTexto } from '@/componentes/ui/_editor_texto/tipos'

const EditorTextoInterno = dynamic(
  () => import('@/componentes/ui/EditorTexto').then(m => ({ default: m.EditorTexto })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[120px] w-full rounded-card border border-borde-sutil bg-superficie-tarjeta animate-pulse" />
    ),
  },
)

export function EditorTextoLazy(props: PropiedadesEditorTexto) {
  return <EditorTextoInterno {...props} />
}
