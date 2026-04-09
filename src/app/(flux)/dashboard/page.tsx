import { Suspense } from 'react'
import ContenidoDashboard from './_componentes/ContenidoDashboard'

/**
 * Página de Dashboard — Server Component con Suspense.
 * El layout/sidebar se muestra instantáneamente mientras el
 * ContenidoDashboard (Client Component) carga sus datos via useEffect.
 */

export default function PaginaDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ContenidoDashboard />
    </Suspense>
  )
}

// ─── Skeleton del dashboard mientras carga el JS del Client Component ───

function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-12 animate-pulse">
      {/* Header: saludo + pestañas */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="h-7 w-56 bg-superficie-hover rounded-md" />
          <div className="h-4 w-32 bg-superficie-hover rounded-md mt-2" />
        </div>
        <div className="h-8 w-44 bg-superficie-hover rounded-lg" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-superficie-tarjeta border border-borde-sutil rounded-lg py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-superficie-hover" />
              <div className="flex-1 space-y-1.5">
                <div className="h-5 w-12 bg-superficie-hover rounded" />
                <div className="h-3 w-20 bg-superficie-hover rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 bg-superficie-hover rounded-lg" />
        ))}
      </div>

      {/* 4 tarjetas recientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-4 bg-superficie-hover rounded" />
              <div className="h-3.5 w-28 bg-superficie-hover rounded" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-3 w-32 bg-superficie-hover rounded" />
                  <div className="h-3 w-16 bg-superficie-hover rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline + Por vencer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-5">
            <div className="h-4 w-36 bg-superficie-hover rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-3 flex-1 bg-superficie-hover rounded" />
                  <div className="h-3 w-12 bg-superficie-hover rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
