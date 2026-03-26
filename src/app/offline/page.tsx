import { WifiOff } from 'lucide-react'

/**
 * Página offline — Se muestra cuando no hay conexión y el SW no tiene cache.
 */
export default function PaginaOffline() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-superficie-app p-6">
      <div className="text-center max-w-sm">
        <div className="size-16 rounded-2xl bg-superficie-hover flex items-center justify-center mx-auto mb-4">
          <WifiOff size={32} className="text-texto-terciario" />
        </div>
        <h1 className="text-xl font-semibold text-texto-primario mb-2">Sin conexión</h1>
        <p className="text-sm text-texto-secundario mb-6">
          No hay conexión a internet. Verificá tu red e intentá de nuevo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg bg-texto-marca text-white font-medium text-sm cursor-pointer border-none hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
