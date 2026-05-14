/**
 * SkeletonListado — Placeholder completo para páginas de listado.
 * Simula encabezado (título + búsqueda + filtros), tabla con filas y paginación.
 * Se usa como fallback de Suspense en page.tsx y dentro de loading.tsx.
 *
 * Es un Server Component (no necesita 'use client') para que pueda renderizarse
 * instantáneamente en SSR sin esperar hidratación.
 */

import { SkeletonTabla } from './SkeletonTabla'

interface Props {
  /** Cantidad de filas de la tabla — default 10 */
  filas?: number
  /** Cantidad de columnas de la tabla — default 6 */
  columnas?: number
  /** Mostrar la pseudo-paginación al pie — default true */
  conPaginacion?: boolean
  /** Mostrar barra de filtros adicional bajo la búsqueda — default true */
  conFiltros?: boolean
}

export function SkeletonListado({
  filas = 10,
  columnas = 6,
  conPaginacion = true,
  conFiltros = true,
}: Props) {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 w-full">
      {/* Cabecera: título + acciones */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-40 rounded bg-superficie-hover animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-card bg-superficie-hover animate-pulse" />
          <div className="h-9 w-28 rounded-card bg-superficie-hover animate-pulse" />
        </div>
      </div>

      {/* Barra de búsqueda + filtros */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="h-10 w-full md:w-80 rounded-card bg-superficie-hover animate-pulse" />
        {conFiltros && (
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 rounded-card bg-superficie-hover animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-card border border-borde-sutil overflow-hidden bg-superficie-tarjeta">
        {/* Encabezado de columnas */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-borde-sutil bg-superficie-elevada">
          {Array.from({ length: columnas }).map((_, col) => (
            <div
              key={col}
              className="h-3 rounded bg-superficie-hover animate-pulse"
              style={{
                width: col === 0 ? 60 : col === 1 ? 130 : col === columnas - 1 ? 70 : 90,
              }}
            />
          ))}
        </div>

        {/* Filas */}
        <SkeletonTabla filas={filas} columnas={columnas} />
      </div>

      {/* Paginación */}
      {conPaginacion && (
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-32 rounded bg-superficie-hover animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-superficie-hover animate-pulse" />
            <div className="h-8 w-8 rounded bg-superficie-hover animate-pulse" />
            <div className="h-8 w-8 rounded bg-superficie-hover animate-pulse" />
          </div>
        </div>
      )}
    </div>
  )
}
