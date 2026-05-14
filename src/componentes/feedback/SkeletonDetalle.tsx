/**
 * SkeletonDetalle — Placeholder para páginas de detalle (contacto,
 * presupuesto, actividad, orden) durante la navegación.
 *
 * Simula la estructura visual típica: barra superior con migaja y
 * acciones, cabecera con avatar/nombre/etiquetas, dos columnas con
 * bloques de info y un panel chatter a la derecha. Se renderiza como
 * Server Component (sin 'use client') para aparecer al instante.
 *
 * Se usa como fallback en loading.tsx de las rutas /[id].
 */

interface Props {
  /** Mostrar barra lateral derecha (chatter) — default true */
  conChatter?: boolean
}

export function SkeletonDetalle({ conChatter = true }: Props = {}) {
  return (
    <div className="flex flex-col w-full h-full">
      {/* Barra superior: migaja + acciones */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-superficie-hover animate-pulse" />
          <div className="h-4 w-44 rounded bg-superficie-hover animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-superficie-hover animate-pulse" />
          <div className="h-8 w-24 rounded bg-superficie-hover animate-pulse" />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 overflow-hidden">
        {/* Columna principal */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Cabecera con avatar + nombre */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-superficie-hover animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-2/3 max-w-sm rounded bg-superficie-hover animate-pulse" />
              <div className="h-4 w-1/2 max-w-xs rounded bg-superficie-hover animate-pulse" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 rounded-card bg-superficie-hover animate-pulse" />
                <div className="h-5 w-20 rounded-card bg-superficie-hover animate-pulse" />
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-card border border-borde-sutil bg-superficie-tarjeta animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>

          {/* Dos columnas de info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
            {Array.from({ length: 2 }).map((_, col) => (
              <div key={col} className="space-y-3">
                <div className="h-4 w-32 rounded bg-superficie-hover animate-pulse" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-20 rounded bg-superficie-hover animate-pulse" />
                    <div className="h-9 rounded-card border border-borde-sutil bg-superficie-tarjeta animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Chatter lateral */}
        {conChatter && (
          <div className="lg:w-80 lg:shrink-0 space-y-3">
            <div className="h-9 w-full rounded-card border border-borde-sutil bg-superficie-tarjeta animate-pulse" />
            <div className="h-9 w-full rounded-card border border-borde-sutil bg-superficie-tarjeta animate-pulse" style={{ animationDelay: '60ms' }} />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-8 w-8 rounded-full bg-superficie-hover animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 rounded bg-superficie-hover animate-pulse" />
                    <div className="h-3 w-full rounded bg-superficie-hover animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
