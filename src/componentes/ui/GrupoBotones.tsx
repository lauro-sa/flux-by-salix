'use client'

import type { ReactNode } from 'react'

interface PropiedadesGrupoBotones {
  children: ReactNode
  className?: string
}

/**
 * GrupoBotones — Agrupa botones adyacentes estilo segmented control.
 * El primer hijo conserva solo el radio izquierdo, el último solo el derecho,
 * los intermedios quedan rectos. Separación de 4px entre botones.
 *
 * Las reglas de radio se aplican desde globals.css (clase .grupo-botones)
 * con !important para ganar sobre el rounded-boton que cada Boton trae.
 * Soporta un botón anidado dentro de un <div> hijo (caso típico: menú
 * con dropdown que necesita un wrapper `relative`).
 */
export function GrupoBotones({ children, className = '' }: PropiedadesGrupoBotones) {
  return (
    <div className={['grupo-botones inline-flex gap-1', className].join(' ')}>
      {children}
    </div>
  )
}
