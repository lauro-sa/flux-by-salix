'use client'

import type { ReactNode } from 'react'
import { Checkbox } from '@/componentes/ui/Checkbox'

interface Columna<T> {
  clave: string
  etiqueta: string
  ancho?: string
  render?: (fila: T) => ReactNode
  alineacion?: 'left' | 'center' | 'right'
}

interface PropiedadesTabla<T> {
  columnas: Columna<T>[]
  datos: T[]
  claveFila: (fila: T) => string
  seleccionables?: boolean
  seleccionados?: Set<string>
  onSeleccionar?: (ids: Set<string>) => void
  onClickFila?: (fila: T) => void
  cargando?: boolean
  vacio?: ReactNode
  className?: string
}

/**
 * TablaBase — Tabla avanzada reutilizable.
 * Se usa en: contactos, actividades, productos, auditoría, etc.
 * Soporta: selección, click en fila, loading skeleton, estado vacío.
 */
function TablaBase<T>({ columnas, datos, claveFila, seleccionables, seleccionados, onSeleccionar, onClickFila, cargando, vacio, className = '' }: PropiedadesTabla<T>) {
  const todoSeleccionado = datos.length > 0 && seleccionados?.size === datos.length

  const toggleTodos = () => {
    if (!onSeleccionar) return
    if (todoSeleccionado) {
      onSeleccionar(new Set())
    } else {
      onSeleccionar(new Set(datos.map(claveFila)))
    }
  }

  const toggleUno = (id: string) => {
    if (!onSeleccionar || !seleccionados) return
    const nuevo = new Set(seleccionados)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    onSeleccionar(nuevo)
  }

  if (cargando) {
    return (
      <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-lg overflow-hidden ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-borde-sutil last:border-b-0">
            {columnas.map((col) => (
              <div key={col.clave} className="h-4 rounded bg-superficie-hover animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (datos.length === 0 && vacio) {
    return <>{vacio}</>
  }

  return (
    <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-lg overflow-hidden overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-borde-sutil">
            {seleccionables && (
              <th className="w-10 px-3 py-2.5">
                <Checkbox marcado={todoSeleccionado} onChange={() => toggleTodos()} />
              </th>
            )}
            {columnas.map((col) => (
              <th
                key={col.clave}
                className="px-4 py-2.5 text-xs font-semibold text-texto-terciario uppercase tracking-wide text-left"
                style={{ width: col.ancho, textAlign: col.alineacion }}
              >
                {col.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila) => {
            const id = claveFila(fila)
            const estaSeleccionado = seleccionados?.has(id)
            return (
              <tr
                key={id}
                onClick={() => onClickFila?.(fila)}
                className={[
                  'border-b border-borde-sutil last:border-b-0 transition-colors duration-100',
                  onClickFila ? 'cursor-pointer hover:bg-superficie-hover' : '',
                  estaSeleccionado ? 'bg-superficie-seleccionada' : '',
                ].join(' ')}
              >
                {seleccionables && (
                  <td className="w-10 px-3 py-2.5">
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox marcado={estaSeleccionado} onChange={() => toggleUno(id)} />
                    </span>
                  </td>
                )}
                {columnas.map((col) => (
                  <td key={col.clave} className="px-4 py-2.5 text-texto-primario" style={{ textAlign: col.alineacion }}>
                    {col.render ? col.render(fila) : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { TablaBase, type PropiedadesTabla, type Columna }
