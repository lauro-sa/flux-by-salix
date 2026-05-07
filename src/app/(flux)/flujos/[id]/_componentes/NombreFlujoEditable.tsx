'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Nombre del flujo inline editable, dentro del header del editor.
 *
 * Comportamiento (D8 del plan):
 *   • Click → activa el input, focus y autoselect del texto.
 *   • Blur o Enter → si cambió y no está vacío, dispara `onCambiar`.
 *                     Si quedó vacío, revierte al valor previo.
 *   • Esc → revierte al valor previo y blur.
 *
 * Sin modal, sin autoguardado independiente — el cambio sube por callback
 * y `useEditorFlujo` lo mete en su autoguardado debounce.
 *
 * En modo solo lectura el componente devuelve un `<span>` plano sin
 * eventos.
 */

interface Props {
  valor: string
  onCambiar: (nuevo: string) => void
  soloLectura: boolean
}

export default function NombreFlujoEditable({ valor, onCambiar, soloLectura }: Props) {
  const { t } = useTraduccion()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(valor)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sincronizar el borrador si el valor externo cambia (ej: el server
  // devolvió un nombre normalizado distinto al que tipeé).
  useEffect(() => {
    if (!editando) setBorrador(valor)
  }, [valor, editando])

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editando])

  const confirmar = useCallback(() => {
    const limpio = borrador.trim()
    if (limpio.length > 0 && limpio !== valor) {
      onCambiar(limpio)
    } else {
      setBorrador(valor) // Revertir si vacío o sin cambio.
    }
    setEditando(false)
  }, [borrador, onCambiar, valor])

  const cancelar = useCallback(() => {
    setBorrador(valor)
    setEditando(false)
  }, [valor])

  if (soloLectura) {
    return (
      <h1 className="text-sm sm:text-base font-semibold text-texto-primario truncate">
        {valor || t('flujos.editor.nombre_default')}
      </h1>
    )
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title={t('flujos.editor.nombre_editar_tooltip')}
        className="text-left text-sm sm:text-base font-semibold text-texto-primario truncate cursor-text rounded-sm px-1 -mx-1 py-0.5 -my-0.5 hover:bg-superficie-hover transition-colors min-w-0"
      >
        {valor || t('flujos.editor.nombre_default')}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={borrador}
      maxLength={200}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirmar()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelar()
        }
      }}
      aria-label={t('flujos.editor.nombre_editar_tooltip')}
      className="text-sm sm:text-base font-semibold text-texto-primario bg-transparent border-b border-texto-marca outline-none w-full min-w-0 px-1 -mx-1 py-0.5 -my-0.5"
    />
  )
}
