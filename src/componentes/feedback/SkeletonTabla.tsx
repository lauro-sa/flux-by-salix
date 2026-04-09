'use client'

/**
 * SkeletonTabla — Placeholder animado que simula una tabla mientras los datos cargan.
 * Se usa en: páginas de listado (contactos, presupuestos, actividades, papelera).
 * Muestra filas con bloques pulsantes que imitan la estructura de la tabla real.
 */

interface SkeletonTablaProps {
  filas?: number
  columnas?: number
}

export function SkeletonTabla({ filas = 8, columnas = 5 }: SkeletonTablaProps) {
  return (
    <div className="flex flex-col gap-0 rounded-lg overflow-hidden">
      {/* Solo filas — el header/búsqueda/filtros los renderiza el Client Component */}
      {Array.from({ length: filas }).map((_, fila) => (
        <div
          key={fila}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-borde-sutil last:border-b-0"
        >
          {Array.from({ length: columnas }).map((_, col) => (
            <div
              key={col}
              className="h-4 rounded bg-superficie-hover animate-pulse"
              style={{
                width: col === 0 ? 70 : col === 1 ? 160 : col === columnas - 1 ? 90 : 110,
                animationDelay: `${(fila * columnas + col) * 50}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * SkeletonLista — Placeholder para listas tipo papelera (filas con ícono + texto).
 */
export function SkeletonLista({ filas = 6 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-superficie-tarjeta border border-borde-sutil"
        >
          <div className="w-9 h-9 rounded-lg bg-superficie-hover animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div
              className="h-4 rounded bg-superficie-hover animate-pulse"
              style={{ width: `${50 + Math.random() * 30}%`, animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-3 rounded bg-superficie-hover animate-pulse"
              style={{ width: `${30 + Math.random() * 20}%`, animationDelay: `${i * 80 + 40}ms` }}
            />
          </div>
          <div className="w-16 h-6 rounded bg-superficie-hover animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  )
}
