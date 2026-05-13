'use client'

import { useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  /**
   * URL destino de la fila — habilita click central, Cmd/Ctrl+click, "Copiar enlace", etc.
   * Si devuelve `undefined` la fila cae a `onClickFila`. Si ambos están definidos, `onClickFila`
   * corre antes de navegar (útil para side-effects).
   */
  hrefFila?: (fila: T) => string | undefined
  ariaLabelFila?: (fila: T) => string
  cargando?: boolean
  vacio?: ReactNode
  className?: string
}

/**
 * TablaBase — Tabla avanzada reutilizable.
 * Se usa en: contactos, actividades, productos, auditoría, etc.
 * Soporta: selección, click en fila, loading skeleton, estado vacío.
 */
function TablaBase<T>({ columnas, datos, claveFila, seleccionables, seleccionados, onSeleccionar, onClickFila, hrefFila, ariaLabelFila, cargando, vacio, className = '' }: PropiedadesTabla<T>) {
  const router = useRouter()
  const todoSeleccionado = datos.length > 0 && seleccionados?.size === datos.length

  // Navegación de fila — middle-click, Cmd/Ctrl+click → nueva pestaña; click simple → router.push.
  // Si el target ya es un <a>, lo deja al Link para evitar duplicación.
  const navegarFila = useCallback((href: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a[href]')) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(href)
  }, [router])

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
      <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden ${className}`}>
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
    <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden overflow-x-auto con-indicador-scroll ${className}`}>
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
            const href = hrefFila?.(fila)
            const filaClickeable = !!href || !!onClickFila
            return (
              <tr
                key={id}
                onClick={(e) => {
                  onClickFila?.(fila)
                  if (href) navegarFila(href, e)
                }}
                onAuxClick={href ? (e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    window.open(href, '_blank', 'noopener,noreferrer')
                  }
                } : undefined}
                className={[
                  // `relative` permite que el <Link> stretched (absolute inset-0) cubra toda la fila
                  'relative border-b border-borde-sutil last:border-b-0 transition-colors duration-100',
                  filaClickeable ? 'cursor-pointer hover:bg-superficie-hover' : '',
                  estaSeleccionado ? 'bg-superficie-seleccionada' : '',
                ].join(' ')}
              >
                {seleccionables && (
                  // z-10 mantiene el checkbox por encima del Link absoluto de la fila
                  <td className="relative z-10 w-10 px-3 py-2.5">
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox marcado={estaSeleccionado} onChange={() => toggleUno(id)} />
                    </span>
                  </td>
                )}
                {columnas.map((col, indiceCol) => {
                  const esCeldaConLink = !!href && indiceCol === 0
                  return (
                    <td
                      key={col.clave}
                      className="px-4 py-2.5 text-texto-primario"
                      style={{ textAlign: col.alineacion }}
                    >
                      {/* Stretched link — cubre toda la fila (containing block = <tr position:relative>) */}
                      {esCeldaConLink && (
                        <Link
                          href={href!}
                          aria-label={ariaLabelFila?.(fila)}
                          className="absolute inset-0 z-0"
                          tabIndex={0}
                        />
                      )}
                      {/* Wrapper con pointer-events:none → los clicks atraviesan al Link debajo
                          (habilita middle-click, right-click → "Abrir en pestaña nueva", etc.).
                          Excepciones: button, a, input, select, textarea recuperan pointer-events
                          para no romper menús contextuales / botones internos de las celdas. */}
                      {href ? (
                        <span className="relative pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto [&_[role=button]]:pointer-events-auto">
                          {col.render ? col.render(fila) : String((fila as Record<string, unknown>)[col.clave] ?? '')}
                        </span>
                      ) : (
                        col.render ? col.render(fila) : String((fila as Record<string, unknown>)[col.clave] ?? '')
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { TablaBase, type PropiedadesTabla, type Columna }
