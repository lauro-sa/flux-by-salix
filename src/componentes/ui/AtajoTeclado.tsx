'use client'

import type { ReactNode } from 'react'

/**
 * AtajoTeclado — Píldora pequeña que muestra una combinación de teclas
 * (E, R, A, ⌘+↩, Esc, etc.) al lado de un botón o acción.
 *
 * Se usa en CTAs principales, botones de aceptar/rechazar en listas,
 * y en cualquier lugar donde queramos comunicar que existe shortcut.
 *
 * Acepta:
 *  - children: string corto con la tecla o combinación (ej: "E", "⌘ ↩")
 *  - tamano: 'sm' (chiquito para acciones inline) | 'md' (CTAs principales)
 *  - tono: 'sutil' (default, sobre fondos oscuros) | 'fuerte' (más contraste)
 */

interface PropsAtajoTeclado {
  children: ReactNode
  tamano?: 'sm' | 'md'
  tono?: 'sutil' | 'fuerte'
  className?: string
}

const tamanos: Record<'sm' | 'md', string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xxs px-2 py-1',
}

const tonos: Record<'sutil' | 'fuerte', string> = {
  sutil: 'bg-black/20 text-texto-terciario border border-borde-sutil/50',
  fuerte: 'bg-black/30 text-texto-secundario border border-borde-sutil',
}

export function AtajoTeclado({ children, tamano = 'sm', tono = 'sutil', className = '' }: PropsAtajoTeclado) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded-boton font-mono leading-none ${tamanos[tamano]} ${tonos[tono]} ${className}`}
    >
      {children}
    </kbd>
  )
}
