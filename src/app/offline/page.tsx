'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

/**
 * Página offline — Se muestra cuando no hay conexión y el SW no tiene cache.
 * Usa inline styles como fallback por si los tokens CSS no cargaron.
 * Safe areas para PWA en iOS.
 */
export default function PaginaOffline() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-superficie-app text-texto-primario"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="size-20 rounded-modal bg-superficie-hover flex items-center justify-center mb-6">
        <WifiOff size={36} className="text-texto-terciario" />
      </div>

      <h1 className="text-xl font-semibold text-texto-primario mb-2">
        Sin conexión
      </h1>

      <p className="text-sm text-texto-secundario mb-8 max-w-xs">
        Parece que no tenés conexión a internet. Verificá tu red e intentá de nuevo.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-medium bg-texto-marca text-white cursor-pointer border-none transition-all hover:brightness-110"
      >
        <RefreshCw size={16} />
        Reintentar
      </button>

      <p className="text-xs text-texto-terciario mt-12">
        Flux by Salix
      </p>
    </div>
  )
}
