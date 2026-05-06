'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTraduccion } from '@/lib/i18n'

/**
 * Nombre del paso/disparador editable inline en el header del panel
 * lateral del editor (sub-PR 19.3b).
 *
 * Clon del patrón `NombreFlujoEditable`, aplicado al campo `etiqueta?:
 * string` que el sub-PR 19.3b agregó a `AccionBase` y al disparador.
 *
 * Diferencias con `NombreFlujoEditable`:
 *   • El "valor" puede estar vacío (etiqueta opcional). Mostramos un
 *     fallback prominente (el título legible del tipo del paso) cuando
 *     no hay etiqueta.
 *   • Si el usuario tipea y deja vacío, el cambio EMITE `''` para que
 *     el padre limpie el campo (no preservamos el valor previo, a
 *     diferencia del nombre del flujo que es obligatorio).
 *
 * Comportamiento:
 *   • Click → activa input, focus + autoselect.
 *   • Blur o Enter → confirma (incluso si vacío).
 *   • Esc → revierte y blur.
 *
 * Modo solo lectura: devuelve un `<span>` con el fallback, sin eventos.
 */

interface Props {
  /** Etiqueta actual (puede ser undefined / null / vacía). */
  valor: string | null | undefined
  /** Texto a mostrar cuando el valor está vacío. NO se persiste. */
  fallback: string
  /** Callback con la etiqueta nueva (string vacío = limpiar). */
  onCambiar: (nuevo: string) => void
  soloLectura: boolean
}

export default function NombrePasoEditable({
  valor,
  fallback,
  onCambiar,
  soloLectura,
}: Props) {
  const { t } = useTraduccion()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(valor ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editando) setBorrador(valor ?? '')
  }, [valor, editando])

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editando])

  const confirmar = useCallback(() => {
    const limpio = borrador.trim()
    // Emitimos siempre — string vacío = limpiar el campo. El padre
    // decide si lo guarda como `etiqueta: undefined` o `''`.
    if (limpio !== (valor ?? '')) onCambiar(limpio)
    setEditando(false)
  }, [borrador, onCambiar, valor])

  const cancelar = useCallback(() => {
    setBorrador(valor ?? '')
    setEditando(false)
  }, [valor])

  if (soloLectura) {
    return (
      <span className="text-sm font-semibold text-texto-primario truncate">
        {valor && valor.trim().length > 0 ? valor : fallback}
      </span>
    )
  }

  if (!editando) {
    const tieneValor = valor && valor.trim().length > 0
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title={t('flujos.editor.panel.header.editar_nombre_tooltip')}
        className={[
          'flex-1 text-left text-sm font-semibold truncate cursor-text rounded-sm px-1 -mx-1 py-0.5 -my-0.5 hover:bg-superficie-hover transition-colors min-w-0',
          tieneValor ? 'text-texto-primario' : 'text-texto-terciario',
        ].join(' ')}
      >
        {tieneValor ? valor : fallback}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={borrador}
      maxLength={200}
      placeholder={fallback}
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
      aria-label={t('flujos.editor.panel.header.editar_nombre_tooltip')}
      className="flex-1 text-sm font-semibold text-texto-primario bg-transparent border-b border-texto-marca outline-none w-full min-w-0 px-1 -mx-1 py-0.5 -my-0.5"
    />
  )
}
